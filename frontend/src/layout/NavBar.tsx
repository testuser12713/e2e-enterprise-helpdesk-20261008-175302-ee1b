import { NavLink, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth, type Role, type User } from '../state/AuthContext'

const ROLE_LABELS: Record<Role, string> = {
  melder: 'Melder',
  agent: 'Agent',
  admin: 'Administrator',
}

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'nav-link active' : 'nav-link'
}

/**
 * A single navigation entry. `data-od-id` is the stable selector the mockups
 * and the browser tests use.
 */
interface NavItem {
  to: string
  label: string
  icon: ReactNode
  id: string
  /** Only the dashboard is matched exactly (`end`) so it is not active on sub-routes. */
  end?: boolean
}

function DashboardIcon() {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function TicketsIcon() {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 7h18M8 3v4M16 3v4" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        <path d="M21 12a9 9 0 1 1-9-9" />
        <path d="M3 12h18" />
        <path d="M12 3a15 15 0 0 1 0 18" />
      </svg>
    </span>
  )
}

const DASHBOARD_ITEM: NavItem = {
  to: '/',
  label: 'Dashboard',
  icon: <DashboardIcon />,
  id: 'nav-dashboard',
  end: true,
}

const TICKETS_ITEM: NavItem = {
  to: '/tickets',
  label: 'Tickets',
  icon: <TicketsIcon />,
  id: 'nav-tickets',
}

const USERS_ITEM: NavItem = {
  to: '/users',
  label: 'Benutzerverwaltung',
  icon: <UsersIcon />,
  id: 'nav-users',
}

/**
 * The navigation entries every signed-in role sees. Explicit and complete: a
 * role that is missing here falls back to the non-admin list, never to admin.
 */
const COMMON_ITEMS: readonly NavItem[] = [DASHBOARD_ITEM, TICKETS_ITEM]

const NAV_ITEMS_BY_ROLE: Record<Role, readonly NavItem[]> = {
  melder: COMMON_ITEMS,
  agent: COMMON_ITEMS,
  admin: [...COMMON_ITEMS, USERS_ITEM],
}

/**
 * The sidebar entry list for a session. Derived once, so the admin entry can
 * only appear for `role === 'admin'` and never while the session is still being
 * restored (`isLoading`) or absent (`user === null`) — not even for one frame.
 */
export function navItemsFor(
  user: User | null,
  isLoading: boolean,
): readonly NavItem[] {
  if (isLoading || user === null) {
    return COMMON_ITEMS
  }
  return NAV_ITEMS_BY_ROLE[user.role] ?? COMMON_ITEMS
}

export default function NavBar() {
  const { user, isLoading, logout } = useAuth()
  const navigate = useNavigate()

  const items = navItemsFor(user, isLoading)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="app-sidebar" id="sidebar" data-od-id="sidebar">
      <div className="sidebar-brand">
        <BrandMark />
        <span className="brand-name">Helpdesk</span>
      </div>

      <nav
        className="sidebar-nav"
        aria-label="Hauptnavigation"
        data-od-id="main-nav"
      >
        {items.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            end={item.end}
            className={navLinkClass}
            data-od-id={item.id}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-spacer" />

      <div className="sidebar-user" data-od-id="sidebar-user">
        {user && (
          <>
            <span className="sidebar-user-name">{user.full_name}</span>
            <span className="role-badge">{ROLE_LABELS[user.role]}</span>
          </>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          data-od-id="logout-btn"
          onClick={handleLogout}
        >
          Abmelden
        </button>
      </div>
    </aside>
  )
}
