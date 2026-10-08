/* The one fetch wrapper for the whole frontend.
   Every API module imports `apiFetch` (and the `ApiError` type) from here —
   no component calls `fetch` directly. */

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    fields?: Record<string, string>
  }
}

/** Unified error thrown for every non-2xx response (and for network failures). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: Record<string, string>

  constructor(
    status: number,
    code: string,
    message: string,
    fields: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

/** Base URL of the backend, e.g. `http://localhost:8000`. */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? ''

/** All product endpoints live under this prefix (shared interface). */
export const API_PREFIX = '/api/v1'

function buildUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${API_PREFIX}${suffix}`
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  token?: string | null
  signal?: AbortSignal
}

/**
 * Perform a JSON request against the API.
 *
 * Adds the JSON headers and, when a token is given, the `Authorization:
 * Bearer <token>` header. Non-2xx responses are turned into an `ApiError`
 * carrying the server's `message` and per-field `fields`.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, token, signal } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw cause
    }
    throw new ApiError(
      0,
      'network_error',
      'Die Verbindung zum Server konnte nicht hergestellt werden. Bitte versuchen Sie es erneut.',
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  let payload: unknown = null
  if (text.length > 0) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody | null
    const code = errorBody?.error?.code ?? `http_${response.status}`
    const message =
      errorBody?.error?.message ??
      'Es ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es erneut.'
    const fields = errorBody?.error?.fields ?? {}
    throw new ApiError(response.status, code, message, fields)
  }

  return payload as T
}
