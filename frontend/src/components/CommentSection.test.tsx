import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import CommentSection from './CommentSection'
import { createComment, listComments, type Comment } from '../api/comments'

vi.mock('../state/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token' }),
}))

vi.mock('../api/comments', () => ({
  listComments: vi.fn(),
  createComment: vi.fn(),
}))

const mockedList = vi.mocked(listComments)
const mockedCreate = vi.mocked(createComment)

const author = {
  id: 7,
  email: 'jonas@example.com',
  full_name: 'Jonas Becker',
  role: 'agent' as const,
  is_active: true,
}

function makeComment(overrides: Partial<Comment> & { id: number }): Comment {
  return {
    ticket_id: 1,
    body: 'Kommentar',
    author,
    created_at: '2026-10-06T09:12:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CommentSection', () => {
  it('shows the German empty state when the ticket has no comments', async () => {
    mockedList.mockResolvedValue([])

    render(<CommentSection ticketId={1} />)

    expect(
      await screen.findByText(
        'Noch keine Kommentare — schreiben Sie den ersten.',
      ),
    ).toBeTruthy()
  })

  it('appends the posted comment at the end and clears the field', async () => {
    const existing = makeComment({ id: 1, body: 'Erster Kommentar' })
    const created = makeComment({
      id: 2,
      body: 'Neuer Kommentar',
      created_at: '2026-10-08T10:05:00Z',
    })
    mockedList.mockResolvedValue([existing])
    mockedCreate.mockResolvedValue(created)

    render(<CommentSection ticketId={1} />)

    const textarea = (await screen.findByLabelText(
      'Kommentar abschreiben',
    )) as HTMLTextAreaElement
    const button = screen.getByRole('button', {
      name: 'Kommentar abschreiben',
    }) as HTMLButtonElement

    expect(button.disabled).toBe(true)
    expect(await screen.findByText('Erster Kommentar')).toBeTruthy()

    fireEvent.change(textarea, { target: { value: 'Neuer Kommentar' } })
    expect(button.disabled).toBe(false)

    fireEvent.click(button)

    await waitFor(() => {
      expect(mockedCreate).toHaveBeenCalledWith(1, 'Neuer Kommentar', 'test-token')
    })

    const items = await screen.findAllByTestId('comment-item')
    expect(items).toHaveLength(2)
    expect(items[items.length - 1].textContent).toContain('Neuer Kommentar')
    expect((textarea as HTMLTextAreaElement).value).toBe('')
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })
})
