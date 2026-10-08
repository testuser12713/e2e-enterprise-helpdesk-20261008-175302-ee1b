import { useRef, useState } from 'react'
import { ApiError } from '../api/client'
import { createUser, type ManagedUser } from '../api/users'
import { useAuth, type Role } from '../state/AuthContext'

/** German labels for the API's role values. */
export const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: 'melder', label: 'Melder' },
  { value: 'agent', label: 'Agent' },
  { value: 'admin', label: 'Administrator' },
]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldName = 'full_name' | 'email' | 'role' | 'password'

interface FieldErrors {
  full_name?: string
  email?: string
  role?: string
  password?: string
}

interface UserFormProps {
  /** Called with the freshly created user after a successful request. */
  onCreated: (user: ManagedUser) => void
  /** Called when the user dismisses the form. */
  onCancel: () => void
}

/**
 * "Benutzer anlegen" form: Name, E-Mail, Rolle and an initial password.
 * A field stays neutral until it was touched (blur) or the form was submitted;
 * server-side 422/409 field errors are mapped onto the same rendering.
 */
export default function UserForm({ onCreated, onCancel }: UserFormProps) {
  const { token } = useAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [password, setPassword] = useState('')

  const [touched, setTouched] = useState<Record<FieldName, boolean>>({
    full_name: false,
    email: false,
    role: false,
    password: false,
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const roleRef = useRef<HTMLSelectElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  function validate(values: {
    full_name: string
    email: string
    role: Role | ''
    password: string
  }): FieldErrors {
    const next: FieldErrors = {}
    if (values.full_name.trim() === '') {
      next.full_name = 'Bitte geben Sie einen Namen ein.'
    }
    if (!EMAIL_PATTERN.test(values.email.trim())) {
      next.email = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
    }
    if (values.role === '') {
      next.role = 'Bitte wählen Sie eine Rolle.'
    }
    if (values.password.length < 8) {
      next.password = 'Das Passwort muss mindestens 8 Zeichen lang sein.'
    }
    return next
  }

  function markTouched(field: FieldName) {
    setTouched((current) => ({ ...current, [field]: true }))
  }

  function revalidate(
    field: FieldName,
    values: { full_name: string; email: string; role: Role | ''; password: string },
  ) {
    const next = validate(values)
    setErrors((current) => ({ ...current, [field]: next[field] }))
  }

  function applyServerErrors(error: ApiError) {
    const mapped: FieldErrors = {}
    const known: FieldName[] = ['full_name', 'email', 'role', 'password']
    for (const [key, message] of Object.entries(error.fields)) {
      if ((known as string[]).includes(key)) {
        mapped[key as FieldName] = message
      }
    }
    if (error.status === 409 && !mapped.email) {
      mapped.email = error.message || 'Diese E-Mail-Adresse wird bereits verwendet.'
    }
    return mapped
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTouched({ full_name: true, email: true, role: true, password: true })
    setFormError(null)

    const validation = validate({ full_name: fullName, email, role, password })
    if (Object.keys(validation).length > 0) {
      setErrors(validation)
      setFormError('Bitte korrigieren Sie die markierten Felder.')
      if (validation.full_name) {
        nameRef.current?.focus()
      } else if (validation.email) {
        emailRef.current?.focus()
      } else if (validation.role) {
        roleRef.current?.focus()
      } else if (validation.password) {
        passwordRef.current?.focus()
      }
      return
    }

    setSubmitting(true)
    try {
      const created = await createUser(token, {
        email: email.trim(),
        full_name: fullName.trim(),
        password,
        role: role as Role,
      })
      onCreated(created)
    } catch (error) {
      if (error instanceof ApiError) {
        const mapped = applyServerErrors(error)
        if (Object.keys(mapped).length > 0) {
          setErrors(mapped)
        }
        setFormError(error.message)
      } else {
        setFormError(
          'Der Benutzer konnte nicht angelegt werden. Bitte versuchen Sie es erneut.',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="card" data-testid="user-form">
      <h2 className="card-title">Benutzer anlegen</h2>

      {formError && (
        <div className="alert alert-danger" role="alert">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="user-name">
            Name
          </label>
          <input
            ref={nameRef}
            id="user-name"
            className="input"
            type="text"
            value={fullName}
            placeholder="Vor- und Nachname"
            aria-invalid={touched.full_name && Boolean(errors.full_name)}
            aria-describedby={errors.full_name ? 'user-name-error' : undefined}
            onChange={(event) => {
              const value = event.target.value
              setFullName(value)
              if (touched.full_name) {
                revalidate('full_name', { full_name: value, email, role, password })
              }
            }}
            onBlur={() => {
              markTouched('full_name')
              revalidate('full_name', { full_name: fullName, email, role, password })
            }}
          />
          {touched.full_name && errors.full_name && (
            <p className="field-error" id="user-name-error">
              {errors.full_name}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="user-email">
            E-Mail-Adresse
          </label>
          <input
            ref={emailRef}
            id="user-email"
            className="input"
            type="email"
            value={email}
            placeholder="name@nordwerk.de"
            aria-invalid={touched.email && Boolean(errors.email)}
            aria-describedby={errors.email ? 'user-email-error' : undefined}
            onChange={(event) => {
              const value = event.target.value
              setEmail(value)
              if (touched.email) {
                revalidate('email', { full_name: fullName, email: value, role, password })
              }
            }}
            onBlur={() => {
              markTouched('email')
              revalidate('email', { full_name: fullName, email, role, password })
            }}
          />
          {touched.email && errors.email && (
            <p className="field-error" id="user-email-error">
              {errors.email}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="user-role">
            Rolle
          </label>
          <select
            ref={roleRef}
            id="user-role"
            className="select"
            value={role}
            aria-invalid={touched.role && Boolean(errors.role)}
            aria-describedby={errors.role ? 'user-role-error' : undefined}
            onChange={(event) => {
              const value = event.target.value as Role | ''
              setRole(value)
              if (touched.role) {
                revalidate('role', { full_name: fullName, email, role: value, password })
              }
            }}
            onBlur={() => {
              markTouched('role')
              revalidate('role', { full_name: fullName, email, role, password })
            }}
          >
            <option value="">Bitte wählen …</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {touched.role && errors.role && (
            <p className="field-error" id="user-role-error">
              {errors.role}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="user-password">
            Initiales Passwort
          </label>
          <input
            ref={passwordRef}
            id="user-password"
            className="input"
            type="password"
            value={password}
            placeholder="Mindestens 8 Zeichen"
            aria-invalid={touched.password && Boolean(errors.password)}
            aria-describedby={errors.password ? 'user-password-error' : undefined}
            onChange={(event) => {
              const value = event.target.value
              setPassword(value)
              if (touched.password) {
                revalidate('password', { full_name: fullName, email, role, password: value })
              }
            }}
            onBlur={() => {
              markTouched('password')
              revalidate('password', { full_name: fullName, email, role, password })
            }}
          />
          {touched.password && errors.password && (
            <p className="field-error" id="user-password-error">
              {errors.password}
            </p>
          )}
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={submitting}
          >
            Abbrechen
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Wird angelegt …' : 'Benutzer anlegen'}
          </button>
        </div>
      </form>
    </section>
  )
}
