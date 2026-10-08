import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import {
  CATEGORY_LABELS,
  createTicket,
  PRIORITY_LABELS,
  type Category,
  type Priority,
  type Ticket,
} from '../api/tickets'

type FieldName = 'title' | 'description' | 'category' | 'priority'

const CATEGORY_OPTIONS: Category[] = [
  'hardware',
  'software',
  'network',
  'access',
  'other',
]

const PRIORITY_OPTIONS: Priority[] = ['critical', 'high', 'medium', 'low']

const REQUIRED_MESSAGES: Record<FieldName, string> = {
  title: 'Bitte geben Sie einen Titel ein.',
  description: 'Bitte geben Sie eine Beschreibung ein.',
  category: 'Bitte wählen Sie eine Kategorie.',
  priority: 'Bitte wählen Sie eine Priorität.',
}

interface TicketCreateFormProps {
  token: string | null
  onCreated: (ticket: Ticket) => void
  onCancel: () => void
}

/**
 * Modal dialog to create a ticket (Titel, Beschreibung, Kategorie, Priorität).
 * Validation feedback appears only after a field was touched or the form was
 * submitted (AC-14); the field messages are German.
 */
export default function TicketCreateForm({
  token,
  onCreated,
  onCancel,
}: TicketCreateFormProps) {
  const [values, setValues] = useState<Record<FieldName, string>>({
    title: '',
    description: '',
    category: '',
    priority: '',
  })
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({
    title: false,
    description: false,
    category: false,
    priority: false,
  })
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const setField = (name: FieldName, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setServerErrors((prev) => {
      if (!prev[name]) {
        return prev
      }
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const markTouched = (name: FieldName) => {
    setTouched((prev) => ({ ...prev, [name]: true }))
  }

  const fieldError = (name: FieldName): string | null => {
    if (serverErrors[name]) {
      return serverErrors[name]
    }
    if (!(touched[name] || submitted)) {
      return null
    }
    return values[name].trim() === '' ? REQUIRED_MESSAGES[name] : null
  }

  const hasError = (name: FieldName): boolean =>
    fieldError(name) !== null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    setFormError(null)

    const invalidField = (
      ['title', 'description', 'category', 'priority'] as FieldName[]
    ).find((name) => values[name].trim() === '')

    if (invalidField) {
      setFormError('Bitte korrigieren Sie die markierten Felder.')
      document
        .querySelector<HTMLElement>(`[data-field="${invalidField}"]`)
        ?.focus()
      return
    }

    setIsSubmitting(true)
    try {
      const ticket = await createTicket(
        {
          title: values.title.trim(),
          description: values.description.trim(),
          category: values.category as Category,
          priority: values.priority as Priority,
        },
        token,
      )
      onCreated(ticket)
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const fields = Object.keys(error.fields).length > 0 ? error.fields : {}
        setServerErrors(fields)
        setFormError(
          Object.keys(fields).length > 0
            ? 'Bitte korrigieren Sie die markierten Felder.'
            : error.message,
        )
      } else {
        setFormError(
          error instanceof Error
            ? error.message
            : 'Das Ticket konnte nicht angelegt werden. Bitte versuchen Sie es erneut.',
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-ticket-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="new-ticket-title">Neues Ticket</h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Schließen"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            {formError && (
              <div className="alert alert-danger" role="alert">
                {formError}
              </div>
            )}

            <div className="field">
              <label className="field-label" htmlFor="nt-title">
                Titel
              </label>
              <input
                id="nt-title"
                data-field="title"
                className="input"
                type="text"
                value={values.title}
                placeholder="Kurze Beschreibung des Anliegens"
                aria-invalid={hasError('title')}
                onChange={(event) => setField('title', event.target.value)}
                onBlur={() => markTouched('title')}
              />
              {fieldError('title') && (
                <p className="field-error">{fieldError('title')}</p>
              )}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="nt-description">
                Beschreibung
              </label>
              <textarea
                id="nt-description"
                data-field="description"
                className="textarea"
                value={values.description}
                placeholder="Beschreiben Sie das Problem so genau wie möglich"
                aria-invalid={hasError('description')}
                onChange={(event) =>
                  setField('description', event.target.value)
                }
                onBlur={() => markTouched('description')}
              />
              {fieldError('description') && (
                <p className="field-error">{fieldError('description')}</p>
              )}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="nt-category">
                Kategorie
              </label>
              <select
                id="nt-category"
                data-field="category"
                className="select"
                value={values.category}
                aria-invalid={hasError('category')}
                onChange={(event) => setField('category', event.target.value)}
                onBlur={() => markTouched('category')}
              >
                <option value="">Bitte wählen …</option>
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
              {fieldError('category') && (
                <p className="field-error">{fieldError('category')}</p>
              )}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="nt-priority">
                Priorität
              </label>
              <select
                id="nt-priority"
                data-field="priority"
                className="select"
                value={values.priority}
                aria-invalid={hasError('priority')}
                onChange={(event) => setField('priority', event.target.value)}
                onBlur={() => markTouched('priority')}
              >
                <option value="">Bitte wählen …</option>
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </select>
              <p className="field-helper">
                Fälligkeit: kritisch 4 Stunden, hoch 1 Tag, mittel 3 Tage,
                niedrig 7 Tage.
              </p>
              {fieldError('priority') && (
                <p className="field-error">{fieldError('priority')}</p>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onCancel}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Wird erstellt …' : 'Ticket erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
