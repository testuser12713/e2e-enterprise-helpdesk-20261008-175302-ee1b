"""Schemas for the dashboard metrics endpoint."""

from pydantic import BaseModel


class PriorityDistribution(BaseModel):
    """How many open tickets exist per priority value."""

    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0


class DashboardMetrics(BaseModel):
    """Aggregated ticket metrics shown on the dashboard."""

    open: int
    overdue: int
    closed_today: int
    by_priority: PriorityDistribution
