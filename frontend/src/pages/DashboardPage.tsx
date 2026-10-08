import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDashboardMetrics, type DashboardMetrics } from '../api/dashboard'
import { useAuth } from '../state/AuthContext'
import './DashboardPage.css'

const SKELETON_COUNT = 4

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'] as const
type PriorityKey = (typeof PRIORITY_ORDER)[number]

interface PriorityMeta {
  label: string
  barClass: string
  badgeClass: string
}

const PRIORITY_META: Record<PriorityKey, PriorityMeta> = {
  critical: {
    label: 'Kritisch',
    barClass: 'prio-critical',
    badgeClass: 'badge-priority-critical',
  },
  high: {
    label: 'Hoch',
    barClass: 'prio-high',
    badgeClass: 'badge-priority-high',
  },
  medium: {
    label: 'Mittel',
    barClass: 'prio-medium',
    badgeClass: 'badge-priority-medium',
  },
  low: {
    label: 'Niedrig',
    barClass: 'prio-low',
    badgeClass: 'badge-priority-low',
  },
}

const LOAD_ERROR_MESSAGE =
  'Die Kennzahlen konnten nicht geladen werden. Bitte versuchen Sie es erneut.'

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export default function DashboardPage() {
  const { token } = useAuth()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setHasError(false)

    fetchDashboardMetrics(token, controller.signal)
      .then((data) => {
        setMetrics(data)
        setIsLoading(false)
      })
      .catch((error: unknown) => {
        if (isAbort(error)) {
          return
        }
        setIsLoading(false)
        setHasError(true)
      })

    return () => controller.abort()
  }, [token, reloadKey])

  const retry = useCallback(() => {
    setReloadKey((key) => key + 1)
  }, [])

  const maxPriorityCount = metrics
    ? Math.max(...PRIORITY_ORDER.map((key) => metrics.by_priority[key]))
    : 0

  return (
    <section className="page-section" data-testid="page-dashboard">
      <header className="page-header" data-od-id="page-header">
        <div>
          <h1 data-od-id="page-title">Dashboard</h1>
          <p className="page-header-description">
            Überblick über offene Anfragen und Kennzahlen.
          </p>
        </div>
        <Link
          className="btn btn-primary"
          to="/tickets"
          data-od-id="new-ticket-btn"
        >
          Neues Ticket
        </Link>
      </header>

      {isLoading && (
        <section
          className="metric-grid"
          data-od-id="metric-grid"
          data-testid="dashboard-loading"
          aria-busy="true"
          aria-label="Kennzahlen werden geladen"
        >
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <article className="metric-card" key={index}>
              <div className="skeleton skeleton-label" />
              <div className="skeleton skeleton-value" />
            </article>
          ))}
        </section>
      )}

      {!isLoading && hasError && (
        <div
          className="alert alert-danger dashboard-error"
          data-testid="dashboard-error"
          role="alert"
        >
          <span>{LOAD_ERROR_MESSAGE}</span>
          <button type="button" className="btn btn-secondary" onClick={retry}>
            Erneut versuchen
          </button>
        </div>
      )}

      {!isLoading && !hasError && metrics && (
        <section className="metric-grid" data-od-id="metric-grid">
          <article className="metric-card" data-od-id="metric-open">
            <div className="metric-label">Offene Tickets</div>
            <div className="metric-value">{metrics.open}</div>
            <div className="metric-sub">{metrics.overdue} davon überfällig</div>
          </article>

          <article
            className="metric-card danger"
            data-od-id="metric-overdue"
          >
            <div className="metric-label">Überfällige Tickets</div>
            <div className="metric-value">{metrics.overdue}</div>
            <div className="metric-sub">benötigen Aufmerksamkeit</div>
          </article>

          <article
            className="metric-card success"
            data-od-id="metric-closed-today"
          >
            <div className="metric-label">Heute geschlossen</div>
            <div className="metric-value">{metrics.closed_today}</div>
            <div className="metric-sub">abgeschlossene Tickets</div>
          </article>

          <article className="metric-card" data-od-id="metric-priority">
            <div className="metric-label">Verteilung nach Priorität</div>
            <div className="prio-dist">
              {PRIORITY_ORDER.map((key) => {
                const meta = PRIORITY_META[key]
                const count = metrics.by_priority[key]
                const width =
                  maxPriorityCount > 0
                    ? `${(count / maxPriorityCount) * 100}%`
                    : '0%'
                return (
                  <div className="prio-row" key={key}>
                    <span className="prio-label">{meta.label}</span>
                    <span className="prio-count">{count}</span>
                    <span className={`badge ${meta.badgeClass}`}>
                      {meta.label.toLowerCase()}
                    </span>
                    <div className="prio-bar">
                      <span
                        className={meta.barClass}
                        style={{ width }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </article>
        </section>
      )}
    </section>
  )
}
