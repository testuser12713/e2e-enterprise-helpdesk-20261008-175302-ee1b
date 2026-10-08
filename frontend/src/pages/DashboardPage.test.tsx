import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { DashboardMetrics } from '../api/dashboard'

vi.mock('../api/dashboard', () => ({
  fetchDashboardMetrics: vi.fn(),
}))

vi.mock('../state/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    token: 'test-token',
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}))

import { fetchDashboardMetrics } from '../api/dashboard'
import DashboardPage from './DashboardPage'

const mockedFetch = vi.mocked(fetchDashboardMetrics)

const METRICS: DashboardMetrics = {
  open: 10,
  overdue: 3,
  closed_today: 4,
  by_priority: { critical: 2, high: 3, medium: 7, low: 6 },
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

function region(name: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-od-id="${name}"]`)
  if (!element) {
    throw new Error(`region ${name} not rendered`)
  }
  return element
}

describe('DashboardPage', () => {
  beforeEach(() => {
    mockedFetch.mockReset()
  })

  it('renders the metric numbers and priority distribution from the API', async () => {
    mockedFetch.mockResolvedValue(METRICS)

    renderPage()

    await waitFor(() => expect(region('metric-open')).toBeTruthy())

    expect(within(region('metric-open')).getByText('10')).toBeTruthy()
    expect(within(region('metric-overdue')).getByText('3')).toBeTruthy()
    expect(within(region('metric-closed-today')).getByText('4')).toBeTruthy()

    const priority = region('metric-priority')
    expect(within(priority).getByText('Kritisch')).toBeTruthy()
    expect(within(priority).getByText('Hoch')).toBeTruthy()
    expect(within(priority).getByText('Mittel')).toBeTruthy()
    expect(within(priority).getByText('Niedrig')).toBeTruthy()
    expect(within(priority).getByText('2')).toBeTruthy()
    expect(within(priority).getByText('7')).toBeTruthy()

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /Neues Ticket/i }),
    ).toBeTruthy()
  })

  it('shows a German error message and retries the request', async () => {
    mockedFetch
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(METRICS)

    renderPage()

    const errorState = await screen.findByTestId('dashboard-error')
    expect(errorState.textContent).toContain('konnten nicht geladen werden')

    fireEvent.click(screen.getByRole('button', { name: /Erneut versuchen/i }))

    await waitFor(() => expect(region('metric-open')).toBeTruthy())
    expect(within(region('metric-open')).getByText('10')).toBeTruthy()
    expect(mockedFetch).toHaveBeenCalledTimes(2)
  })
})
