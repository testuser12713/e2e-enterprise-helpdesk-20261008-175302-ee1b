import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import UsersPage from './UsersPage'
import {
  createUser,
  listUsers,
  updateUser,
  type ManagedUser,
} from '../api/users'

vi.mock('../state/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: 'admin@nordwerk.de',
      full_name: 'Sarah Weber',
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

vi.mock('../api/users', () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
}))

const users: ManagedUser[] = [
  {
    id: 1,
    email: 'sarah.weber@nordwerk.de',
    full_name: 'Sarah Weber',
    role: 'admin',
    is_active: true,
    last_login: '2026-10-08T08:12:00Z',
  },
  {
    id: 2,
    email: 'jonas.becker@nordwerk.de',
    full_name: 'Jonas Becker',
    role: 'agent',
    is_active: true,
    last_login: null,
  },
  {
    id: 3,
    email: 'david.neumann@nordwerk.de',
    full_name: 'David Neumann',
    role: 'melder',
    is_active: false,
    last_login: null,
  },
]

beforeEach(() => {
  vi.mocked(listUsers).mockResolvedValue(users)
  vi.mocked(createUser).mockResolvedValue({
    id: 9,
    email: 'neu@nordwerk.de',
    full_name: 'Neue Person',
    role: 'melder',
    is_active: true,
  })
  vi.mocked(updateUser).mockResolvedValue(users[0])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('UsersPage', () => {
  it('lists all users with the required columns', async () => {
    render(<UsersPage />)

    expect(await screen.findByText('Sarah Weber')).toBeTruthy()
    for (const column of [
      'Name',
      'E-Mail',
      'Rolle',
      'Status',
      'Letzte Anmeldung',
    ]) {
      expect(screen.getByRole('columnheader', { name: column })).toBeTruthy()
    }
    expect(listUsers).toHaveBeenCalledWith('test-token')
  })

  it('renders deactivated rows muted with a disabled role select', async () => {
    render(<UsersPage />)

    await screen.findByText('David Neumann')
    const roleSelect = screen.getByLabelText('Rolle von David Neumann')
    expect((roleSelect as HTMLSelectElement).disabled).toBe(true)
    expect(screen.getByText('deaktiviert')).toBeTruthy()
  })

  it('creates a user through the form', async () => {
    render(<UsersPage />)
    await screen.findByText('Sarah Weber')

    fireEvent.click(screen.getByTestId('new-user-btn'))
    const form = screen.getByTestId('user-form')

    fireEvent.change(within(form).getByLabelText('Name'), {
      target: { value: 'Neue Person' },
    })
    fireEvent.change(within(form).getByLabelText('E-Mail-Adresse'), {
      target: { value: 'neu@nordwerk.de' },
    })
    fireEvent.change(within(form).getByLabelText('Rolle'), {
      target: { value: 'melder' },
    })
    fireEvent.change(within(form).getByLabelText('Initiales Passwort'), {
      target: { value: 'geheim123' },
    })

    fireEvent.click(
      within(form).getByRole('button', { name: 'Benutzer anlegen' }),
    )

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith('test-token', {
        email: 'neu@nordwerk.de',
        full_name: 'Neue Person',
        password: 'geheim123',
        role: 'melder',
      })
    })
    expect(
      await screen.findByText('Benutzer „Neue Person“ wurde angelegt.'),
    ).toBeTruthy()
  })

  it('does not show field errors on an untouched form', async () => {
    render(<UsersPage />)
    await screen.findByText('Sarah Weber')

    fireEvent.click(screen.getByTestId('new-user-btn'))
    expect(screen.getByTestId('user-form')).toBeTruthy()
    expect(screen.queryByText('Bitte geben Sie einen Namen ein.')).toBeNull()
  })

  it('changes a role via the row select', async () => {
    render(<UsersPage />)
    await screen.findByText('Jonas Becker')

    fireEvent.change(screen.getByLabelText('Rolle von Jonas Becker'), {
      target: { value: 'admin' },
    })

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith('test-token', 2, {
        role: 'admin',
      })
    })
    expect(
      await screen.findByText(
        'Rolle von „Jonas Becker“ geändert zu „Administrator“.',
      ),
    ).toBeTruthy()
  })

  it('deactivates a user only after confirming the dialog', async () => {
    render(<UsersPage />)
    await screen.findByText('Jonas Becker')

    const row = screen.getByLabelText('Rolle von Jonas Becker').closest('tr')
    expect(row).not.toBeNull()
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: 'Deaktivieren' }))

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('Benutzer deaktivieren?'),
    ).toBeTruthy()
    expect(updateUser).not.toHaveBeenCalled()

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Deaktivieren' }),
    )

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith('test-token', 2, {
        is_active: false,
      })
    })
    expect(
      await screen.findByText('Benutzer „Jonas Becker“ wurde deaktiviert.'),
    ).toBeTruthy()
  })
})
