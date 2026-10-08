import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Priority,
  type SortOrder,
  type Ticket,
  type TicketSort,
  type TicketStatus,
} from '../api/tickets'

const STATUS_CLASS: Record<TicketStatus, string> = {
  open: 'badge badge-status-offen',
  in_progress: 'badge badge-status-in_progress',
  closed: 'badge badge-status-closed',
}

const PRIORITY_CLASS: Record<Priority, string> = {
  critical: 'badge badge-priority-critical',
  high: 'badge badge-priority-high',
  medium: 'badge badge-priority-medium',
  low: 'badge badge-priority-low',
}

/** Local time as 'TT.MM.JJJJ, HH:MM' (DESIGN.md — one format for the product). */
export function formatDateTime(iso: string | null): string {
  if (!iso) {
    return '—'
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  const pad = (value: number): string => String(value).padStart(2, '0')
  return (
    `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

interface TicketTableProps {
  tickets: Ticket[]
  sort: TicketSort
  order: SortOrder
  isLoading: boolean
  onSortChange: (sort: TicketSort) => void
  onSelect: (ticket: Ticket) => void
  onResetFilters: () => void
}

function SortHeader({
  sortKey,
  label,
  sort,
  order,
  onSortChange,
}: {
  sortKey: TicketSort
  label: string
  sort: TicketSort
  order: SortOrder
  onSortChange: (sort: TicketSort) => void
}) {
  const active = sort === sortKey
  return (
    <th aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={active ? 'sort-header active' : 'sort-header'}
        onClick={() => onSortChange(sortKey)}
      >
        {label}
        <span className="sort-caret" aria-hidden="true">
          {active && order === 'asc' ? '▲' : active ? '▼' : ''}
        </span>
      </button>
    </th>
  )
}

/**
 * Ticket data table: sortable headers, overdue marking from `is_overdue`,
 * a row per ticket opening the detail page, and the filtered empty state.
 */
export default function TicketTable({
  tickets,
  sort,
  order,
  isLoading,
  onSortChange,
  onSelect,
  onResetFilters,
}: TicketTableProps) {
  if (isLoading && tickets.length === 0) {
    return (
      <div
        className="data-table"
        data-testid="ticket-table-wrap"
        data-od-id="ticket-table-wrap"
      >
        <div className="skeleton-table" aria-hidden="true">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="skeleton-row" />
          ))}
        </div>
        <span className="visually-hidden">Tickets werden geladen</span>
      </div>
    )
  }

  if (!isLoading && tickets.length === 0) {
    return (
      <div
        className="data-table"
        data-testid="ticket-table-wrap"
        data-od-id="ticket-table-wrap"
      >
        <div className="tickets-empty">
          <h3>Keine Tickets gefunden</h3>
          <p>Für die aktuellen Filter gibt es keine Treffer.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onResetFilters}
          >
            Filter zurücksetzen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="data-table"
      data-testid="ticket-table-wrap"
      data-od-id="ticket-table-wrap"
    >
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th className="col-title">Titel</th>
              <th>Kategorie</th>
              <SortHeader
                sortKey="priority"
                label="Priorität"
                sort={sort}
                order={order}
                onSortChange={onSortChange}
              />
              <th>Status</th>
              <th>Zuständig</th>
              <SortHeader
                sortKey="due_at"
                label="Fälligkeit"
                sort={sort}
                order={order}
                onSortChange={onSortChange}
              />
              <SortHeader
                sortKey="created_at"
                label="Erstellt am"
                sort={sort}
                order={order}
                onSortChange={onSortChange}
              />
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => {
              const rowClass = [
                ticket.status === 'closed' ? 'row-closed' : '',
                ticket.is_overdue ? 'row-overdue' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <tr
                  key={ticket.id}
                  className={rowClass || undefined}
                  tabIndex={0}
                  onClick={() => onSelect(ticket)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelect(ticket)
                    }
                  }}
                >
                  <td className="cell-id tnum">{ticket.id}</td>
                  <td className="col-title" title={ticket.title}>
                    {ticket.title}
                  </td>
                  <td>{CATEGORY_LABELS[ticket.category]}</td>
                  <td>
                    <span className={PRIORITY_CLASS[ticket.priority]}>
                      {ticket.priority === 'critical' && (
                        <span className="priority-dot" aria-hidden="true" />
                      )}
                      {PRIORITY_LABELS[ticket.priority]}
                    </span>
                  </td>
                  <td>
                    <span className={STATUS_CLASS[ticket.status]}>
                      {STATUS_LABELS[ticket.status]}
                    </span>{' '}
                    {ticket.is_overdue && (
                      <span className="badge badge-overdue">
                        <span aria-hidden="true">!</span>
                        überfällig
                      </span>
                    )}
                  </td>
                  <td>{ticket.assignee ? ticket.assignee.full_name : '—'}</td>
                  <td
                    className={
                      ticket.is_overdue
                        ? 'cell-due due-overdue tnum'
                        : 'cell-due tnum'
                    }
                  >
                    {formatDateTime(ticket.due_at)}
                  </td>
                  <td className="tnum">{formatDateTime(ticket.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
