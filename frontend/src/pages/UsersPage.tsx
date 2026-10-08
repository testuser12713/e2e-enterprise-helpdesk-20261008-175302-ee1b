import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { listUsers, updateUser, type ManagedUser } from '../api/users'
import ConfirmDialog from '../components/ConfirmDialog'
import UserForm, { ROLE_OPTIONS } from '../components/UserForm'
import { useAuth, type Role } from '../state/AuthContext'

interface Feedback {
  kind: 'success' | 'error'
  message: string
}

const ROLE_LABELS: Record<Role, string> = {
  melder: 'Melder',
  agent: 'Agent',
  admin: 'Administrator',
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return 'Es ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es erneut.'
}

/**
 * Benutzerverwaltung (AC-11): admins create users, change their role and
 * deactivate accounts. Only administrators may reach this page.
 */
export default function UsersPage() {
  const { user, token } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [pendingDeactivate, setPendingDeactivate] = useState<ManagedUser | null>(
    null,
  )
  const [busyUserId, setBusyUserId] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!token) {
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const result = await listUsers(token)
      setUsers(result)
    } catch (error) {
      setLoadError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (isAdmin) {
      void load()
    }
  }, [isAdmin, load])

  const handleCreated = (created: ManagedUser) => {
    setShowForm(false)
    setFeedback({
      kind: 'success',
      message: `Benutzer „${created.full_name}“ wurde angelegt.`,
    })
    void load()
  }

  const handleRoleChange = async (managedUser: ManagedUser, role: Role) => {
    if (!token) {
      return
    }
    setBusyUserId(managedUser.id)
    setFeedback(null)
    try {
      await updateUser(token, managedUser.id, { role })
      setFeedback({
        kind: 'success',
        message: `Rolle von „${managedUser.full_name}“ geändert zu „${ROLE_LABELS[role]}“.`,
      })
      await load()
    } catch (error) {
      setFeedback({ kind: 'error', message: errorMessage(error) })
    } finally {
      setBusyUserId(null)
    }
  }

  const confirmDeactivate = async () => {
    if (!token || !pendingDeactivate) {
      return
    }
    const target = pendingDeactivate
    setBusyUserId(target.id)
    setFeedback(null)
    try {
      await updateUser(token, target.id, { is_active: false })
      setPendingDeactivate(null)
      setFeedback({
        kind: 'success',
        message: `Benutzer „${target.full_name}“ wurde deaktiviert.`,
      })
      await load()
    } catch (error) {
      setFeedback({ kind: 'error', message: errorMessage(error) })
    } finally {
      setBusyUserId(null)
    }
  }

  if (!isAdmin) {
    return (
      <section className="page-section" data-testid="page-users">
        <header className="page-header" data-testid="page-header">
          <div>
            <h1 data-testid="page-title">Benutzerverwaltung</h1>
          </div>
        </header>
        <div className="card" data-testid="users-access-denied">
          <div className="empty-state">
            <h2>Kein Zugriff</h2>
            <p>
              Nur Administratoren dürfen die Benutzerverwaltung öffnen.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="page-section" data-testid="page-users">
      <header className="page-header" data-testid="page-header">
        <div>
          <h1 data-testid="page-title">Benutzerverwaltung</h1>
          <p className="page-header-description">
            Benutzer anlegen, Rollen ändern und Konten deaktivieren.
          </p>
        </div>
        <div className="page-actions">
          {!showForm && (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="new-user-btn"
              onClick={() => {
                setFeedback(null)
                setShowForm(true)
              }}
            >
              Benutzer anlegen
            </button>
          )}
        </div>
      </header>

      {feedback && (
        <div
          className={
            feedback.kind === 'success'
              ? 'alert alert-success'
              : 'alert alert-danger'
          }
          role={feedback.kind === 'success' ? 'status' : 'alert'}
        >
          {feedback.message}
        </div>
      )}

      {showForm && (
        <UserForm
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      <section data-testid="users-list-section">
        <div data-testid="users-table-wrap">
          {loadError ? (
            <div className="alert alert-danger" role="alert">
              {loadError}
            </div>
          ) : loading && users.length === 0 ? (
            <div className="card" role="status">
              Benutzer werden geladen …
            </div>
          ) : users.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <h2>Keine Benutzer vorhanden</h2>
                <p>
                  Legen Sie den ersten Benutzer über „Benutzer anlegen“ an.
                </p>
              </div>
            </div>
          ) : (
            <div className="data-table">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>E-Mail</th>
                      <th>Rolle</th>
                      <th>Status</th>
                      <th>Letzte Anmeldung</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((managedUser) => {
                      const inactive = !managedUser.is_active
                      const busy = busyUserId === managedUser.id
                      return (
                        <tr
                          key={managedUser.id}
                          style={
                            inactive
                              ? { color: 'var(--color-fg-muted)' }
                              : undefined
                          }
                        >
                          <td>{managedUser.full_name}</td>
                          <td>{managedUser.email}</td>
                          <td>
                            <select
                              className="select"
                              style={{ height: 36, width: 150 }}
                              aria-label={`Rolle von ${managedUser.full_name}`}
                              value={managedUser.role}
                              disabled={inactive || busy}
                              onChange={(event) =>
                                void handleRoleChange(
                                  managedUser,
                                  event.target.value as Role,
                                )
                              }
                            >
                              {ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {inactive ? (
                              <span className="badge badge-status-closed">
                                deaktiviert
                              </span>
                            ) : (
                              <span
                                className="badge"
                                style={{
                                  background: 'var(--color-success-bg)',
                                  color: 'var(--color-success)',
                                  borderColor: 'var(--color-success-border)',
                                }}
                              >
                                aktiv
                              </span>
                            )}
                          </td>
                          <td className="tnum">
                            {formatDateTime(managedUser.last_login)}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-danger"
                              disabled={inactive || busy}
                              title={
                                inactive
                                  ? 'Dieser Benutzer ist bereits deaktiviert'
                                  : undefined
                              }
                              onClick={() => {
                                setFeedback(null)
                                setPendingDeactivate(managedUser)
                              }}
                            >
                              Deaktivieren
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={pendingDeactivate !== null}
        title="Benutzer deaktivieren?"
        body={
          pendingDeactivate
            ? `Sind Sie sicher, dass Sie „${pendingDeactivate.full_name}“ deaktivieren möchten? Eine Anmeldung ist danach nicht mehr möglich.`
            : ''
        }
        confirmLabel="Deaktivieren"
        danger
        busy={busyUserId === pendingDeactivate?.id}
        onConfirm={() => void confirmDeactivate()}
        onCancel={() => setPendingDeactivate(null)}
      />
    </section>
  )
}
