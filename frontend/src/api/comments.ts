/**
 * Comment API for a ticket.
 *
 * `GET /api/v1/tickets/{ticketId}/comments` returns the conversation oldest
 * first; `POST` to the same path appends a comment authored by the caller.
 * The author is embedded as the shared `UserPublic` shape.
 */

import { apiFetch } from './client'
import type { User } from '../state/AuthContext'

/** A ticket comment as returned by the API. */
export interface Comment {
  id: number
  ticket_id: number
  body: string
  author: User
  created_at: string
}

/** Load the ticket's comments, oldest first. */
export function listComments(
  ticketId: number,
  token: string | null,
): Promise<Comment[]> {
  return apiFetch<Comment[]>(`/tickets/${ticketId}/comments`, { token })
}

/** Post a comment on the ticket and return the created comment. */
export function createComment(
  ticketId: number,
  body: string,
  token: string | null,
): Promise<Comment> {
  return apiFetch<Comment>(`/tickets/${ticketId}/comments`, {
    method: 'POST',
    body: { body },
    token,
  })
}
