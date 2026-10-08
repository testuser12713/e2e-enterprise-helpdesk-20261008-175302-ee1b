import {
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type RefObject,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../state/AuthContext'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-4)',
  background: 'var(--color-bg)',
}

const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 400,
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5)',
}

const brandStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-2)',
  marginBottom: 'var(--space-4)',
}

const brandMarkStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-accent)',
  color: 'var(--color-accent-fg)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const titleStyle: CSSProperties = {
  textAlign: 'center',
  marginBottom: 'var(--space-1)',
}

const subtitleStyle: CSSProperties = {
  textAlign: 'center',
  color: 'var(--color-fg-muted)',
  marginBottom: 'var(--space-4)',
}

const footStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: 'var(--size-sm)',
  color: 'var(--color-fg-muted)',
  marginTop: 'var(--space-3)',
}

type FieldName = 'name' | 'email' | 'password' | 'passwordConfirm'

interface FieldErrors {
  name?: string
  email?: string
  password?: string
  passwordConfirm?: string
}

function validateName(value: string): string | undefined {
  if (value.trim() === '') {
    return 'Bitte geben Sie Ihren Namen ein.'
  }
  return undefined
}

function validateEmail(value: string): string | undefined {
  const trimmed = value.trim()
  if (trimmed === '' || !EMAIL_PATTERN.test(trimmed)) {
    return 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
  }
  return undefined
}

function validatePassword(value: string): string | undefined {
  if (value.length < 8) {
    return 'Das Passwort muss mindestens 8 Zeichen lang sein.'
  }
  return undefined
}

function validatePasswordConfirm(
  value: string,
  password: string,
): string | undefined {
  if (value === '' || value !== password) {
    return 'Die Passwörter stimmen nicht überein.'
  }
  return undefined
}

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const passwordConfirmRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({
    name: false,
    email: false,
    password: false,
    passwordConfirm: false,
  })
  const [submitted, setSubmitted] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const showField = (field: FieldName) => touched[field] || submitted

  const revalidate = (field: FieldName, value: string) => {
    if (!showField(field)) {
      return
    }
    setFieldErrors((prev) => ({ ...prev, [field]: validate(field, value) }))
  }

  const validate = (field: FieldName, value: string): string | undefined => {
    switch (field) {
      case 'name':
        return validateName(value)
      case 'email':
        return validateEmail(value)
      case 'password':
        return validatePassword(value)
      case 'passwordConfirm':
        return validatePasswordConfirm(value, password)
    }
  }

  const handleBlur = (field: FieldName) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    setFieldErrors((prev) => ({
      ...prev,
      [field]: validate(field, valueFor(field)),
    }))
  }

  const valueFor = (field: FieldName): string => {
    switch (field) {
      case 'name':
        return name
      case 'email':
        return email
      case 'password':
        return password
      case 'passwordConfirm':
        return passwordConfirm
    }
  }

  const allErrors = (): FieldErrors => ({
    name: validateName(name),
    email: validateEmail(email),
    password: validatePassword(password),
    passwordConfirm: validatePasswordConfirm(passwordConfirm, password),
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    setFormError(null)

    const errors = allErrors()
    setFieldErrors(errors)

    const order: FieldName[] = ['name', 'email', 'password', 'passwordConfirm']
    const firstInvalid = order.find((field) => errors[field])
    if (firstInvalid) {
      setFormError('Bitte korrigieren Sie die markierten Felder.')
      const refs: Record<FieldName, RefObject<HTMLInputElement>> = {
        name: nameRef,
        email: emailRef,
        password: passwordRef,
        passwordConfirm: passwordConfirmRef,
      }
      refs[firstInvalid].current?.focus()
      return
    }

    setPending(true)
    try {
      await register(email.trim(), name.trim(), password)
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 422 && Object.keys(error.fields).length > 0) {
          setFieldErrors({
            name: error.fields.full_name,
            email: error.fields.email,
            password: error.fields.password,
            passwordConfirm: error.fields.password_confirm,
          })
          setFormError('Bitte korrigieren Sie die markierten Felder.')
        } else if (error.status === 409) {
          setFormError(
            error.message ||
              'Diese E-Mail-Adresse ist bereits vergeben. Bitte melden Sie sich an.',
          )
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError(
          'Es ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es erneut.',
        )
      }
    } finally {
      setPending(false)
    }
  }

  const errorFor = (field: FieldName) =>
    showField(field) ? fieldErrors[field] : undefined

  const nameError = errorFor('name')
  const emailError = errorFor('email')
  const passwordError = errorFor('password')
  const confirmError = errorFor('passwordConfirm')

  return (
    <main className="auth-page" style={pageStyle} data-testid="page-register">
      <section
        className="auth-card"
        style={cardStyle}
        data-od-id="register-card"
        aria-labelledby="register-title"
      >
        <div style={brandStyle}>
          <span style={brandMarkStyle} aria-hidden="true">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-9-9" />
              <path d="M3 12h18" />
              <path d="M12 3a15 15 0 0 1 0 18" />
            </svg>
          </span>
          <span
            style={{
              fontSize: 'var(--size-lg)',
              fontWeight: 'var(--weight-semibold)',
            }}
          >
            Helpdesk
          </span>
        </div>

        <h1 style={titleStyle} id="register-title">
          Konto anlegen
        </h1>
        <p style={subtitleStyle}>Neue Konten werden als Melder angelegt.</p>

        <form onSubmit={handleSubmit} noValidate>
          {formError && (
            <div
              className="alert alert-danger"
              role="alert"
              style={{ marginBottom: 'var(--space-3)' }}
            >
              {formError}
            </div>
          )}

          <div className="field" data-od-id="field-name">
            <label className="field-label" htmlFor="reg-name">
              Name
            </label>
            <input
              ref={nameRef}
              id="reg-name"
              name="name"
              type="text"
              className="input"
              autoComplete="name"
              placeholder="Vor- und Nachname"
              value={name}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'reg-name-error' : undefined}
              onChange={(event) => {
                setName(event.target.value)
                revalidate('name', event.target.value)
              }}
              onBlur={() => handleBlur('name')}
            />
            {nameError && (
              <p className="field-error" id="reg-name-error">
                {nameError}
              </p>
            )}
          </div>

          <div className="field" data-od-id="field-email">
            <label className="field-label" htmlFor="reg-email">
              E-Mail-Adresse
            </label>
            <input
              ref={emailRef}
              id="reg-email"
              name="email"
              type="email"
              className="input"
              autoComplete="username"
              placeholder="name@nordwerk.de"
              value={email}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? 'reg-email-error' : undefined}
              onChange={(event) => {
                setEmail(event.target.value)
                revalidate('email', event.target.value)
              }}
              onBlur={() => handleBlur('email')}
            />
            {emailError && (
              <p className="field-error" id="reg-email-error">
                {emailError}
              </p>
            )}
          </div>

          <div className="field" data-od-id="field-password">
            <label className="field-label" htmlFor="reg-password">
              Passwort
            </label>
            <input
              ref={passwordRef}
              id="reg-password"
              name="password"
              type="password"
              className="input"
              autoComplete="new-password"
              placeholder="Mindestens 8 Zeichen"
              value={password}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? 'reg-password-error' : undefined}
              onChange={(event) => {
                const value = event.target.value
                setPassword(value)
                revalidate('password', value)
                if (showField('passwordConfirm')) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    passwordConfirm: validatePasswordConfirm(passwordConfirm, value),
                  }))
                }
              }}
              onBlur={() => handleBlur('password')}
            />
            {passwordError && (
              <p className="field-error" id="reg-password-error">
                {passwordError}
              </p>
            )}
          </div>

          <div className="field" data-od-id="field-password-confirm">
            <label className="field-label" htmlFor="reg-password-confirm">
              Passwort bestätigen
            </label>
            <input
              ref={passwordConfirmRef}
              id="reg-password-confirm"
              name="passwordConfirm"
              type="password"
              className="input"
              autoComplete="new-password"
              placeholder="Passwort wiederholen"
              value={passwordConfirm}
              aria-invalid={confirmError ? true : undefined}
              aria-describedby={
                confirmError ? 'reg-password-confirm-error' : undefined
              }
              onChange={(event) => {
                setPasswordConfirm(event.target.value)
                revalidate('passwordConfirm', event.target.value)
              }}
              onBlur={() => handleBlur('passwordConfirm')}
            />
            {confirmError && (
              <p className="field-error" id="reg-password-confirm-error">
                {confirmError}
              </p>
            )}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              data-od-id="register-submit"
              disabled={pending}
            >
              {pending ? 'Wird angelegt …' : 'Konto anlegen'}
            </button>
          </div>
        </form>

        <p style={footStyle}>
          Bereits registriert?{' '}
          <Link to="/login" data-od-id="register-to-login">
            Zur Anmeldung
          </Link>
        </p>
      </section>
    </main>
  )
}
