import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TicketsPage from './TicketsPage'
import { PRIORITY_ORDER } from '../api/tickets'
import type {
  Ticket,
  TicketFilters,
  TicketListResponse,
} from '../api/tickets'

vi.mock('../api/tickets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/tickets')>()
  return {
    ...actual,
    listTickets: vi.fn(),
    getAssignableUsers: vi.fn(),
    createTicket: vi.fn(),
    exportTicketsCsv: vi.fn(),
  }
})

vi.mock('../state/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: 'admin@helpdesk.de',
      full_name: 'Admin',
      role: 'admin',
      is_active: true,
    },
    token: 'test-token',
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}))

import * as ticketsApi from '../api/tickets'

const listTicketsMock = vi.mocked(ticketsApi.listTickets)
const getAssignableUsersMock = vi.mocked(ticketsApi.getAssignableUsers)
const createTicketMock = vi.mocked(ticketsApi.createTicket)

const AGENT = {
  id: 2,
  email: 'lena@helpdesk.de',
  full_name: 'Lena Hoffmann',
  role: 'agent' as const,
  is_active: true,
}

function makeTicket(overrides: Partial<Ticket> & { id: number }): Ticket {
  return {
    title: `Ticket ${overrides.id}`,
    description: 'Beschreibung',
    category: 'hardware',
    priority: 'medium',
    status: 'open',
    created_by: 1,
    assignee: null,
    due_at: '2026-12-01T10:00:00Z',
    is_overdue: false,
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
    closed_at: null,
    ...overrides,
  }
}

const BASE_DATASET: Ticket[] = [
  makeTicket({
    id: 1,
    title: 'Drucker defekt',
    description: 'Der Drucker im 2. OG druckt nicht mehr.',
    category: 'hardware',
    priority: 'critical',
    status: 'open',
    assignee: AGENT,
    due_at: '2026-10-01T08:00:00Z',
    is_overdue: true,
    created_at: '2026-10-01T08:00:00Z',
  }),
  makeTicket({
    id: 2,
    title: 'VPN Zugang',
    description: 'VPN Zugang für neuen Kollegen.',
    category: 'network',
    priority: 'low',
    status: 'closed',
    created_at: '2026-10-02T08:00:00Z',
    closed_at: '2026-10-05T08:00:00Z',
  }),
  makeTicket({
    id: 3,
    title: 'Software Lizenz',
    description: 'Lizenz für das Design-Team verlängern.',
    category: 'software',
    priority: 'medium',
    status: 'in_progress',
    assignee: AGENT,
    created_at: '2026-10-03T08:00:00Z',
  }),
]

let dataset: Ticket[] = BASE_DATASET

function applyFilters(
  all: Ticket[],
  filters: TicketFilters,
): TicketListResponse {
  let rows = all.slice()
  if (filters.search) {
    const query = filters.search.toLowerCase()
    rows = rows.filter(
      (ticket) =>
        ticket.title.toLowerCase().includes(query) ||
        ticket.description.toLowerCase().includes(query),
    )
  }
  if (filters.status) {
    rows = rows.filter((ticket) => ticket.status === filters.status)
  }
  if (filters.priority) {
    rows = rows.filter((ticket) => ticket.priority === filters.priority)
  }
  if (filters.assignee_id !== undefined && filters.assignee_id !== null) {
    rows = rows.filter((ticket) => ticket.assignee?.id === filters.assignee_id)
  }
  const sort = filters.sort ?? 'created_at'
  const order = filters.order ?? 'desc'
  rows.sort((a, b) => {
    let av: number | string
    let bv: number | string
    if (sort === 'priority') {
      av = PRIORITY_ORDER[a.priority]
      bv = PRIORITY_ORDER[b.priority]
    } else if (sort === 'due_at') {
      av = a.due_at ?? ''
      bv = b.due_at ?? ''
    } else {
      av = a.created_at
      bv = b.created_at
    }
    if (av < bv) {
      return order === 'asc' ? -1 : 1
    }
    if (av > bv) {
      return order === 'asc' ? 1 : -1
    }
    return 0
  })
  const page = filters.page ?? 1
  const pageSize = filters.page_size ?? 10
  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    page_size: pageSize,
    pages,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tickets']}>
      <TicketsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  dataset = BASE_DATASET
  listTicketsMock.mockReset()
  getAssignableUsersMock.mockReset()
  createTicketMock.mockReset()
  listTicketsMock.mockImplementation(async (filters = {}) =>
    applyFilters(dataset, filters),
  )
  getAssignableUsersMock.mockResolvedValue([AGENT])
})

afterEach(() => {
  cleanup()
})

describe('TicketsPage', () => {
  it('renders the tickets and the result count', async () => {
    renderPage()

    expect(await screen.findByText('Drucker defekt')).toBeTruthy()
    expect(screen.getByText('3 Tickets')).toBeTruthy()
    expect(screen.getByText('VPN Zugang')).toBeTruthy()
  })

  it('filters by a search term over title and description', async () => {
    renderPage()
    await screen.findByText('Drucker defekt')

    fireEvent.change(screen.getByLabelText('Titel oder Beschreibung suchen'), {
      target: { value: 'Drucker' },
    })

    await waitFor(
      () => expect(screen.queryByText('VPN Zugang')).toBeNull(),
      { timeout: 2000 },
    )
    expect(screen.getByText('Drucker defekt')).toBeTruthy()

    const lastFilters = listTicketsMock.mock.calls[
      listTicketsMock.mock.calls.length - 1
    ][0]
    expect(lastFilters?.search).toBe('Drucker')
  })

  it('filters by priority and shows a chip', async () => {
    renderPage()
    await screen.findByText('Drucker defekt')

    fireEvent.change(screen.getByLabelText('Nach Priorität filtern'), {
      target: { value: 'critical' },
    })

    await waitFor(() => expect(screen.queryByText('VPN Zugang')).toBeNull())
    expect(screen.getByText('Drucker defekt')).toBeTruthy()
    expect(screen.getByText('Priorität: kritisch')).toBeTruthy()
  })

  it('shows the German empty state when no ticket matches', async () => {
    renderPage()
    await screen.findByText('Drucker defekt')

    fireEvent.change(screen.getByLabelText('Titel oder Beschreibung suchen'), {
      target: { value: 'gibtesnicht' },
    })

    expect(await screen.findByText('Keine Tickets gefunden')).toBeTruthy()
    expect(
      screen.getByText('Für die aktuellen Filter gibt es keine Treffer.'),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }))

    expect(await screen.findByText('Drucker defekt')).toBeTruthy()
  })

  it('sorts by priority and toggles the direction', async () => {
    renderPage()
    await screen.findByText('Drucker defekt')

    fireEvent.click(screen.getByRole('button', { name: 'Priorität' }))

    await waitFor(() => {
      const lastFilters = listTicketsMock.mock.calls[
        listTicketsMock.mock.calls.length - 1
      ][0]
      expect(lastFilters?.sort).toBe('priority')
      expect(lastFilters?.order).toBe('desc')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Priorität' }))

    await waitFor(() => {
      const lastFilters = listTicketsMock.mock.calls[
        listTicketsMock.mock.calls.length - 1
      ][0]
      expect(lastFilters?.order).toBe('asc')
    })
  })

  it('pages through the result and requests the next page', async () => {
    dataset = Array.from({ length: 12 }, (_, index) =>
      makeTicket({
        id: index + 1,
        title: `Ticket Nummer ${index + 1}`,
        created_at: `2026-10-${String(index + 1).padStart(2, '0')}T08:00:00Z`,
      }),
    )
    renderPage()

    expect(await screen.findByText('Zeige 1–10 von 12')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Nächste Seite'))

    expect(await screen.findByText('Zeige 11–12 von 12')).toBeTruthy()
    const lastFilters = listTicketsMock.mock.calls[
      listTicketsMock.mock.calls.length - 1
    ][0]
    expect(lastFilters?.page).toBe(2)
  })

  it('creates a ticket, shows a success message and refreshes the list', async () => {
    const created = makeTicket({
      id: 99,
      title: 'Neues Anliegen',
      description: 'Bitte um Hilfe.',
      category: 'network',
      priority: 'high',
    })
    createTicketMock.mockResolvedValue(created)
    renderPage()
    await screen.findByText('Drucker defekt')

    const callsBefore = listTicketsMock.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Neues Ticket' }))

    fireEvent.change(screen.getByLabelText('Titel'), {
      target: { value: 'Neues Anliegen' },
    })
    fireEvent.change(screen.getByLabelText('Beschreibung'), {
      target: { value: 'Bitte um Hilfe.' },
    })
    fireEvent.change(screen.getByLabelText('Kategorie'), {
      target: { value: 'network' },
    })
    fireEvent.change(screen.getByLabelText('Priorität'), {
      target: { value: 'high' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Ticket erstellen' }))

    expect(createTicketMock).toHaveBeenCalledWith(
      {
        title: 'Neues Anliegen',
        description: 'Bitte um Hilfe.',
        category: 'network',
        priority: 'high',
      },
      'test-token',
    )

    expect(await screen.findByText(/wurde angelegt/)).toBeTruthy()
    await waitFor(() =>
      expect(listTicketsMock.mock.calls.length).toBeGreaterThan(callsBefore),
    )
  })

  it('validates the create form only after it was submitted', async () => {
    renderPage()
    await screen.findByText('Drucker defekt')

    fireEvent.click(screen.getByRole('button', { name: 'Neues Ticket' }))
    expect(screen.queryByText('Bitte geben Sie einen Titel ein.')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Ticket erstellen' }))

    expect(
      await screen.findByText('Bitte geben Sie einen Titel ein.'),
    ).toBeTruthy()
    expect(screen.getByText('Bitte geben Sie eine Beschreibung ein.')).toBeTruthy()
    expect(screen.getByText('Bitte wählen Sie eine Kategorie.')).toBeTruthy()
    expect(screen.getByText('Bitte wählen Sie eine Priorität.')).toBeTruthy()
    expect(createTicketMock).not.toHaveBeenCalled()
  })
})
