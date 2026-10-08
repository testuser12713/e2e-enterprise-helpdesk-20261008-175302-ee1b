/* Authentication calls — the two endpoints the auth pages use.
   Both go through the shared `apiFetch` wrapper so error bodies are
   normalised into `ApiError` (status, code, message, per-field `fields`). */

import { apiFetch } from './client'
import type { User } from '../state/AuthContext'

/** Response of `POST /auth/login` (shared interface). */
export interface LoginResponse {
  access_token: string
  token_type: string
  user: User
}

/** `POST /auth/register` — creates a Melder account, returns the user. */
export function registerRequest(
  email: string,
  fullName: string,
  password: string,
): Promise<User> {
  return apiFetch<User>('/auth/register', {
    method: 'POST',
    body: { email, full_name: fullName, password },
  })
}

/** `POST /auth/login` — returns the session token and the signed-in user. */
export function loginRequest(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}
