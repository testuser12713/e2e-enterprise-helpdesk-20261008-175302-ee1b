import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth, type Role } from '../state/AuthContext'

const ROLE_LABELS: Record<Role, string> = {
  melder: 'Melder',
  agent: 'Agent',
  admin: 'Administrator',
}

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'nav-link nav-item active' : 'nav-link nav-item'
}

export default function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="app-sidebar sidebar" id="sidebar" data-od-id="sidebar">
      <div className="sidebar-brand">Helpdesk</div>

      <nav
        className="sidebar-nav nav"
        aria-label="Hauptnavigation"
        data-od-id="main-nav"
      >
        <NavLink to="/" end className={navLinkClass} data-od-id="nav-dashboard">
          Dashboard
        </NavLink>
        <NavLink to="/tickets" className={navLinkClass} data-od-id="nav-tickets">
          Tickets
        </NavLink>
        {user?.role === 'admin' && (
          <NavLink to="/users" className={navLinkClass} data-od-id="nav-users">
            Benutzerverwaltung
          </NavLink>
        )}
      </nav>

      <div className="sidebar-spacer" />

      <div
        className="sidebar-user sidebar-bottom"
        data-od-id="sidebar-user"
      >
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
