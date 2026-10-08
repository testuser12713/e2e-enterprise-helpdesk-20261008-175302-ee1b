import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'

export type Role = 'melder' | 'agent' | 'admin'

/** The current user, matching the API's `UserPublic`. */
export interface User {
  id: number
  email: string
  full_name: string
  role: Role
  is_active: boolean
}

interface LoginResponse {
  access_token: string
  token_type: string
  user: User
}

interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (
    email: string,
    full_name: string,
    password: string,
  ) => Promise<User>
  logout: () => void
}

const TOKEN_STORAGE_KEY = 'helpdesk_token'

/** Routes reachable without a session. Every other route is protected. */
const PUBLIC_PATHS = ['/login', '/register']

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()

  // Restore a persisted session on first mount.
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!stored) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    setToken(stored)
    apiFetch<User>('/auth/me', { token: stored })
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser)
        }
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_STORAGE_KEY)
          setToken(null)
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  // AC-18: a protected route without a session leads back to the login page.
  // The redirect is scheduled for after the current render so a session that
  // is still being restored is never interrupted mid-flight.
  useEffect(() => {
    if (isLoading) {
      return
    }
    const isPublic = PUBLIC_PATHS.includes(location.pathname)
    if (user || isPublic) {
      return
    }
    const timer = window.setTimeout(() => {
      navigate('/login', { replace: true })
    }, 0)
    return () => {
      window.clearTimeout(timer)
    }
  }, [isLoading, user, location.pathname, navigate])

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    localStorage.setItem(TOKEN_STORAGE_KEY, result.access_token)
    setToken(result.access_token)
    setUser(result.user)
    return result.user
  }, [])

  const register = useCallback(
    async (email: string, full_name: string, password: string) => {
      await apiFetch<User>('/auth/register', {
        method: 'POST',
        body: { email, full_name, password },
      })
      // Registration returns the user without a token; establish the session
      // right away so the caller can navigate straight into the app.
      return login(email, password)
    },
    [login],
  )

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, login, register, logout }),
    [user, token, isLoading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
