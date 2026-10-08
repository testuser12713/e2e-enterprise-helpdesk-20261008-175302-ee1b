import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth, type Role } from '../state/AuthContext'

const ROLE_LABELS: Record<Role, string> = {
  melder: 'Melder',
  agent: 'Agent',
  admin: 'Administrator',
}

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'nav-link active' : 'nav-link'
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

export default function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

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
        <NavLink to="/" end className={navLinkClass} data-od-id="nav-dashboard">
          <DashboardIcon />
          Dashboard
        </NavLink>
        <NavLink to="/tickets" className={navLinkClass} data-od-id="nav-tickets">
          <TicketsIcon />
          Tickets
        </NavLink>
        {user?.role === 'admin' && (
          <NavLink to="/users" className={navLinkClass} data-od-id="nav-users">
            <UsersIcon />
            Benutzerverwaltung
          </NavLink>
        )}
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
