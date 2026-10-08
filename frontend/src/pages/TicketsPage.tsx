import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './tickets.css'
import TicketTable from '../components/TicketTable'
import TicketCreateForm from '../components/TicketCreateForm'
import { useAuth, type User } from '../state/AuthContext'
import {
  exportTicketsCsv,
  getAssignableUsers,
  listTickets,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Priority,
  type SortOrder,
  type Ticket,
  type TicketFilters,
  type TicketListResponse,
  type TicketSort,
  type TicketStatus,
} from '../api/tickets'

const DEFAULT_SORT: TicketSort = 'created_at'
const DEFAULT_ORDER: SortOrder = 'desc'
const DEFAULT_PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 300

const STATUS_OPTIONS: TicketStatus[] = ['open', 'in_progress', 'closed']
const PRIORITY_OPTIONS: Priority[] = ['critical', 'high', 'medium', 'low']

function pageWindow(current: number, pages: number): number[] {
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, index) => index + 1)
  }
  const start = Math.max(1, Math.min(current - 2, pages - 4))
  return Array.from({ length: 5 }, (_, index) => start + index)
}

export default function TicketsPage() {
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const search = params.get('search') ?? ''
  const statusParam = (params.get('status') as TicketStatus | null) ?? ''
  const priorityParam = (params.get('priority') as Priority | null) ?? ''
  const assigneeParam = params.get('assignee_id')
  const sortParam = (params.get('sort') as TicketSort | null) ?? DEFAULT_SORT
  const orderParam = (params.get('order') as SortOrder | null) ?? DEFAULT_ORDER
  const pageParam = Number(params.get('page') ?? '1') || 1
  const pageSizeParam =
    Number(params.get('page_size') ?? String(DEFAULT_PAGE_SIZE)) ||
    DEFAULT_PAGE_SIZE

  const canFilterAssignee = user?.role === 'agent' || user?.role === 'admin'

  const [data, setData] = useState<TicketListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [agents, setAgents] = useState<User[]>([])
  const [searchText, setSearchText] = useState(search)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const filters = useMemo<TicketFilters>(
    () => ({
      search: search || undefined,
      status: statusParam || undefined,
      priority: priorityParam || undefined,
      assignee_id:
        assigneeParam !== null && assigneeParam !== ''
          ? Number(assigneeParam)
          : undefined,
      sort: sortParam,
      order: orderParam,
      page: pageParam,
      page_size: pageSizeParam,
    }),
    [
      search,
      statusParam,
      priorityParam,
      assigneeParam,
      sortParam,
      orderParam,
      pageParam,
      pageSizeParam,
    ],
  )

  const updateParams = useCallback(
    (
      patch: Record<string, string | null>,
      options: { resetPage?: boolean } = {},
    ) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === '') {
              next.delete(key)
            } else {
              next.set(key, value)
            }
          }
          if (options.resetPage !== false) {
            next.set('page', '1')
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const resetFilters = useCallback(() => {
    setSearchText('')
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const key of ['search', 'status', 'priority', 'assignee_id', 'page']) {
          next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }, [setParams])

  // Keep the input in sync when the URL search changes externally (reset).
  useEffect(() => {
    setSearchText(search)
  }, [search])

  // Debounce the search field into the URL so the list refetches once.
  useEffect(() => {
    if (searchText === search) {
      return
    }
    const handle = window.setTimeout(() => {
      updateParams({ search: searchText || null })
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [searchText, search, updateParams])

  // Load the filtered, sorted, paged ticket list.
  useEffect(() => {
    if (!token) {
      setData(null)
      setIsLoading(false)
      return
    }
    const controller = new AbortController()
    setIsLoading(true)
    setLoadError(null)
    listTickets(filters, { token, signal: controller.signal })
      .then((response) => setData(response))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setData(null)
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Die Tickets konnten nicht geladen werden. Bitte versuchen Sie es erneut.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })
    return () => controller.abort()
  }, [token, filters, refreshKey])

  // Options for the Zuständigkeit filter (active agents and administrators).
  useEffect(() => {
    if (!token || !canFilterAssignee) {
      setAgents([])
      return
    }
    const controller = new AbortController()
    getAssignableUsers({ token, signal: controller.signal })
      .then((users) => setAgents(users))
      .catch(() => setAgents([]))
    return () => controller.abort()
  }, [token, canFilterAssignee])

  // Auto-dismiss the success feedback (AC-17).
  useEffect(() => {
    if (!successMessage) {
      return
    }
    const handle = window.setTimeout(() => setSuccessMessage(null), 5000)
    return () => window.clearTimeout(handle)
  }, [successMessage])

  const handleSortChange = (key: TicketSort) => {
    const nextOrder: SortOrder =
      sortParam === key ? (orderParam === 'asc' ? 'desc' : 'asc') : 'desc'
    updateParams({ sort: key, order: nextOrder })
  }

  const handleExport = async () => {
    if (!token) {
      return
    }
    try {
      const blob = await exportTicketsCsv(filters, token)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'tickets.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Der CSV-Export konnte nicht erstellt werden.',
      )
    }
  }

  const handleCreated = (ticket: Ticket) => {
    setIsCreateOpen(false)
    setSuccessMessage(`Ticket „${ticket.title}“ wurde angelegt.`)
    updateParams({ page: null }, { resetPage: false })
    setRefreshKey((key) => key + 1)
  }

  const activeChips: Array<{ key: string; label: string }> = []
  if (search) {
    activeChips.push({ key: 'search', label: `Suche: ${search}` })
  }
  if (statusParam) {
    activeChips.push({
      key: 'status',
      label: `Status: ${STATUS_LABELS[statusParam]}`,
    })
  }
  if (priorityParam) {
    activeChips.push({
      key: 'priority',
      label: `Priorität: ${PRIORITY_LABELS[priorityParam]}`,
    })
  }
  if (filters.assignee_id !== undefined) {
    const agent = agents.find((item) => item.id === filters.assignee_id)
    activeChips.push({
      key: 'assignee_id',
      label: `Zuständigkeit: ${agent ? agent.full_name : filters.assignee_id}`,
    })
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1
  const currentPage = data?.page ?? pageParam
  const pageSize = data?.page_size ?? pageSizeParam
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, total)
  const exportDisabled = total === 0 || isLoading

  return (
    <section className="page-section" data-testid="page-tickets">
      <header className="page-header" data-od-id="page-header">
        <div>
          <h1 data-od-id="page-title">Tickets</h1>
          <p className="page-header-description">
            Alle Anfragen durchsuchen, filtern und sortieren.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            data-od-id="new-ticket-btn"
            onClick={() => setIsCreateOpen(true)}
          >
            Neues Ticket
          </button>
        </div>
      </header>

      {successMessage && (
        <div className="alert alert-success" role="status">
          <span>{successMessage}</span>
          <button
            type="button"
            className="alert-close"
            aria-label="Meldung schließen"
            onClick={() => setSuccessMessage(null)}
          >
            ×
          </button>
        </div>
      )}

      {!token ? (
        <div className="card">
          Bitte melden Sie sich an, um die Ticketliste zu sehen.
        </div>
      ) : (
        <section className="tickets-list-section" data-od-id="tickets-list-section">
          <div className="toolbar" data-od-id="toolbar">
            <div className="search-wrap">
              <svg
                className="search-icon"
                viewBox="0 0 20 20"
                width="16"
                height="16"
                aria-hidden="true"
                focusable="false"
              >
                <circle
                  cx="9"
                  cy="9"
                  r="5.25"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                />
                <path
                  d="M13 13l4 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
              <input
                className="input search-input"
                type="search"
                value={searchText}
                placeholder="Titel oder Beschreibung suchen"
                aria-label="Titel oder Beschreibung suchen"
                onChange={(event) => setSearchText(event.target.value)}
              />
            </div>

            <select
              className="select toolbar-select"
              value={statusParam}
              aria-label="Nach Status filtern"
              onChange={(event) =>
                updateParams({ status: event.target.value || null })
              }
            >
              <option value="">Status: Alle</option>
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </select>

            <select
              className="select toolbar-select"
              value={priorityParam}
              aria-label="Nach Priorität filtern"
              onChange={(event) =>
                updateParams({ priority: event.target.value || null })
              }
            >
              <option value="">Priorität: Alle</option>
              {PRIORITY_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABELS[value]}
                </option>
              ))}
            </select>

            <select
              className="select toolbar-select"
              value={assigneeParam ?? ''}
              aria-label="Nach Zuständigkeit filtern"
              disabled={!canFilterAssignee}
              title={
                canFilterAssignee
                  ? undefined
                  : 'Nur Agenten und Administratoren können nach Zuständigkeit filtern'
              }
              onChange={(event) =>
                updateParams({ assignee_id: event.target.value || null })
              }
            >
              <option value="">Zuständigkeit: Alle</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.full_name}
                </option>
              ))}
            </select>

            <span className="toolbar-spacer" />

            <button
              type="button"
              className="btn btn-secondary"
              data-od-id="csv-export-btn"
              disabled={exportDisabled}
              title={
                exportDisabled
                  ? 'Kein Ergebnis für den Export vorhanden'
                  : 'Exportiert die aktuell gefilterte und sortierte Liste'
              }
              onClick={handleExport}
            >
              CSV exportieren
            </button>
          </div>

          {activeChips.length > 0 && (
            <div className="filter-chips" data-od-id="filter-chips">
              {activeChips.map((chip) => (
                <span key={chip.key} className="chip">
                  {chip.label}
                  <button
                    type="button"
                    aria-label={`Filter entfernen: ${chip.label}`}
                    onClick={() => updateParams({ [chip.key]: null })}
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="chip-reset"
                onClick={resetFilters}
              >
                Alle zurücksetzen
              </button>
            </div>
          )}

          <div className="result-count tnum">{total} Tickets</div>

          {loadError && (
            <div className="alert alert-danger" role="alert">
              {loadError}
            </div>
          )}

          <TicketTable
            tickets={items}
            sort={sortParam}
            order={orderParam}
            isLoading={isLoading}
            onSortChange={handleSortChange}
            onSelect={(ticket) => navigate(`/tickets/${ticket.id}`)}
            onResetFilters={resetFilters}
          />

          {/* DESIGN.md 'Pagination': with zero results render no pagination
              controls at all (AC-15) — only the '0 Tickets' count line above
              remains. */}
          {total > 0 && (
            <div className="pagination">
              <span className="pagination-info tnum">
                {`Zeige ${start}–${end} von ${total}`}
              </span>
              {/* The page-size select appears only once there is more than one page. */}
              {pages > 1 && (
                <select
                  className="select page-size-select"
                  value={pageSize}
                  aria-label="Einträge pro Seite"
                  onChange={(event) =>
                    updateParams({ page_size: event.target.value })
                  }
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              )}
              <div className="page-btns">
                <button
                  type="button"
                  className="page-btn page-arrow"
                  disabled={currentPage <= 1}
                  aria-label="Vorherige Seite"
                  onClick={() =>
                    updateParams(
                      { page: String(currentPage - 1) },
                      { resetPage: false },
                    )
                  }
                >
                  <svg
                    viewBox="0 0 20 20"
                    width="16"
                    height="16"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      d="M12.5 4.5 7 10l5.5 5.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {pageWindow(currentPage, pages).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    className={
                      pageNumber === currentPage ? 'page-btn active' : 'page-btn'
                    }
                    aria-current={pageNumber === currentPage ? 'page' : undefined}
                    onClick={() =>
                      updateParams(
                        { page: String(pageNumber) },
                        { resetPage: false },
                      )
                    }
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  type="button"
                  className="page-btn page-arrow"
                  disabled={currentPage >= pages}
                  aria-label="Nächste Seite"
                  onClick={() =>
                    updateParams(
                      { page: String(currentPage + 1) },
                      { resetPage: false },
                    )
                  }
                >
                  <svg
                    viewBox="0 0 20 20"
                    width="16"
                    height="16"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      d="M7.5 4.5 13 10l-5.5 5.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {isCreateOpen && (
        <TicketCreateForm
          token={token}
          onCreated={handleCreated}
          onCancel={() => setIsCreateOpen(false)}
        />
      )}
    </section>
  )
}
