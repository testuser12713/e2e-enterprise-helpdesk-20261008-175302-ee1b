/* Admin user-management API calls. All requests go through the shared
   `apiFetch` wrapper (see ./client), which adds the bearer token and turns
   error responses into `ApiError`. */

import { apiFetch } from './client'
import type { Role, User } from '../state/AuthContext'

/**
 * A user as returned by `GET /users`. It is the shared `UserPublic` shape; the
 * wire object may additionally carry `last_login`, which this type models as
 * optional so the table can render the "Letzte Anmeldung" column.
 */
export interface ManagedUser extends User {
  last_login?: string | null
}

export interface CreateUserInput {
  email: string
  full_name: string
  password: string
  role: Role
}

export interface UpdateUserInput {
  role?: Role
  is_active?: boolean
}

export interface UserFilters {
  role?: Role
  is_active?: boolean
}

/** `GET /users?role&is_active` — list all users (admin only). */
export function listUsers(
  token: string | null,
  filters: UserFilters = {},
): Promise<ManagedUser[]> {
  const params = new URLSearchParams()
  if (filters.role) {
    params.set('role', filters.role)
  }
  if (filters.is_active !== undefined) {
    params.set('is_active', String(filters.is_active))
  }
  const query = params.toString()
  return apiFetch<ManagedUser[]>(`/users${query ? `?${query}` : ''}`, { token })
}

/** `POST /users` — create a user (admin only). */
export function createUser(
  token: string | null,
  input: CreateUserInput,
): Promise<ManagedUser> {
  return apiFetch<ManagedUser>('/users', { method: 'POST', body: input, token })
}

/** `PATCH /users/{id}` — change role and/or active state (admin only). */
export function updateUser(
  token: string | null,
  userId: number,
  input: UpdateUserInput,
): Promise<ManagedUser> {
  return apiFetch<ManagedUser>(`/users/${userId}`, {
    method: 'PATCH',
    body: input,
    token,
  })
}
