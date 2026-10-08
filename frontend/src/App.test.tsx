import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './state/AuthContext'

type User = {
  id: number
  email: string
  full_name: string
  role: 'melder' | 'agent' | 'admin'
  is_active: boolean
}

const adminUser: User = {
  id: 1,
  email: 'lena@nordwerk.de',
  full_name: 'Lena Admin',
  role: 'admin',
  is_active: true,
}

const agentUser: User = {
  id: 2,
  email: 'jonas@nordwerk.de',
  full_name: 'Jonas Agent',
  role: 'agent',
  is_active: true,
}

const dashboardMetrics = {
  open: 0,
  overdue: 0,
  closed_today: 0,
  by_priority: { critical: 0, high: 0, medium: 0, low: 0 },
}

const emptyTicketList = {
  items: [],
  total: 0,
  page: 1,
  page_size: 20,
  pages: 0,
}

const sampleTicket = {
  id: 1,
  title: 'Laptop startet nicht mehr',
  description: 'Beim Einschalten bleibt der Bildschirm schwarz.',
  category: 'hardware',
  priority: 'high',
  status: 'open',
  created_by: 1,
  assignee: null,
  due_at: null,
  is_overdue: false,
  created_at: '2026-01-01T08:00:00Z',
  updated_at: '2026-01-01T08:00:00Z',
  closed_at: null,
}

/**
 * Replace `fetch` with canned JSON responses. Route keys are matched against
 * the request URL longest-first so `/tickets/1/comments` wins over `/tickets`.
 */
function mockApi(user: User | null = null): void {
  const routes: Array<[string, unknown]> = [
    ['/tickets/1/comments', []],
    ['/tickets/1/history', []],
    ['/tickets/1', sampleTicket],
    ['/tickets', emptyTicketList],
    ['/dashboard/metrics', dashboardMetrics],
    ['/users/assignable', []],
    ['/users', user ? [user] : []],
    ['/auth/me', user],
  ]
  routes.sort((a, b) => b[0].length - a[0].length)
  const lookup = new Map(routes)

  const fn = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    const match = routes.find(([path]) => url.includes(path))
    const payload = match ? lookup.get(match[0]) : {}
    return Promise.resolve({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
      blob: async () => new Blob([''], { type: 'text/csv' }),
    })
  })
  vi.stubGlobal('fetch', fn)
}

function renderApp(path: string, user: User | null = null) {
  if (user) {
    localStorage.setItem('helpdesk_token', 'test-token')
  } else {
    localStorage.clear()
  }
  mockApi(user)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('App shell navigation', () => {
  it('renders the fixed navigation entries for a signed-in user', async () => {
    renderApp('/', agentUser)

    expect(
      await screen.findByRole('link', { name: 'Dashboard' }),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Tickets' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeTruthy()
  })

  it('shows the current user with their role badge', async () => {
    renderApp('/', agentUser)

    expect(await screen.findByText('Jonas Agent')).toBeTruthy()
    expect(screen.getByText('Agent')).toBeTruthy()
  })

  it('exposes the mockup regions by their data-od-id values', async () => {
    renderApp('/', agentUser)

    await screen.findByRole('link', { name: 'Dashboard' })
    for (const regionId of [
      'sidebar',
      'main-nav',
      'nav-dashboard',
      'nav-tickets',
      'sidebar-user',
      'logout-btn',
    ]) {
      expect(
        document.querySelector(`[data-od-id="${regionId}"]`),
        `region ${regionId}`,
      ).toBeTruthy()
    }
  })

  it('shows the admin-only navigation to administrators', async () => {
    renderApp('/', adminUser)

    expect(
      await screen.findByRole('link', { name: 'Benutzerverwaltung' }),
    ).toBeTruthy()
  })

  it('hides the admin-only navigation from agents', async () => {
    renderApp('/', agentUser)

    await screen.findByRole('link', { name: 'Dashboard' })
    expect(
      screen.queryByRole('link', { name: 'Benutzerverwaltung' }),
    ).toBeNull()
  })

  it('leads to the login page after Abmelden', async () => {
    renderApp('/tickets', agentUser)

    await screen.findByText('Jonas Agent')
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }))

    await waitFor(() => {
      expect(screen.getByTestId('page-login')).toBeTruthy()
    })
    expect(localStorage.getItem('helpdesk_token')).toBeNull()
  })
})

describe('App routes', () => {
  it('resolves every declared route to its page', async () => {
    const routes: Array<[string, string]> = [
      ['/', 'page-dashboard'],
      ['/tickets', 'page-tickets'],
      ['/tickets/1', 'page-ticket-detail'],
      ['/users', 'page-users'],
      ['/login', 'page-login'],
      ['/register', 'page-register'],
    ]

    for (const [path, testId] of routes) {
      const { unmount } = renderApp(path, adminUser)
      expect(await screen.findByTestId(testId)).toBeTruthy()
      unmount()
    }
  })

  it('renders a visible surface for every route instead of a blank page', async () => {
    const routes: Array<[string, string]> = [
      ['/', 'page-dashboard'],
      ['/tickets', 'page-tickets'],
      ['/tickets/1', 'page-ticket-detail'],
      ['/users', 'page-users'],
      ['/login', 'page-login'],
      ['/register', 'page-register'],
    ]

    for (const [path, testId] of routes) {
      const { unmount } = renderApp(path, adminUser)
      const page = await screen.findByTestId(testId)
      expect((page.textContent ?? '').trim().length).toBeGreaterThan(0)
      unmount()
    }
  })
})
