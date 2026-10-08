/* Dashboard metrics API client.
   Mirrors `GET /api/v1/dashboard/metrics` from the shared interface. */

import { apiFetch } from './client'

/** How many open tickets exist per priority value. */
export interface PriorityDistribution {
  critical: number
  high: number
  medium: number
  low: number
}

/** Aggregated ticket metrics shown on the dashboard. */
export interface DashboardMetrics {
  open: number
  overdue: number
  closed_today: number
  by_priority: PriorityDistribution
}

/**
 * Fetch the dashboard metrics for the signed-in agent/admin.
 *
 * The endpoint is role-protected, so a `403` surfaces as an `ApiError` that the
 * caller renders as a readable German error state.
 */
export function fetchDashboardMetrics(
  token: string | null,
  signal?: AbortSignal,
): Promise<DashboardMetrics> {
  return apiFetch<DashboardMetrics>('/dashboard/metrics', { token, signal })
}
