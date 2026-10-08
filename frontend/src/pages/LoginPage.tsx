import { useRef, useState, type CSSProperties, type FormEvent } from 'react'
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

interface FieldErrors {
  email?: string
  password?: string
}

function validateEmail(value: string): string | undefined {
  const trimmed = value.trim()
  if (trimmed === '' || !EMAIL_PATTERN.test(trimmed)) {
    return 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
  }
  return undefined
}

function validatePassword(value: string): string | undefined {
  if (value === '') {
    return 'Bitte geben Sie Ihr Passwort ein.'
  }
  return undefined
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState({ email: false, password: false })
  const [submitted, setSubmitted] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const showField = (field: keyof FieldErrors) => touched[field] || submitted

  const handleEmailChange = (value: string) => {
    setEmail(value)
    if (showField('email')) {
      setFieldErrors((prev) => ({ ...prev, email: validateEmail(value) }))
    }
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    if (showField('password')) {
      setFieldErrors((prev) => ({ ...prev, password: validatePassword(value) }))
    }
  }

  const handleBlur = (field: keyof FieldErrors) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    setFieldErrors((prev) => ({
      ...prev,
      [field]: field === 'email' ? validateEmail(email) : validatePassword(password),
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    setFormError(null)

    const errors: FieldErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    }
    setFieldErrors(errors)

    if (errors.email || errors.password) {
      setFormError('Bitte korrigieren Sie die markierten Felder.')
      if (errors.email) {
        emailRef.current?.focus()
      } else {
        passwordRef.current?.focus()
      }
      return
    }

    setPending(true)
    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 422 && Object.keys(error.fields).length > 0) {
          setFieldErrors({
            email: error.fields.email,
            password: error.fields.password,
          })
          setFormError('Bitte korrigieren Sie die markierten Felder.')
        } else if (error.status === 401) {
          setFormError(
            'E-Mail-Adresse oder Passwort ist falsch. Bitte prüfen Sie Ihre Eingaben.',
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

  const emailError = showField('email') ? fieldErrors.email : undefined
  const passwordError = showField('password') ? fieldErrors.password : undefined

  return (
    <main className="auth-page" style={pageStyle} data-testid="page-login">
      <section
        className="auth-card"
        style={cardStyle}
        data-od-id="login-card"
        aria-labelledby="login-title"
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

        <h1 style={titleStyle} id="login-title">
          Anmeldung
        </h1>
        <p style={subtitleStyle}>Interner IT-Support der Nordwerk GmbH</p>

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

          <div className="field" data-od-id="field-email">
            <label className="field-label" htmlFor="login-email">
              E-Mail-Adresse
            </label>
            <input
              ref={emailRef}
              id="login-email"
              name="email"
              type="email"
              className="input"
              autoComplete="username"
              placeholder="name@nordwerk.de"
              value={email}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? 'login-email-error' : undefined}
              onChange={(event) => handleEmailChange(event.target.value)}
              onBlur={() => handleBlur('email')}
            />
            {emailError && (
              <p className="field-error" id="login-email-error">
                {emailError}
              </p>
            )}
          </div>

          <div className="field" data-od-id="field-password">
            <label className="field-label" htmlFor="login-password">
              Passwort
            </label>
            <input
              ref={passwordRef}
              id="login-password"
              name="password"
              type="password"
              className="input"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? 'login-password-error' : undefined}
              onChange={(event) => handlePasswordChange(event.target.value)}
              onBlur={() => handleBlur('password')}
            />
            {passwordError && (
              <p className="field-error" id="login-password-error">
                {passwordError}
              </p>
            )}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              data-od-id="login-submit"
              disabled={pending}
            >
              {pending ? 'Anmelden …' : 'Anmelden'}
            </button>
          </div>
        </form>

        <p style={footStyle}>
          Noch kein Konto?{' '}
          <Link to="/register" data-od-id="login-to-register">
            Registrieren
          </Link>
        </p>
      </section>
    </main>
  )
}
