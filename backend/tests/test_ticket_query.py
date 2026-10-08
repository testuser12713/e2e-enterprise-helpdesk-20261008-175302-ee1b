"""Filter, sort and pagination behaviour of the shared ticket query builder."""

import secrets
from collections.abc import Generator
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db import get_session_factory
from app.models import Ticket, TicketChange, User
from app.services.ticket_query import (
    TicketFilterParams,
    build_ticket_query,
    count_ticket_query,
    serialize_ticket,
)

DOMAIN = "query-slice.test"


def _purge(session: Session) -> None:
    """Remove only the rows this test module created (identified by its domain)."""
    user_ids = select(User.id).where(User.email.like(f"%@{DOMAIN}"))
    ticket_ids = select(Ticket.id).where(Ticket.created_by_id.in_(user_ids))
    session.execute(delete(TicketChange).where(TicketChange.ticket_id.in_(ticket_ids)))
    session.execute(delete(Ticket).where(Ticket.id.in_(ticket_ids)))
    session.execute(delete(User).where(User.email.like(f"%@{DOMAIN}")))
    session.commit()


@pytest.fixture()
def db(client) -> Generator[Session]:
    session = get_session_factory()()
    _purge(session)
    try:
        yield session
    finally:
        _purge(session)
        session.close()


def _user(db: Session, role: str = "agent") -> User:
    email = f"{secrets.token_hex(8)}@{DOMAIN}"
    user = User(
        email=email,
        full_name=f"Query {role} {email[:6]}",
        password_hash="x",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _ticket(
    db: Session,
    *,
    title: str,
    description: str = "",
    priority: str = "medium",
    status: str = "open",
    created_by_id: int,
    due_at: datetime | None = None,
    assignee_id: int | None = None,
) -> Ticket:
    ticket = Ticket(
        title=title,
        description=description,
        category="other",
        priority=priority,
        status=status,
        created_by_id=created_by_id,
        due_at=due_at,
        assignee_id=assignee_id,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@pytest.fixture()
def scenario(db: Session) -> dict:
    marker = f"Q{secrets.token_hex(6)}"
    agent = _user(db, "agent")
    base = datetime(2026, 10, 8, 12, 0, tzinfo=UTC)
    first = _ticket(
        db,
        title=f"{marker} alpha",
        description=f"{marker} needle in the body",
        priority="critical",
        status="open",
        created_by_id=agent.id,
        due_at=base + timedelta(hours=1),
    )
    second = _ticket(
        db,
        title=f"{marker} beta",
        priority="low",
        status="closed",
        created_by_id=agent.id,
        due_at=base + timedelta(hours=3),
    )
    third = _ticket(
        db,
        title=f"{marker} gamma",
        priority="high",
        status="in_progress",
        created_by_id=agent.id,
        due_at=base + timedelta(hours=2),
        assignee_id=agent.id,
    )
    return {"marker": marker, "agent": agent, "first": first, "second": second, "third": third}


def _titles(db: Session, filters: TicketFilterParams, user: User) -> list[str]:
    return [t.title for t in db.scalars(build_ticket_query(filters, user)).all()]


def test_search_matches_title_and_description(db: Session, scenario: dict) -> None:
    params = TicketFilterParams(search=scenario["marker"], page_size=100)
    titles = _titles(db, params, scenario["agent"])
    assert len(titles) == 3

    needle = TicketFilterParams(search=f"{scenario['marker']} needle", page_size=100)
    assert _titles(db, needle, scenario["agent"]) == [scenario["first"].title]


def test_status_and_priority_filters(db: Session, scenario: dict) -> None:
    agent = scenario["agent"]
    open_only = TicketFilterParams(search=scenario["marker"], status="open", page_size=100)
    assert _titles(db, open_only, agent) == [scenario["first"].title]

    critical = TicketFilterParams(search=scenario["marker"], priority="critical", page_size=100)
    assert _titles(db, critical, agent) == [scenario["first"].title]


def test_assignee_filter(db: Session, scenario: dict) -> None:
    agent = scenario["agent"]
    params = TicketFilterParams(search=scenario["marker"], assignee_id=agent.id, page_size=100)
    assert _titles(db, params, agent) == [scenario["third"].title]


def test_sorting_by_due_at_and_priority(db: Session, scenario: dict) -> None:
    agent = scenario["agent"]
    by_due = TicketFilterParams(
        search=scenario["marker"], sort="due_at", order="asc", page_size=100
    )
    assert _titles(db, by_due, agent) == [
        scenario["first"].title,
        scenario["third"].title,
        scenario["second"].title,
    ]

    by_priority = TicketFilterParams(
        search=scenario["marker"], sort="priority", order="asc", page_size=100
    )
    assert _titles(db, by_priority, agent) == [
        scenario["first"].title,
        scenario["third"].title,
        scenario["second"].title,
    ]


def test_pagination_splits_the_result_set(db: Session, scenario: dict) -> None:
    agent = scenario["agent"]
    params = TicketFilterParams(search=scenario["marker"], sort="due_at", page=1, page_size=2)
    first_page = _titles(db, params, agent)
    assert len(first_page) == 2

    params.page = 2
    second_page = _titles(db, params, agent)
    assert len(second_page) == 1

    assert count_ticket_query(TicketFilterParams(search=scenario["marker"]), agent, db) == 3


def test_no_hit_returns_empty(db: Session, scenario: dict) -> None:
    agent = scenario["agent"]
    params = TicketFilterParams(search=f"{scenario['marker']} nothing-matches-this", page_size=100)
    assert _titles(db, params, agent) == []


def test_melder_only_sees_own_tickets(db: Session, scenario: dict) -> None:
    marker = f"M{secrets.token_hex(6)}"
    melder = _user(db, "melder")
    other = _user(db, "agent")
    mine = _ticket(db, title=f"{marker} mine", created_by_id=melder.id)
    _ticket(db, title=f"{marker} not mine", created_by_id=other.id)

    params = TicketFilterParams(search=marker, page_size=100)
    assert _titles(db, params, melder) == [mine.title]
    assert len(_titles(db, params, other)) == 2


def test_serialize_ticket_flags_overdue_and_closed(db: Session, scenario: dict) -> None:
    agent = scenario["agent"]
    past = datetime.now(UTC) - timedelta(hours=2)

    overdue = _ticket(
        db,
        title=f"O{secrets.token_hex(4)} overdue",
        priority="high",
        status="open",
        created_by_id=agent.id,
        due_at=past,
        assignee_id=agent.id,
    )
    data = serialize_ticket(overdue)
    assert data["is_overdue"] is True
    assert data["assignee"]["id"] == agent.id
    assert data["created_by"] == agent.id
    assert datetime.fromisoformat(data["due_at"]).tzinfo is not None

    overdue.status = "closed"
    db.commit()
    assert serialize_ticket(overdue)["is_overdue"] is False
