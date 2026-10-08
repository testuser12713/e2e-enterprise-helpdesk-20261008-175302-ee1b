/* Ticket list / create / export API module.

   Every request goes through the shared `apiFetch` wrapper so errors keep the
   unified shape. The query builder is shared by the list and the CSV export so
   both always send exactly the same active filters and search. */

import { API_BASE_URL, API_PREFIX, ApiError, apiFetch } from './client'
import type { User } from '../state/AuthContext'

export type Category = 'hardware' | 'software' | 'network' | 'access' | 'other'
export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type TicketStatus = 'open' | 'in_progress' | 'closed'
export type TicketSort = 'due_at' | 'priority' | 'created_at'
export type SortOrder = 'asc' | 'desc'

/** A ticket exactly as the shared API contract returns it. */
export interface Ticket {
  id: number
  title: string
  description: string
  category: Category
  priority: Priority
  status: TicketStatus
  created_by: number
  assignee: User | null
  due_at: string | null
  is_overdue: boolean
  created_at: string
  updated_at: string
  closed_at: string | null
}

export interface TicketListResponse {
  items: Ticket[]
  total: number
  page: number
  page_size: number
  pages: number
}

/** Query parameters accepted by `GET /tickets` and `GET /tickets/export`. */
export interface TicketFilters {
  search?: string
  status?: TicketStatus | ''
  priority?: Priority | ''
  assignee_id?: number | null
  sort?: TicketSort
  order?: SortOrder
  page?: number
  page_size?: number
}

export interface TicketCreateInput {
  title: string
  description: string
  category: Category
  priority: Priority
}

export const CATEGORY_LABELS: Record<Category, string> = {
  hardware: 'Hardware',
  software: 'Software',
  network: 'Netzwerk',
  access: 'Zugang',
  other: 'Sonstiges',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: 'kritisch',
  high: 'hoch',
  medium: 'mittel',
  low: 'niedrig',
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'offen',
  in_progress: 'in Bearbeitung',
  closed: 'geschlossen',
}

/** Sort ranking: kritisch > hoch > mittel > niedrig (DESIGN.md). */
export const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

/** Build the query string shared by the list request and the CSV export. */
export function buildTicketQuery(
  filters: TicketFilters,
  options: { includePaging?: boolean } = {},
): string {
  const params = new URLSearchParams()
  if (filters.search) {
    params.set('search', filters.search)
  }
  if (filters.status) {
    params.set('status', filters.status)
  }
  if (filters.priority) {
    params.set('priority', filters.priority)
  }
  if (filters.assignee_id !== undefined && filters.assignee_id !== null) {
    params.set('assignee_id', String(filters.assignee_id))
  }
  if (filters.sort) {
    params.set('sort', filters.sort)
  }
  if (filters.order) {
    params.set('order', filters.order)
  }
  if (options.includePaging) {
    if (filters.page !== undefined) {
      params.set('page', String(filters.page))
    }
    if (filters.page_size !== undefined) {
      params.set('page_size', String(filters.page_size))
    }
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

interface TicketRequestOptions {
  token?: string | null
  signal?: AbortSignal
}

/** `GET /tickets` with the active filter combination. */
export async function listTickets(
  filters: TicketFilters = {},
  options: TicketRequestOptions = {},
): Promise<TicketListResponse> {
  const query = buildTicketQuery(filters, { includePaging: true })
  return apiFetch<TicketListResponse>(`/tickets${query}`, {
    token: options.token,
    signal: options.signal,
  })
}

/** `GET /users/assignable` — active agents and administrators. */
export async function getAssignableUsers(
  options: TicketRequestOptions = {},
): Promise<User[]> {
  return apiFetch<User[]>('/users/assignable', {
    token: options.token,
    signal: options.signal,
  })
}

/** `POST /tickets` — the ticket starts open with a due date derived from priority. */
export async function createTicket(
  input: TicketCreateInput,
  token: string | null,
): Promise<Ticket> {
  return apiFetch<Ticket>('/tickets', { method: 'POST', body: input, token })
}

/**
 * `GET /tickets/export` — fetch the filtered CSV as a blob. The endpoint needs
 * the bearer token, so a plain link cannot be used; the caller turns the blob
 * into a download.
 */
export async function exportTicketsCsv(
  filters: TicketFilters,
  token: string | null,
): Promise<Blob> {
  const query = buildTicketQuery(filters, { includePaging: false })
  const headers: Record<string, string> = { Accept: 'text/csv' }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/tickets/export${query}`,
    { headers },
  )
  if (!response.ok) {
    throw new ApiError(
      response.status,
      `http_${response.status}`,
      'Der CSV-Export konnte nicht erstellt werden. Bitte versuchen Sie es erneut.',
    )
  }
  return response.blob()
}
