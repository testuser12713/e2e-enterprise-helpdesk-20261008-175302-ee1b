import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './state/AuthContext'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('App shell', () => {
  it('renders the fixed navigation entries', () => {
    renderAt('/')

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Tickets' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeTruthy()
  })

  it('does not render the admin navigation for signed-out users', () => {
    renderAt('/')

    expect(
      screen.queryByRole('link', { name: 'Benutzerverwaltung' }),
    ).toBeNull()
  })

  it('exposes the sidebar regions named by the mockups', () => {
    const { container } = renderAt('/')

    const regions = [
      'sidebar',
      'main-nav',
      'nav-dashboard',
      'nav-tickets',
      'sidebar-user',
      'logout-btn',
    ]
    for (const region of regions) {
      expect(
        container.querySelector(`[data-od-id="${region}"]`),
      ).not.toBeNull()
    }
    // Benutzerverwaltung is rendered only for administrators.
    expect(
      container.querySelector('[data-od-id="nav-users"]'),
    ).toBeNull()
  })

  it('resolves every declared route to its page', () => {
    const routes: Array<[string, string]> = [
      ['/', 'page-dashboard'],
      ['/tickets', 'page-tickets'],
      ['/tickets/1', 'page-ticket-detail'],
      ['/users', 'page-users'],
      ['/login', 'page-login'],
      ['/register', 'page-register'],
    ]

    for (const [path, testId] of routes) {
      const { unmount } = renderAt(path)
      expect(screen.getByTestId(testId)).toBeTruthy()
      unmount()
    }
  })
})
