/**
 * Ticket detail API and the shared German label/format helpers the detail page
 * and the change log use.
 *
 * All endpoints live under `/api/v1` and are reached through the single
 * `apiFetch` wrapper, so auth, the unified error body and the JSON headers are
 * handled in exactly one place.
 */

import { apiFetch } from './client'
import type { User } from '../state/AuthContext'

export type Category = 'hardware' | 'software' | 'network' | 'access' | 'other'
export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type TicketStatus = 'open' | 'in_progress' | 'closed'

/** A ticket as returned by `GET /tickets/{id}` (shared `Ticket` shape). */
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

/** One entry of a ticket's change log (shared `HistoryEntry` shape). */
export interface HistoryEntry {
  field: string
  old_value: string | null
  new_value: string | null
  actor: User
  created_at: string
}

/** Editable fields of a ticket, sent as a partial `PATCH`. */
export interface TicketUpdatePayload {
  title?: string
  description?: string
  category?: Category
  priority?: Priority
}

/** German labels for the five ticket categories. */
export const CATEGORY_LABELS: Record<Category, string> = {
  hardware: 'Hardware',
  software: 'Software',
  network: 'Netzwerk',
  access: 'Zugriff',
  other: 'Sonstiges',
}

/** German labels for the four priorities. */
export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: 'kritisch',
  high: 'hoch',
  medium: 'mittel',
  low: 'niedrig',
}

/** German labels for the three ticket statuses. */
export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'offen',
  in_progress: 'in Bearbeitung',
  closed: 'geschlossen',
}

/** German labels for the change-log fields. */
export const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  priority: 'Priorität',
  category: 'Kategorie',
  assignee: 'Zuständigkeit',
}

/** Format an ISO-8601 UTC timestamp as local 'TT.MM.JJJJ, HH:MM'. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return '—'
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  const pad = (value: number) => String(value).padStart(2, '0')
  return (
    `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/**
 * Render an overdue span relative and short: '12 Min.', '3 Std.', '2 Tagen'.
 * The caller prefixes the German label 'überfällig seit'.
 */
export function formatOverdueSince(iso: string, now: Date = new Date()): string {
  const due = new Date(iso)
  if (Number.isNaN(due.getTime())) {
    return '—'
  }
  const minutes = Math.max(0, Math.floor((now.getTime() - due.getTime()) / 60_000))
  if (minutes < 60) {
    return `${minutes} Min.`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} Std.`
  }
  const days = Math.floor(hours / 24)
  return `${days} Tagen`
}

/** Render a change-log old/new value in German (assignee names pass through). */
export function formatHistoryValue(field: string, value: string | null): string {
  if (value === null || value === '') {
    return '—'
  }
  if (field === 'status') {
    return STATUS_LABELS[value as TicketStatus] ?? value
  }
  if (field === 'priority') {
    return PRIORITY_LABELS[value as Priority] ?? value
  }
  if (field === 'category') {
    return CATEGORY_LABELS[value as Category] ?? value
  }
  return value
}

/** Fetch one ticket. */
export function getTicket(id: number, token: string | null): Promise<Ticket> {
  return apiFetch<Ticket>(`/tickets/${id}`, { token })
}

/** Apply a partial update and return the stored ticket. */
export function updateTicket(
  id: number,
  payload: TicketUpdatePayload,
  token: string | null,
): Promise<Ticket> {
  return apiFetch<Ticket>(`/tickets/${id}`, { method: 'PATCH', body: payload, token })
}

/** Assign the ticket to an active agent/admin and return the stored ticket. */
export function assignTicket(
  id: number,
  assigneeId: number,
  token: string | null,
): Promise<Ticket> {
  return apiFetch<Ticket>(`/tickets/${id}/assign`, {
    method: 'POST',
    body: { assignee_id: assigneeId },
    token,
  })
}

/** Close the ticket and return the stored ticket. */
export function closeTicket(id: number, token: string | null): Promise<Ticket> {
  return apiFetch<Ticket>(`/tickets/${id}/close`, { method: 'POST', token })
}

/** Load the ticket's change log (the API returns it oldest first). */
export function listTicketHistory(
  id: number,
  token: string | null,
): Promise<HistoryEntry[]> {
  return apiFetch<HistoryEntry[]>(`/tickets/${id}/history`, { token })
}

/** Load the active agents/admins for the assignment dropdown. */
export function listAssignableUsers(token: string | null): Promise<User[]> {
  return apiFetch<User[]>('/users/assignable', { token })
}
