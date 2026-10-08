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

export default function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">Helpdesk</div>

      <nav className="sidebar-nav" aria-label="Hauptnavigation">
        <NavLink to="/" end className={navLinkClass}>
          Dashboard
        </NavLink>
        <NavLink to="/tickets" className={navLinkClass}>
          Tickets
        </NavLink>
        {user?.role === 'admin' && (
          <NavLink to="/users" className={navLinkClass}>
            Benutzerverwaltung
          </NavLink>
        )}
      </nav>

      <div className="sidebar-spacer" />

      <div className="sidebar-user">
        {user && (
          <>
            <span className="sidebar-user-name">{user.full_name}</span>
            <span className="role-badge">{ROLE_LABELS[user.role]}</span>
          </>
        )}
        <button type="button" className="btn btn-ghost" onClick={handleLogout}>
          Abmelden
        </button>
      </div>
    </aside>
  )
}
