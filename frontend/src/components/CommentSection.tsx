import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { ApiError } from '../api/client'
import { createComment, listComments, type Comment } from '../api/comments'
import { useAuth } from '../state/AuthContext'

/** Format an ISO-8601 UTC timestamp as local 'TT.MM.JJJJ, HH:MM'. */
function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const pad = (value: number) => String(value).padStart(2, '0')
  return (
    `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** Two initials from a full name, e.g. 'Jonas Becker' -> 'JB'. */
function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return '?'
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
}

const entryStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-2)',
}

const avatarStyle: CSSProperties = {
  width: 32,
  height: 32,
  flexShrink: 0,
  borderRadius: 'var(--radius-pill)',
  background: 'var(--color-accent-subtle)',
  color: 'var(--color-accent)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'var(--size-xs)',
  fontWeight: 600,
}

const headStyle: CSSProperties = {
  marginBottom: 2,
  fontSize: 'var(--size-sm)',
}

const authorStyle: CSSProperties = {
  fontWeight: 600,
  color: 'var(--color-fg)',
}

const timeStyle: CSSProperties = {
  fontSize: 'var(--size-xs)',
  color: 'var(--color-fg-muted)',
  fontVariantNumeric: 'tabular-nums',
}

const bodyStyle: CSSProperties = {
  fontSize: 'var(--size-base)',
  lineHeight: 'var(--line-height-base)',
  maxWidth: '72ch',
  color: 'var(--color-fg)',
}

const emptyStyle: CSSProperties = {
  padding: 'var(--space-6) var(--space-4)',
  textAlign: 'center',
  fontSize: 'var(--size-base)',
  color: 'var(--color-fg-muted)',
}

const composerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  marginTop: 'var(--space-3)',
}

/**
 * The comment column of the ticket detail view: chronological conversation
 * oldest first plus a composer that appends the returned comment immediately.
 */
export default function CommentSection({ ticketId }: { ticketId: number }) {
  const { token } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadError(null)
    listComments(ticketId, token)
      .then((loaded) => {
        if (!cancelled) {
          setComments(loaded)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(
            'Kommentare konnten nicht geladen werden. Bitte versuchen Sie es erneut.',
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
  }, [ticketId, token])

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const trimmed = body.trim()
      if (trimmed === '' || isSubmitting) {
        return
      }

      setIsSubmitting(true)
      setSubmitError(null)
      try {
        const created = await createComment(ticketId, trimmed, token)
        setComments((current) => [...current, created])
        setBody('')
        setSubmitError(null)
        inputRef.current?.focus()
      } catch (error) {
        setSubmitError(
          error instanceof ApiError
            ? error.message
            : 'Der Kommentar konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.',
        )
      } finally {
        setIsSubmitting(false)
      }
    },
    [body, isSubmitting, ticketId, token],
  )

  const isEmpty = body.trim() === ''

  return (
    <section className="card" data-testid="comment-section" data-ticket-id={ticketId}>
      <div className="card-title">Kommentare</div>

      {isLoading ? (
        <p style={emptyStyle}>Kommentare werden geladen …</p>
      ) : loadError ? (
        <p className="field-error" role="alert">
          {loadError}
        </p>
      ) : comments.length === 0 ? (
        <p style={emptyStyle} data-testid="comment-empty">
          Noch keine Kommentare — schreiben Sie den ersten.
        </p>
      ) : (
        <ul style={listStyle}>
          {comments.map((comment) => (
            <li key={comment.id} style={entryStyle} data-testid="comment-item">
              <span style={avatarStyle} aria-hidden="true">
                {initials(comment.author.full_name)}
              </span>
              <div>
                <div style={headStyle}>
                  <span style={authorStyle}>{comment.author.full_name}</span>
                  {' · '}
                  <span style={timeStyle}>
                    {formatTimestamp(comment.created_at)}
                  </span>
                </div>
                <div style={bodyStyle}>{comment.body}</div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form style={composerStyle} onSubmit={handleSubmit}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label" htmlFor="comment-input">
            Kommentar abschreiben
          </label>
          <textarea
            id="comment-input"
            ref={inputRef}
            className="textarea"
            placeholder="Ihre Antwort …"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          {submitError && (
            <p className="field-error" role="alert">
              {submitError}
            </p>
          )}
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          style={{ alignSelf: 'flex-end' }}
          disabled={isEmpty || isSubmitting}
          title={isEmpty ? 'Bitte geben Sie einen Kommentar ein.' : undefined}
        >
          Kommentar abschreiben
        </button>
      </form>
    </section>
  )
}
