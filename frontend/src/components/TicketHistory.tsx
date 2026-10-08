import { useEffect, useState, type CSSProperties } from 'react'
import { useAuth } from '../state/AuthContext'
import {
  FIELD_LABELS,
  formatDateTime,
  formatHistoryValue,
  listTicketHistory,
  type HistoryEntry,
} from '../api/ticketDetail'

const HISTORY_PREVIEW = 5

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
}

const entryStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: 'var(--space-2)',
  padding: '11px 0',
  borderBottom: '1px solid var(--color-border)',
  fontSize: 'var(--size-sm)',
}

const timeStyle: CSSProperties = {
  flex: '0 0 150px',
  color: 'var(--color-fg-muted)',
  fontVariantNumeric: 'tabular-nums',
}

const actorStyle: CSSProperties = {
  flex: '0 0 140px',
  fontWeight: 500,
  color: 'var(--color-fg)',
}

const changeStyle: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  color: 'var(--color-fg)',
}

const oldStyle: CSSProperties = {
  color: 'var(--color-fg-subtle)',
  textDecoration: 'line-through',
}

const newStyle: CSSProperties = {
  fontWeight: 500,
  color: 'var(--color-fg)',
}

const emptyStyle: CSSProperties = {
  padding: 'var(--space-6) var(--space-4)',
  textAlign: 'center',
  fontSize: 'var(--size-base)',
  color: 'var(--color-fg-muted)',
}

const toggleRowStyle: CSSProperties = {
  marginTop: 'var(--space-2)',
}

/**
 * The 'Änderungsprotokoll' section of the ticket detail view: every logged
 * change (status, priority, category, assignee) with local timestamp, actor and
 * the old → new value, newest first.
 */
export default function TicketHistory({
  ticketId,
  refreshKey = 0,
}: {
  ticketId: number
  refreshKey?: number
}) {
  const { token } = useAuth()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadError(null)
    listTicketHistory(ticketId, token)
      .then((loaded) => {
        if (!cancelled) {
          setEntries(loaded)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(
            'Das Änderungsprotokoll konnte nicht geladen werden. Bitte versuchen Sie es erneut.',
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
  }, [ticketId, token, refreshKey])

  // The API returns oldest first; the audit log is shown newest first.
  const ordered = [...entries].reverse()
  const visible = showAll ? ordered : ordered.slice(0, HISTORY_PREVIEW)

  return (
    <section className="card" data-od-id="audit-section" data-testid="ticket-history">
      <div className="card-title">Änderungsprotokoll</div>

      {isLoading ? (
        <p style={emptyStyle}>Änderungsprotokoll wird geladen …</p>
      ) : loadError ? (
        <p className="field-error" role="alert">
          {loadError}
        </p>
      ) : ordered.length === 0 ? (
        <p style={emptyStyle} data-testid="history-empty">
          Noch keine Änderungen — das Protokoll füllt sich mit der ersten Bearbeitung.
        </p>
      ) : (
        <>
          <div style={listStyle} data-testid="history-list">
            {visible.map((entry, index) => (
              <div
                key={`${entry.field}-${entry.created_at}-${index}`}
                style={entryStyle}
                data-testid="history-entry"
              >
                <span style={timeStyle}>{formatDateTime(entry.created_at)}</span>
                <span style={actorStyle}>{entry.actor.full_name}</span>
                <span style={changeStyle}>
                  {FIELD_LABELS[entry.field] ?? entry.field}:{' '}
                  <span style={oldStyle}>
                    {formatHistoryValue(entry.field, entry.old_value)}
                  </span>{' '}
                  → <span style={newStyle}>{formatHistoryValue(entry.field, entry.new_value)}</span>
                </span>
              </div>
            ))}
          </div>
          {ordered.length > HISTORY_PREVIEW && (
            <div style={toggleRowStyle}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowAll((current) => !current)}
              >
                {showAll
                  ? 'Weniger anzeigen'
                  : `Alle ${ordered.length} Einträge anzeigen`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
