import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import App from '../App'
import { AuthProvider } from '../state/AuthContext'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'

const regularUser = {
  id: 1,
  email: 'anna@nordwerk.de',
  full_name: 'Anna Beispiel',
  role: 'melder' as const,
  is_active: true,
}

function renderWithProviders(ui: ReactNode, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>,
  )
}

/**
 * Replace `fetch` with a canned JSON response. When `routeBodies` is given,
 * the first key contained in the request URL wins, so a single stub can serve
 * e.g. the login payload and the dashboard metrics the app loads right after.
 */
function mockFetch(
  status: number,
  body: unknown,
  routeBodies: Record<string, unknown> = {},
) {
  const fn = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    const match = Object.keys(routeBodies).find((path) => url.includes(path))
    const payload = match ? routeBodies[match] : body
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(payload),
    })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('LoginPage', () => {
  it('starts neutral without any error marking', () => {
    renderWithProviders(<LoginPage />, '/login')

    expect(
      screen.queryByText('Bitte geben Sie eine gültige E-Mail-Adresse ein.'),
    ).toBeNull()
    expect(screen.queryByText('Bitte geben Sie Ihr Passwort ein.')).toBeNull()

    const email = screen.getByLabelText('E-Mail-Adresse')
    expect(email.getAttribute('aria-invalid')).toBeNull()
  })

  it('shows a field message only after the field was touched', () => {
    renderWithProviders(<LoginPage />, '/login')

    const email = screen.getByLabelText('E-Mail-Adresse')
    fireEvent.blur(email)

    expect(
      screen.getByText('Bitte geben Sie eine gültige E-Mail-Adresse ein.'),
    ).toBeTruthy()
    expect(email.getAttribute('aria-invalid')).toBe('true')
  })

  it('shows field messages after submitting an untouched form', async () => {
    renderWithProviders(<LoginPage />, '/login')

    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(
      await screen.findByText('Bitte geben Sie eine gültige E-Mail-Adresse ein.'),
    ).toBeTruthy()
    expect(screen.getByText('Bitte geben Sie Ihr Passwort ein.')).toBeTruthy()
  })

  it('shows a German message for wrong credentials', async () => {
    mockFetch(401, {
      error: { code: 'invalid_credentials', message: 'Ungültige Anmeldedaten' },
    })
    renderWithProviders(<LoginPage />, '/login')

    fireEvent.change(screen.getByLabelText('E-Mail-Adresse'), {
      target: { value: 'anna@nordwerk.de' },
    })
    fireEvent.change(screen.getByLabelText('Passwort'), {
      target: { value: 'falsch123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(
      await screen.findByText(
        'E-Mail-Adresse oder Passwort ist falsch. Bitte prüfen Sie Ihre Eingaben.',
      ),
    ).toBeTruthy()
  })

  it('maps server 422 fields onto the matching inputs', async () => {
    mockFetch(422, {
      error: {
        code: 'validation_error',
        message: 'Ungültige Eingaben',
        fields: { email: 'Bitte geben Sie eine geschäftliche E-Mail an.' },
      },
    })
    renderWithProviders(<LoginPage />, '/login')

    fireEvent.change(screen.getByLabelText('E-Mail-Adresse'), {
      target: { value: 'anna@nordwerk.de' },
    })
    fireEvent.change(screen.getByLabelText('Passwort'), {
      target: { value: 'geheim123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(
      await screen.findByText('Bitte geben Sie eine geschäftliche E-Mail an.'),
    ).toBeTruthy()
  })

  it('leads to the dashboard after a successful login', async () => {
    mockFetch(
      200,
      {
        access_token: 'test-token',
        token_type: 'bearer',
        user: regularUser,
      },
      {
        '/dashboard/metrics': {
          open: 1,
          overdue: 0,
          closed_today: 0,
          by_priority: { critical: 0, high: 0, medium: 0, low: 0 },
        },
      },
    )
    renderWithProviders(<App />, '/login')

    fireEvent.change(screen.getByLabelText('E-Mail-Adresse'), {
      target: { value: 'anna@nordwerk.de' },
    })
    fireEvent.change(screen.getByLabelText('Passwort'), {
      target: { value: 'geheim123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(await screen.findByTestId('page-dashboard')).toBeTruthy()
    expect(localStorage.getItem('helpdesk_token')).toBe('test-token')
  })
})

describe('RegisterPage', () => {
  it('starts neutral without any error marking', () => {
    renderWithProviders(<RegisterPage />, '/register')

    expect(screen.queryByText('Bitte geben Sie Ihren Namen ein.')).toBeNull()
    expect(
      screen.queryByText('Das Passwort muss mindestens 8 Zeichen lang sein.'),
    ).toBeNull()
    expect(screen.queryByText('Die Passwörter stimmen nicht überein.')).toBeNull()
  })

  it('shows field messages after submitting an untouched form', async () => {
    renderWithProviders(<RegisterPage />, '/register')

    fireEvent.click(screen.getByRole('button', { name: 'Konto anlegen' }))

    expect(await screen.findByText('Bitte geben Sie Ihren Namen ein.')).toBeTruthy()
    expect(
      screen.getByText('Das Passwort muss mindestens 8 Zeichen lang sein.'),
    ).toBeTruthy()
  })

  it('reports mismatching passwords only after the confirm field was touched', () => {
    renderWithProviders(<RegisterPage />, '/register')

    const password = screen.getByLabelText('Passwort')
    fireEvent.change(password, { target: { value: 'geheim123' } })
    fireEvent.blur(password)

    fireEvent.change(screen.getByLabelText('Passwort bestätigen'), {
      target: { value: 'anders123' },
    })
    fireEvent.blur(screen.getByLabelText('Passwort bestätigen'))

    expect(screen.getByText('Die Passwörter stimmen nicht überein.')).toBeTruthy()
  })
})

describe('Auth route protection (AC-18)', () => {
  it('redirects a protected page to the login page without a session', async () => {
    renderWithProviders(<App />, '/tickets')

    await waitFor(() => {
      expect(screen.getByTestId('page-login')).toBeTruthy()
    })
  })

  it('returns to the login page after Abmelden', async () => {
    localStorage.setItem('helpdesk_token', 'stored-token')
    mockFetch(200, regularUser)
    renderWithProviders(<App />, '/tickets')

    await screen.findByText('Anna Beispiel')
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }))

    await waitFor(() => {
      expect(screen.getByTestId('page-login')).toBeTruthy()
    })
    expect(localStorage.getItem('helpdesk_token')).toBeNull()
  })
})
