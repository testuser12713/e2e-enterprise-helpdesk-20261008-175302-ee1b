import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import TicketDetailPage from './TicketDetailPage'
import {
  assignTicket,
  closeTicket,
  formatDateTime,
  getTicket,
  listAssignableUsers,
  listTicketHistory,
  updateTicket,
  type Ticket,
} from '../api/ticketDetail'
import type { User } from '../state/AuthContext'

vi.mock('../state/AuthContext', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: {
      id: 9,
      email: 'sarah@example.com',
      full_name: 'Sarah Weber',
      role: 'agent',
      is_active: true,
    },
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}))

vi.mock('../components/CommentSection', () => ({
  default: ({ ticketId }: { ticketId: number }) => (
    <div data-testid="comment-section">Kommentare #{ticketId}</div>
  ),
}))

vi.mock('../api/ticketDetail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/ticketDetail')>()
  return {
    ...actual,
    getTicket: vi.fn(),
    updateTicket: vi.fn(),
    assignTicket: vi.fn(),
    closeTicket: vi.fn(),
    listTicketHistory: vi.fn(),
    listAssignableUsers: vi.fn(),
  }
})

const mockedGetTicket = vi.mocked(getTicket)
const mockedUpdateTicket = vi.mocked(updateTicket)
const mockedAssignTicket = vi.mocked(assignTicket)
const mockedCloseTicket = vi.mocked(closeTicket)
const mockedListHistory = vi.mocked(listTicketHistory)
const mockedListAssignable = vi.mocked(listAssignableUsers)

const agent: User = {
  id: 7,
  email: 'jonas@example.com',
  full_name: 'Jonas Becker',
  role: 'agent',
  is_active: true,
}

const sarah: User = {
  id: 9,
  email: 'sarah@example.com',
  full_name: 'Sarah Weber',
  role: 'admin',
  is_active: true,
}

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 5,
    title: 'Laptop startet nicht mehr',
    description: 'Der Bildschirm bleibt schwarz.',
    category: 'hardware',
    priority: 'medium',
    status: 'open',
    created_by: 12,
    assignee: null,
    due_at: '2026-10-12T09:00:00Z',
    is_overdue: false,
    created_at: '2026-10-06T09:12:00Z',
    updated_at: '2026-10-06T09:12:00Z',
    closed_at: null,
    ...overrides,
  }
}

function renderPage(id = 5) {
  return render(
    <MemoryRouter initialEntries={[`/tickets/${id}`]}>
      <Routes>
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetTicket.mockResolvedValue(makeTicket())
  mockedListAssignable.mockResolvedValue([agent])
  mockedListHistory.mockResolvedValue([])
})

describe('TicketDetailPage', () => {
  it('shows the ticket facts, the overdue badge and the due date', async () => {
    const dueAt = '2026-10-06T11:12:00Z'
    mockedGetTicket.mockResolvedValue(makeTicket({ is_overdue: true, due_at: dueAt }))

    renderPage()

    expect(await screen.findByTestId('page-title')).toBeTruthy()
    expect(screen.getByText('überfällig')).toBeTruthy()
    expect(screen.getByText(formatDateTime(dueAt))).toBeTruthy()
    expect(screen.getAllByText('Nicht zugewiesen').length).toBeGreaterThan(0)
  })

  it('updates the due date on screen when the priority is edited', async () => {
    const newDueAt = '2026-10-10T13:00:00Z'
    mockedUpdateTicket.mockResolvedValue(
      makeTicket({ priority: 'critical', due_at: newDueAt }),
    )

    renderPage()
    await screen.findByTestId('page-title')

    fireEvent.change(screen.getByLabelText('Priorität'), {
      target: { value: 'critical' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    await waitFor(() => {
      expect(mockedUpdateTicket).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ priority: 'critical' }),
        'test-token',
      )
    })

    expect(await screen.findByText(formatDateTime(newDueAt))).toBeTruthy()
    expect(await screen.findByText('Ticket wurde gespeichert.')).toBeTruthy()
  })

  it('assigns the ticket to the selected agent', async () => {
    mockedAssignTicket.mockResolvedValue(makeTicket({ assignee: agent }))

    renderPage()
    await screen.findByTestId('page-title')

    fireEvent.change(screen.getByLabelText('Zuweisung'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zuweisung speichern' }))

    await waitFor(() => {
      expect(mockedAssignTicket).toHaveBeenCalledWith(5, 7, 'test-token')
    })
    expect(await screen.findByText('Zuweisung aktualisiert: Jonas Becker.')).toBeTruthy()
  })

  it('closes the ticket through the confirm dialog and marks it closed', async () => {
    mockedCloseTicket.mockResolvedValue(
      makeTicket({ status: 'closed', closed_at: '2026-10-08T10:00:00Z' }),
    )

    renderPage()
    await screen.findByTestId('page-title')

    fireEvent.click(screen.getByRole('button', { name: 'Ticket schließen' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Ticket schließen?')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ticket schließen' }))

    await waitFor(() => {
      expect(mockedCloseTicket).toHaveBeenCalledWith(5, 'test-token')
    })
    expect(await screen.findByText('Ticket wurde geschlossen.')).toBeTruthy()
    expect(await screen.findByTestId('closed-at')).toBeTruthy()
  })

  it('lists the change log newest first with actor and old -> new values', async () => {
    mockedListHistory.mockResolvedValue([
      {
        field: 'status',
        old_value: null,
        new_value: 'open',
        actor: sarah,
        created_at: '2026-10-06T09:12:00Z',
      },
      {
        field: 'priority',
        old_value: 'medium',
        new_value: 'high',
        actor: agent,
        created_at: '2026-10-07T09:00:00Z',
      },
    ])

    renderPage()
    await screen.findByTestId('page-title')

    const entries = await screen.findAllByTestId('history-entry')
    expect(entries).toHaveLength(2)
    expect(entries[0].textContent).toContain('Priorität')
    expect(entries[0].textContent).toContain('mittel')
    expect(entries[0].textContent).toContain('hoch')
    expect(entries[0].textContent).toContain('Jonas Becker')
    expect(entries[1].textContent).toContain('Status')
    expect(entries[1].textContent).toContain('offen')
  })
})
