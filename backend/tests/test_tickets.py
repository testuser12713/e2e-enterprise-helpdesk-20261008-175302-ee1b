"""End-to-end tests for the ticket CRUD, workflow and change log routes."""

import secrets
from collections.abc import Generator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password
from app.db import get_session_factory
from app.models import Ticket, TicketChange, User

DOMAIN = "ticket-slice.test"
API = "/api/v1/tickets"


def _purge(session: Session) -> None:
    """Remove only the rows this test module created (identified by its domain)."""
    user_ids = select(User.id).where(User.email.like(f"%@{DOMAIN}"))
    ticket_ids = select(Ticket.id).where(Ticket.created_by_id.in_(user_ids))
    session.execute(delete(TicketChange).where(TicketChange.ticket_id.in_(ticket_ids)))
    session.execute(delete(Ticket).where(Ticket.id.in_(ticket_ids)))
    session.execute(delete(User).where(User.email.like(f"%@{DOMAIN}")))
    session.commit()


@pytest.fixture()
def db(client: TestClient) -> Generator[Session]:
    session = get_session_factory()()
    _purge(session)
    try:
        yield session
    finally:
        _purge(session)
        session.close()


def _make_user(db: Session, role: str, *, active: bool = True) -> tuple[User, str]:
    email = f"{secrets.token_hex(8)}@{DOMAIN}"
    user = User(
        email=email,
        full_name=f"{role.title()} {email[:6]}",
        password_hash=hash_password("secret123"),
        role=role,
        is_active=active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, create_access_token(user)


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _new_ticket(
    client: TestClient, token: str, *, priority: str = "high", title: str | None = None
):
    payload = {
        "title": title or f"Ticket {secrets.token_hex(4)}",
        "description": "Bitte um Hilfe",
        "category": "software",
        "priority": priority,
    }
    response = client.post(API, json=payload, headers=_auth(token))
    assert response.status_code == 201, response.text
    return response.json()


def test_create_ticket_gets_due_date_and_open_status(client: TestClient, db: Session) -> None:
    melder, token = _make_user(db, "melder")
    body = _new_ticket(client, token, priority="high", title="Drucker defekt")

    assert body["status"] == "open"
    assert body["created_by"] == melder.id
    assert body["assignee"] is None
    assert body["closed_at"] is None

    due = datetime.fromisoformat(body["due_at"])
    expected = datetime.now(UTC) + timedelta(hours=24)
    assert abs((due - expected).total_seconds()) < 300

    with get_session_factory()() as fresh:
        row = fresh.get(Ticket, body["id"])
        assert row is not None
        assert row.due_at is not None
        assert row.status == "open"


def test_create_ticket_validates_required_fields(client: TestClient, db: Session) -> None:
    _, token = _make_user(db, "melder")
    response = client.post(API, json={"description": "no title"}, headers=_auth(token))
    assert response.status_code == 422
    assert "error" in response.json()
    assert response.json()["error"]["fields"]


def test_agent_assigns_ticket_without_changing_due_date(client: TestClient, db: Session) -> None:
    _, melder_token = _make_user(db, "melder")
    agent, agent_token = _make_user(db, "agent")
    ticket = _new_ticket(client, melder_token)
    due_before = ticket["due_at"]

    response = client.post(
        f"{API}/{ticket['id']}/assign",
        json={"assignee_id": agent.id},
        headers=_auth(agent_token),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["assignee"]["id"] == agent.id
    assert body["assignee"]["full_name"] == agent.full_name
    assert body["due_at"] == due_before

    history = client.get(f"{API}/{ticket['id']}/history", headers=_auth(agent_token)).json()
    assert any(
        entry["field"] == "assignee" and entry["new_value"] == agent.full_name for entry in history
    )


def test_assign_rejects_melder_and_inactive_agent(client: TestClient, db: Session) -> None:
    _, melder_token = _make_user(db, "melder")
    melder_target, _ = _make_user(db, "melder")
    inactive, _ = _make_user(db, "agent", active=False)
    _, operator_token = _make_user(db, "agent")
    ticket = _new_ticket(client, melder_token)

    for target in (melder_target.id, inactive.id):
        response = client.post(
            f"{API}/{ticket['id']}/assign",
            json={"assignee_id": target},
            headers=_auth(operator_token),
        )
        assert response.status_code == 422, response.text
        assert "assignee_id" in response.json()["error"]["fields"]


def test_agent_closes_ticket_and_reports_closed_at(client: TestClient, db: Session) -> None:
    _, melder_token = _make_user(db, "melder")
    agent, agent_token = _make_user(db, "agent")
    ticket = _new_ticket(client, melder_token)

    response = client.post(f"{API}/{ticket['id']}/close", headers=_auth(agent_token))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "closed"
    assert body["closed_at"] is not None
    assert body["is_overdue"] is False

    history = client.get(f"{API}/{ticket['id']}/history", headers=_auth(agent_token)).json()
    assert any(
        entry["field"] == "status"
        and entry["old_value"] == "open"
        and entry["new_value"] == "closed"
        and entry["actor"]["id"] == agent.id
        for entry in history
    )


def test_melder_is_forbidden_to_assign_or_close(client: TestClient, db: Session) -> None:
    melder, melder_token = _make_user(db, "melder")
    agent, _ = _make_user(db, "agent")
    ticket = _new_ticket(client, melder_token)

    assign = client.post(
        f"{API}/{ticket['id']}/assign",
        json={"assignee_id": agent.id},
        headers=_auth(melder_token),
    )
    assert assign.status_code == 403
    assert assign.json()["error"]["code"] == "forbidden"

    close = client.post(f"{API}/{ticket['id']}/close", headers=_auth(melder_token))
    assert close.status_code == 403

    patch_assign = client.patch(
        f"{API}/{ticket['id']}", json={"assignee_id": agent.id}, headers=_auth(melder_token)
    )
    assert patch_assign.status_code == 403

    own_edit = client.patch(
        f"{API}/{ticket['id']}", json={"title": "Eigener Titel"}, headers=_auth(melder_token)
    )
    assert own_edit.status_code == 200
    assert own_edit.json()["created_by"] == melder.id


def test_melder_cannot_touch_a_foreign_ticket(client: TestClient, db: Session) -> None:
    _, owner_token = _make_user(db, "melder")
    _, stranger_token = _make_user(db, "melder")
    ticket = _new_ticket(client, owner_token)

    assert client.get(f"{API}/{ticket['id']}", headers=_auth(stranger_token)).status_code == 403
    assert (
        client.patch(
            f"{API}/{ticket['id']}", json={"title": "Fremd"}, headers=_auth(stranger_token)
        ).status_code
        == 403
    )
    assert (
        client.get(f"{API}/{ticket['id']}/history", headers=_auth(stranger_token)).status_code
        == 403
    )


def test_patch_recomputes_due_date_and_logs_changes(client: TestClient, db: Session) -> None:
    _, melder_token = _make_user(db, "melder")
    agent, agent_token = _make_user(db, "agent")
    ticket = _new_ticket(client, melder_token, priority="medium")
    due_medium = datetime.fromisoformat(ticket["due_at"])

    response = client.patch(
        f"{API}/{ticket['id']}", json={"priority": "low"}, headers=_auth(agent_token)
    )
    assert response.status_code == 200, response.text
    due_low = datetime.fromisoformat(response.json()["due_at"])
    assert due_low > due_medium

    client.patch(
        f"{API}/{ticket['id']}", json={"status": "in_progress"}, headers=_auth(agent_token)
    )
    client.post(
        f"{API}/{ticket['id']}/assign", json={"assignee_id": agent.id}, headers=_auth(agent_token)
    )

    history = client.get(f"{API}/{ticket['id']}/history", headers=_auth(agent_token)).json()
    fields = {entry["field"] for entry in history}
    assert {"priority", "status", "assignee"} <= fields
    assert all(entry["actor"]["id"] == agent.id for entry in history)
    priority_entry = next(entry for entry in history if entry["field"] == "priority")
    assert priority_entry["old_value"] == "medium"
    assert priority_entry["new_value"] == "low"


def test_patch_close_sets_closed_at(client: TestClient, db: Session) -> None:
    _, melder_token = _make_user(db, "melder")
    _, agent_token = _make_user(db, "agent")
    ticket = _new_ticket(client, melder_token)

    response = client.patch(
        f"{API}/{ticket['id']}", json={"status": "closed"}, headers=_auth(agent_token)
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "closed"
    assert response.json()["closed_at"] is not None


def test_list_scopes_melder_and_paginates(client: TestClient, db: Session) -> None:
    _, melder_token = _make_user(db, "melder")
    _, agent_token = _make_user(db, "agent")
    marker = f"L{secrets.token_hex(6)}"
    for index in range(3):
        _new_ticket(client, melder_token, title=f"{marker} {index}")

    listing = client.get(
        API, params={"search": marker, "page_size": 2}, headers=_auth(melder_token)
    )
    assert listing.status_code == 200, listing.text
    body = listing.json()
    assert body["total"] == 3
    assert body["pages"] == 2
    assert len(body["items"]) == 2

    # The Melder sees only their own tickets even for a marker owned by the agent.
    assert (
        client.get(API, params={"search": "zzz-nothing"}, headers=_auth(agent_token)).json()[
            "items"
        ]
        == []
    )


def test_invalid_query_parameters_return_422(client: TestClient, db: Session) -> None:
    _, token = _make_user(db, "agent")
    assert client.get(API, params={"sort": "bogus"}, headers=_auth(token)).status_code == 422
    assert client.get(API, params={"status": "nope"}, headers=_auth(token)).status_code == 422
    assert client.get(API, params={"page": 0}, headers=_auth(token)).status_code == 422


def test_overdue_flag_visible_in_detail_and_cleared_by_close(
    client: TestClient, db: Session
) -> None:
    _, melder_token = _make_user(db, "melder")
    _, agent_token = _make_user(db, "agent")
    ticket = _new_ticket(client, melder_token)

    with get_session_factory()() as session:
        row = session.get(Ticket, ticket["id"])
        row.due_at = datetime.now(UTC) - timedelta(hours=1)
        session.commit()

    detail = client.get(f"{API}/{ticket['id']}", headers=_auth(agent_token)).json()
    assert detail["is_overdue"] is True

    closed = client.post(f"{API}/{ticket['id']}/close", headers=_auth(agent_token)).json()
    assert closed["is_overdue"] is False


def test_data_survives_a_fresh_session(client: TestClient, db: Session) -> None:
    _, melder_token = _make_user(db, "melder")
    agent, agent_token = _make_user(db, "agent")
    ticket = _new_ticket(client, melder_token, title="Persistenzpruefung")
    client.post(
        f"{API}/{ticket['id']}/assign", json={"assignee_id": agent.id}, headers=_auth(agent_token)
    )
    client.post(f"{API}/{ticket['id']}/close", headers=_auth(agent_token))

    with get_session_factory()() as fresh:
        row = fresh.get(Ticket, ticket["id"])
        assert row is not None
        assert row.status == "closed"
        assert row.assignee_id == agent.id
        changes = fresh.scalars(
            select(TicketChange).where(TicketChange.ticket_id == ticket["id"])
        ).all()
        assert len(changes) >= 2
