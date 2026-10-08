import { Outlet } from 'react-router-dom'
import NavBar from './NavBar'

/** Fixed application shell: sidebar navigation on the left, routed page on the right. */
export default function AppShell() {
  return (
    <div className="app-shell">
      <NavBar />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}
