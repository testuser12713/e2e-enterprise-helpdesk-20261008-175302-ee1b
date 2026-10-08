"""Tests for the dashboard metrics endpoint.

The metrics are global aggregates over the ``tickets`` table, so each test
compares the endpoint against counts taken directly from the database rather
than assuming an otherwise empty table. The behaviour-specific tests use a
before/after delta so they stay correct on a shared database.
"""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.security import create_access_token
from app.db import get_session_factory
from app.models import Ticket, User

OPEN_STATUSES = ("open", "in_progress")
PRIORITIES = ("critical", "high", "medium", "low")


@pytest.fixture()
def make_user() -> Callable[..., tuple[User, str]]:
    """Create a persisted user and return it together with a signed token."""

    def _make(role: str = "agent") -> tuple[User, str]:
        db = get_session_factory()()
        try:
            user = User(
                email=f"dashboard-{uuid4().hex}@example.com",
                full_name=f"Dashboard {role}",
                password_hash="x",
                role=role,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return user, create_access_token(user)
        finally:
            db.close()

    return _make


@pytest.fixture()
def create_ticket() -> Callable[..., Ticket]:
    """Create a persisted ticket with sensible defaults."""

    def _make(
        *,
        created_by_id: int,
        priority: str = "medium",
        status: str = "open",
        due_at: datetime | None = None,
        closed_at: datetime | None = None,
    ) -> Ticket:
        db = get_session_factory()()
        try:
            ticket = Ticket(
                title=f"Ticket {uuid4().hex[:8]}",
                description="",
                category="other",
                priority=priority,
                status=status,
                created_by_id=created_by_id,
                due_at=due_at,
                closed_at=closed_at,
            )
            db.add(ticket)
            db.commit()
            db.refresh(ticket)
            return ticket
        finally:
            db.close()

    return _make


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _stored_counts() -> dict:
    """Count the metrics directly in the database, with the same rules."""
    db = get_session_factory()()
    try:
        now = datetime.now(UTC)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        open_filter = Ticket.status.in_(OPEN_STATUSES)

        open_count = db.scalar(select(func.count()).select_from(Ticket).where(open_filter)) or 0
        overdue_count = (
            db.scalar(
                select(func.count())
                .select_from(Ticket)
                .where(open_filter, Ticket.due_at.is_not(None), Ticket.due_at < now)
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
                )
            )
            or 0
        )

        by_priority = dict.fromkeys(PRIORITIES, 0)
        rows = db.execute(
            select(Ticket.priority, func.count()).where(open_filter).group_by(Ticket.priority)
        ).all()
        for priority, count in rows:
            if priority in by_priority:
                by_priority[priority] = count

        return {
            "open": open_count,
            "overdue": overdue_count,
            "closed_today": closed_today,
            "by_priority": by_priority,
        }
    finally:
        db.close()


def _get_metrics(client: TestClient, token: str) -> dict:
    response = client.get("/api/v1/dashboard/metrics", headers=_auth(token))
    assert response.status_code == 200
    return response.json()


def test_metrics_rejects_melder(client: TestClient, make_user: Callable) -> None:
    _, token = make_user("melder")
    response = client.get("/api/v1/dashboard/metrics", headers=_auth(token))
    assert response.status_code == 403


def test_metrics_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/dashboard/metrics")
    assert response.status_code == 401


def test_metrics_match_stored_tickets(
    client: TestClient,
    make_user: Callable,
    create_ticket: Callable,
) -> None:
    user, token = make_user("agent")
    create_ticket(created_by_id=user.id, priority="critical", status="open")
    create_ticket(created_by_id=user.id, priority="high", status="in_progress")
    create_ticket(created_by_id=user.id, priority="low", status="open")
    create_ticket(created_by_id=user.id, priority="medium", status="closed")

    body = _get_metrics(client, token)
    expected = _stored_counts()

    assert body["open"] == expected["open"]
    assert body["overdue"] == expected["overdue"]
    assert body["closed_today"] == expected["closed_today"]
    assert body["by_priority"] == expected["by_priority"]
    assert set(body["by_priority"]) == set(PRIORITIES)


def test_past_due_open_ticket_counts_as_overdue(
    client: TestClient,
    make_user: Callable,
    create_ticket: Callable,
) -> None:
    user, token = make_user("agent")
    before = _stored_counts()
    create_ticket(
        created_by_id=user.id,
        priority="high",
        status="open",
        due_at=datetime.now(UTC) - timedelta(days=1),
    )

    body = _get_metrics(client, token)
    assert body["overdue"] == before["overdue"] + 1
    assert body["overdue"] == _stored_counts()["overdue"]


def test_ticket_closed_today_is_counted(
    client: TestClient,
    make_user: Callable,
    create_ticket: Callable,
) -> None:
    user, token = make_user("agent")
    before = _stored_counts()
    create_ticket(
        created_by_id=user.id,
        priority="medium",
        status="closed",
        closed_at=datetime.now(UTC),
    )

    body = _get_metrics(client, token)
    assert body["closed_today"] == before["closed_today"] + 1


def test_closed_ticket_not_in_priority_distribution(
    client: TestClient,
    make_user: Callable,
    create_ticket: Callable,
) -> None:
    user, token = make_user("agent")
    before = _stored_counts()
    create_ticket(created_by_id=user.id, priority="critical", status="open")
    create_ticket(created_by_id=user.id, priority="critical", status="closed")

    body = _get_metrics(client, token)
    assert body["by_priority"]["critical"] == before["by_priority"]["critical"] + 1
    assert body["open"] == before["open"] + 1
