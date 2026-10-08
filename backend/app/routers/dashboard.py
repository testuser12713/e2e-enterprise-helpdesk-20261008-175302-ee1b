"""Dashboard metric routes.

The metrics are computed straight from the ``tickets`` table so they always
reflect what is actually stored:

* ``open``          tickets in status ``open`` or ``in_progress``
* ``overdue``       open tickets whose ``due_at`` lies before now
* ``closed_today``  tickets whose ``closed_at`` falls on the current UTC day
* ``by_priority``   the open tickets, counted per priority value
"""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db import get_db
from app.models import PRIORITIES, Ticket, User
from app.schemas.dashboard import DashboardMetrics, PriorityDistribution

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Statuses that count as "open" for the dashboard.
OPEN_STATUSES = ("open", "in_progress")


def _scope_conditions(current_user: User) -> list:
    """Row-level scope for ``current_user``.

    A Melder only ever sees the tickets they created themselves; agents and
    admins see the global aggregates. Mirrors the Melder scoping rule in
    :mod:`app.services.ticket_query`.
    """
    if current_user.role == "melder":
        return [Ticket.created_by_id == current_user.id]
    return []


@router.get("/metrics", response_model=DashboardMetrics)
def metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardMetrics:
    """Return the dashboard metrics, scoped to the caller's role.

    All authenticated roles may call this: a Melder sees the figures for the
    tickets they created, agents and admins see the global aggregates.
    """
    now = datetime.now(UTC)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)

    scope = _scope_conditions(current_user)
    open_filter = Ticket.status.in_(OPEN_STATUSES)

    open_count = db.scalar(select(func.count()).select_from(Ticket).where(open_filter, *scope)) or 0
    overdue_count = (
        db.scalar(
            select(func.count())
            .select_from(Ticket)
            .where(
                open_filter,
                Ticket.due_at.is_not(None),
                Ticket.due_at < now,
                *scope,
            )
        )
        or 0
    )
    closed_today = (
        db.scalar(
            select(func.count())
            .select_from(Ticket)
            .where(
                Ticket.closed_at.is_not(None),
                Ticket.closed_at >= day_start,
                Ticket.closed_at < day_end,
                *scope,
            )
        )
        or 0
    )

    by_priority = dict.fromkeys(PRIORITIES, 0)
    rows = db.execute(
        select(Ticket.priority, func.count()).where(open_filter, *scope).group_by(Ticket.priority)
    ).all()
    for priority, count in rows:
        if priority in by_priority:
            by_priority[priority] = count

    return DashboardMetrics(
        open=open_count,
        overdue=overdue_count,
        closed_today=closed_today,
        by_priority=PriorityDistribution(**by_priority),
    )
