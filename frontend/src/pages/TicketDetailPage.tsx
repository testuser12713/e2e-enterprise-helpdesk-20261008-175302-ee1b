import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import CommentSection from '../components/CommentSection'
import TicketHistory from '../components/TicketHistory'
import { ApiError } from '../api/client'
import { useAuth, type User } from '../state/AuthContext'
import {
  assignTicket,
  CATEGORY_LABELS,
  closeTicket,
  formatDateTime,
  formatOverdueSince,
  getTicket,
  listAssignableUsers,
  PRIORITY_LABELS,
  STATUS_LABELS,
  updateTicket,
  type Category,
  type Priority,
  type Ticket,
} from '../api/ticketDetail'

const CATEGORY_OPTIONS: Category[] = ['hardware', 'software', 'network', 'access', 'other']
const PRIORITY_OPTIONS: Priority[] = ['critical', 'high', 'medium', 'low']

interface Feedback {
  type: 'success' | 'error'
  text: string
}

function statusBadgeClass(status: Ticket['status']): string {
  return `badge badge-status-${status}`
}

function StatusBadge({ status }: { status: Ticket['status'] }) {
  return <span className={statusBadgeClass(status)}>{STATUS_LABELS[status]}</span>
}

function PriorityBadge({ priority }: { priority: Ticket['priority'] }) {
  return (
    <span className={`badge badge-priority-${priority}`}>
      {priority === 'critical' && (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: 'var(--radius-pill)',
            background: 'currentColor',
            display: 'inline-block',
          }}
        />
      )}
      {PRIORITY_LABELS[priority]}
    </span>
  )
}

function OverdueBadge() {
  return (
    <span className="badge badge-overdue">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: 12, height: 12 }}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      überfällig
    </span>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={factLabelStyle}>{label}</div>
      <div style={factValueStyle}>{children}</div>
    </div>
  )
}

/** Modal guard for the state-changing close action (DESIGN.md ConfirmDialog). */
function ConfirmDialog({
  title,
  children,
  confirmLabel,
  isBusy,
  onConfirm,
  onCancel,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  isBusy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-confirm-title"
      onClick={onCancel}
    >
      <div style={panelStyle} onClick={(event) => event.stopPropagation()}>
        <h2 id="close-confirm-title" style={{ fontSize: 'var(--size-lg)' }}>
          {title}
        </h2>
        <div style={{ margin: 'var(--space-2) 0 var(--space-4)', color: 'var(--color-fg-muted)' }}>
          {children}
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            autoFocus
            disabled={isBusy}
          >
            Abbrechen
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={isBusy}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * The ticket detail view: facts plus the edit/assign/close actions on the left,
 * the comment column on the right, and the change log below the facts.
 * Region names follow `design/mockups/ticket-detail.html`.
 */
export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const ticketId = Number(id)
  const { user, token } = useAuth()

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<Category>('other')
  const [priority, setPriority] = useState<Priority>('medium')
  const [titleTouched, setTitleTouched] = useState(false)
  const [titleError, setTitleError] = useState<string | null>(null)

  const [assignable, setAssignable] = useState<User[]>([])
  const [selectedAssignee, setSelectedAssignee] = useState('')

  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)

  const isMelder = user?.role === 'melder'
  const isClosed = ticket?.status === 'closed'

  const applyTicketToForm = useCallback((value: Ticket) => {
    setTitle(value.title)
    setDescription(value.description)
    setCategory(value.category)
    setPriority(value.priority)
    setSelectedAssignee(value.assignee ? String(value.assignee.id) : '')
    setTitleError(null)
    setTitleTouched(false)
  }, [])

  useEffect(() => {
    if (!Number.isFinite(ticketId)) {
      setIsLoading(false)
      setLoadError('Dieses Ticket existiert nicht.')
      return
    }
    let cancelled = false
    setIsLoading(true)
    setLoadError(null)
    getTicket(ticketId, token)
      .then((loaded) => {
        if (!cancelled) {
          setTicket(loaded)
          applyTicketToForm(loaded)
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        if (error instanceof ApiError && error.status === 404) {
          setLoadError('Dieses Ticket wurde nicht gefunden.')
        } else if (error instanceof ApiError && error.status === 403) {
          setLoadError('Sie haben keinen Zugriff auf dieses Ticket.')
        } else {
          setLoadError(
            'Das Ticket konnte nicht geladen werden. Bitte versuchen Sie es erneut.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [ticketId, token, applyTicketToForm])

  useEffect(() => {
    if (isMelder) {
      return
    }
    let cancelled = false
    listAssignableUsers(token)
      .then((users) => {
        if (!cancelled) {
          setAssignable(users)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAssignable([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [isMelder, token])

  const selectableUsers = useMemo(() => {
    // Keep the current assignee visible even if they are not (yet) in the list.
    const current = ticket?.assignee
    if (current && !assignable.some((candidate) => candidate.id === current.id)) {
      return [current, ...assignable]
    }
    return assignable
  }, [assignable, ticket])

  const handleEditSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!ticket || isSaving || isClosed) {
        return
      }
      setTitleTouched(true)
      const trimmedTitle = title.trim()
      if (trimmedTitle === '') {
        setTitleError('Bitte geben Sie einen Titel ein.')
        setFeedback({ type: 'error', text: 'Bitte geben Sie einen Titel ein.' })
        return
      }
      setTitleError(null)
      setIsSaving(true)
      setFeedback(null)
      try {
        const updated = await updateTicket(
          ticketId,
          { title: trimmedTitle, description, category, priority },
          token,
        )
        setTicket(updated)
        applyTicketToForm(updated)
        setHistoryVersion((current) => current + 1)
        setFeedback({ type: 'success', text: 'Ticket wurde gespeichert.' })
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : 'Das Ticket konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.'
        if (error instanceof ApiError && error.fields.title) {
          setTitleError(error.fields.title)
        }
        setFeedback({ type: 'error', text: message })
      } finally {
        setIsSaving(false)
      }
    },
    [applyTicketToForm, category, description, isClosed, isSaving, priority, ticket, ticketId, title, token],
  )

  const handleAssign = useCallback(async () => {
    if (!ticket || isAssigning || isClosed) {
      return
    }
    if (selectedAssignee === '') {
      setFeedback({ type: 'error', text: 'Bitte wählen Sie eine zuständige Person.' })
      return
    }
    setIsAssigning(true)
    setFeedback(null)
    try {
      const updated = await assignTicket(ticketId, Number(selectedAssignee), token)
      setTicket(updated)
      applyTicketToForm(updated)
      setHistoryVersion((current) => current + 1)
      setFeedback({
        type: 'success',
        text: `Zuweisung aktualisiert: ${updated.assignee?.full_name ?? ''}.`,
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        text:
          error instanceof ApiError
            ? error.message
            : 'Die Zuweisung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.',
      })
    } finally {
      setIsAssigning(false)
    }
  }, [applyTicketToForm, isAssigning, isClosed, selectedAssignee, ticket, ticketId, token])

  const handleClose = useCallback(async () => {
    if (!ticket || isClosing) {
      return
    }
    setIsClosing(true)
    setFeedback(null)
    try {
      const updated = await closeTicket(ticketId, token)
      setTicket(updated)
      applyTicketToForm(updated)
      setHistoryVersion((current) => current + 1)
      setShowCloseConfirm(false)
      setFeedback({ type: 'success', text: 'Ticket wurde geschlossen.' })
    } catch (error) {
      setShowCloseConfirm(false)
      setFeedback({
        type: 'error',
        text:
          error instanceof ApiError
            ? error.message
            : 'Das Ticket konnte nicht geschlossen werden. Bitte versuchen Sie es erneut.',
      })
    } finally {
      setIsClosing(false)
    }
  }, [applyTicketToForm, isClosing, ticket, ticketId, token])

  const titleInvalid = titleTouched && title.trim() === ''

  if (isLoading) {
    return (
      <section className="page-section" data-testid="page-ticket-detail">
        <div className="card">Ticket wird geladen …</div>
      </section>
    )
  }

  if (loadError || !ticket) {
    return (
      <section className="page-section" data-testid="page-ticket-detail">
        <Link className="back-link" to="/tickets" data-od-id="back-to-tickets">
          ← Zurück zu Tickets
        </Link>
        <div className="alert alert-danger" role="alert">
          {loadError ?? 'Das Ticket konnte nicht geladen werden.'}
        </div>
      </section>
    )
  }

  const showOverdue = ticket.is_overdue

  return (
    <section className="page-section" data-testid="page-ticket-detail">
      <Link className="back-link" to="/tickets" data-od-id="back-to-tickets">
        ← Zurück zu Tickets
      </Link>

      <header className="page-header" data-od-id="page-header">
        <div>
          <h1 data-od-id="page-title" data-testid="page-title">
            {ticket.title}
          </h1>
          <div className="badge-row" style={badgeRowStyle}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--size-sm)',
                color: 'var(--color-fg-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              T-{ticket.id}
            </span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            {showOverdue && <OverdueBadge />}
          </div>
        </div>
      </header>

      <div style={gridStyle} data-od-id="detail-grid">
        <div style={leftColumnStyle}>
          <section
            className="card"
            data-od-id="ticket-data-card"
            style={isClosed ? { color: 'var(--color-fg-muted)' } : undefined}
          >
            <div className="card-title">Beschreibung</div>
            <p style={descriptionStyle}>{ticket.description || '—'}</p>

            <div style={factsStyle} data-od-id="ticket-facts">
              <Fact label="Kategorie">{CATEGORY_LABELS[ticket.category]}</Fact>
              <Fact label="Priorität">
                <PriorityBadge priority={ticket.priority} />
              </Fact>
              <Fact label="Status">
                <StatusBadge status={ticket.status} />
              </Fact>
              <Fact label="Zuständig">{ticket.assignee?.full_name ?? 'Nicht zugewiesen'}</Fact>
              <Fact label="Erstellt am">{formatDateTime(ticket.created_at)}</Fact>
              <Fact label="Fällig am">
                <span
                  style={
                    showOverdue
                      ? { color: 'var(--color-danger)', fontWeight: 500 }
                      : undefined
                  }
                >
                  {formatDateTime(ticket.due_at)}
                </span>
              </Fact>
              {showOverdue && ticket.due_at && (
                <Fact label="Überfällig seit">
                  <span style={{ color: 'var(--color-danger)' }}>
                    {formatOverdueSince(ticket.due_at)}
                  </span>
                </Fact>
              )}
              {isClosed && ticket.closed_at && (
                <Fact label="Geschlossen am">
                  <span data-testid="closed-at">{formatDateTime(ticket.closed_at)}</span>
                </Fact>
              )}
              <Fact label="Erstellt von">#{ticket.created_by}</Fact>
            </div>

            {!isMelder && (
              <div style={actionsStyle} data-od-id="ticket-actions">
                <form onSubmit={handleEditSubmit} style={editFormStyle} noValidate>
                  <div className="field">
                    <label className="field-label" htmlFor="edit-title">
                      Titel
                    </label>
                    <input
                      id="edit-title"
                      className="input"
                      type="text"
                      value={title}
                      disabled={isClosed || isSaving}
                      aria-invalid={titleInvalid}
                      aria-describedby={titleInvalid ? 'edit-title-error' : undefined}
                      onChange={(event) => setTitle(event.target.value)}
                      onBlur={() => {
                        setTitleTouched(true)
                        setTitleError(title.trim() === '' ? 'Bitte geben Sie einen Titel ein.' : null)
                      }}
                    />
                    {titleError && (
                      <p className="field-error" id="edit-title-error" role="alert">
                        {titleError}
                      </p>
                    )}
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="edit-description">
                      Beschreibung
                    </label>
                    <textarea
                      id="edit-description"
                      className="textarea"
                      value={description}
                      disabled={isClosed || isSaving}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="edit-category">
                      Kategorie
                    </label>
                    <select
                      id="edit-category"
                      className="select"
                      value={category}
                      disabled={isClosed || isSaving}
                      onChange={(event) => setCategory(event.target.value as Category)}
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {CATEGORY_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="edit-priority">
                      Priorität
                    </label>
                    <select
                      id="edit-priority"
                      className="select"
                      value={priority}
                      disabled={isClosed || isSaving}
                      onChange={(event) => setPriority(event.target.value as Priority)}
                    >
                      {PRIORITY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {PRIORITY_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isClosed || isSaving}
                      title={
                        isClosed ? 'Das Ticket ist bereits geschlossen.' : undefined
                      }
                    >
                      {isSaving ? 'Speichern …' : 'Speichern'}
                    </button>
                  </div>
                </form>

                <div style={assignRowStyle}>
                  <div className="field assign-wrap" style={{ marginBottom: 0, minWidth: 200 }}>
                    <label className="field-label" htmlFor="assign-select">
                      Zuweisung
                    </label>
                    <select
                      id="assign-select"
                      className="select"
                      value={selectedAssignee}
                      disabled={isClosed || isAssigning}
                      onChange={(event) => setSelectedAssignee(event.target.value)}
                    >
                      <option value="">Nicht zugewiesen</option>
                      {selectableUsers.map((candidate) => (
                        <option key={candidate.id} value={String(candidate.id)}>
                          {candidate.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-od-id="assign-save-btn"
                    onClick={handleAssign}
                    disabled={isClosed || isAssigning}
                    title={isClosed ? 'Das Ticket ist bereits geschlossen.' : undefined}
                  >
                    Zuweisung speichern
                  </button>
                  <span style={{ flex: 1 }} />
                  <button
                    type="button"
                    className="btn btn-danger"
                    data-od-id="close-ticket-btn"
                    onClick={() => setShowCloseConfirm(true)}
                    disabled={isClosed || isClosing}
                    title={isClosed ? 'Das Ticket ist bereits geschlossen.' : undefined}
                  >
                    Ticket schließen
                  </button>
                </div>
              </div>
            )}
          </section>

          <TicketHistory ticketId={ticketId} refreshKey={historyVersion} />
        </div>

        <div style={rightColumnStyle}>
          <CommentSection ticketId={ticketId} />
        </div>
      </div>

      {feedback && (
        <div
          className={`alert ${feedback.type === 'success' ? 'alert-success' : 'alert-danger'}`}
          role={feedback.type === 'error' ? 'alert' : 'status'}
          data-testid="ticket-feedback"
        >
          {feedback.text}
        </div>
      )}

      {showCloseConfirm && (
        <ConfirmDialog
          title="Ticket schließen?"
          confirmLabel="Ticket schließen"
          isBusy={isClosing}
          onConfirm={handleClose}
          onCancel={() => setShowCloseConfirm(false)}
        >
          Sind Sie sicher, dass Sie das Ticket „{ticket.title}“ schließen möchten? Dieser Vorgang
          wird im Änderungsprotokoll vermerkt.
        </ConfirmDialog>
      )}
    </section>
  )
}

const badgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--space-1)',
  margin: 'var(--space-2) 0 0',
}

const gridStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: 'var(--space-4)',
}

const leftColumnStyle: CSSProperties = {
  flex: '1 1 560px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
}

const rightColumnStyle: CSSProperties = {
  flex: '1 1 320px',
  minWidth: 0,
}

const descriptionStyle: CSSProperties = {
  margin: '0 0 var(--space-4)',
  maxWidth: '72ch',
  whiteSpace: 'pre-wrap',
}

const factsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 'var(--space-3)',
}

const factLabelStyle: CSSProperties = {
  fontSize: 'var(--size-xs)',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--color-fg-muted)',
  marginBottom: 2,
}

const factValueStyle: CSSProperties = {
  fontSize: 'var(--size-base)',
  fontVariantNumeric: 'tabular-nums',
}

const actionsStyle: CSSProperties = {
  marginTop: 'var(--space-4)',
  paddingTop: 'var(--space-3)',
  borderTop: '1px solid var(--color-border)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
}

const editFormStyle: CSSProperties = {
  maxWidth: 640,
}

const assignRowStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-2)',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(26, 29, 33, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-3)',
  zIndex: 50,
}

const panelStyle: CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-4)',
  maxWidth: 440,
  width: '100%',
}
