"""End-to-end tests for the filtered CSV export endpoint."""

import csv
import io
import secrets
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password
from app.db import get_session_factory
from app.models import Ticket, TicketChange, User
from app.services.csv_export import CSV_HEADER

DOMAIN = "export-slice.test"
API = "/api/v1/tickets"
EXPORT = "/api/v1/tickets/export"


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


def _make_user(db: Session, role: str) -> tuple[User, str]:
    email = f"{secrets.token_hex(8)}@{DOMAIN}"
    user = User(
        email=email,
        full_name=f"{role.title()} {email[:6]}",
        password_hash=hash_password("secret123"),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, create_access_token(user)


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _new_ticket(
    client: TestClient,
    token: str,
    *,
    priority: str = "high",
    title: str,
) -> dict:
    payload = {
        "title": title,
        "description": "Bitte um Hilfe",
        "category": "software",
        "priority": priority,
    }
    response = client.post(API, json=payload, headers=_auth(token))
    assert response.status_code == 201, response.text
    return response.json()


def _parse_csv(body: bytes) -> list[list[str]]:
    text = body.decode("utf-8")
    return list(csv.reader(io.StringIO(text), delimiter=";"))


def test_export_header_order_and_download_headers(client: TestClient, db: Session) -> None:
    _, token = _make_user(db, "agent")
    response = client.get(EXPORT, headers=_auth(token))

    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert response.headers["content-disposition"] == 'attachment; filename="tickets.csv"'

    rows = _parse_csv(response.content)
    assert rows[0] == CSV_HEADER
    assert rows[0] == [
        "ID",
        "Titel",
        "Kategorie",
        "Priorität",
        "Status",
        "Zuständig",
        "Fälligkeit",
        "Überfällig",
        "Erstellt am",
    ]


def test_export_rows_equal_the_filtered_list(client: TestClient, db: Session) -> None:
    _, melder_token = _make_user(db, "melder")
    agent, agent_token = _make_user(db, "agent")
    marker = f"X{secrets.token_hex(6)}"
    for index in range(3):
        created = _new_ticket(client, melder_token, priority="high", title=f"{marker} {index}")
        if index == 0:
            client.post(
                f"{API}/{created['id']}/assign",
                json={"assignee_id": agent.id},
                headers=_auth(agent_token),
            )
    _new_ticket(client, melder_token, priority="low", title=f"{marker} low")

    listing = client.get(
        API, params={"search": marker, "priority": "high"}, headers=_auth(melder_token)
    )
    assert listing.status_code == 200, listing.text
    list_items = listing.json()["items"]

    export = client.get(
        EXPORT, params={"search": marker, "priority": "high"}, headers=_auth(agent_token)
    )
    assert export.status_code == 200, export.text
    rows = _parse_csv(export.content)
    data_rows = rows[1:]

    assert len(data_rows) == len(list_items)
    assert [row[0] for row in data_rows] == [str(item["id"]) for item in list_items]
    assert [row[1] for row in data_rows] == [item["title"] for item in list_items]
    assert [row[5] for row in data_rows] == [
        item["assignee"]["full_name"] if item["assignee"] else "" for item in list_items
    ]


def test_export_separates_columns_with_semicolons(client: TestClient, db: Session) -> None:
    _, token = _make_user(db, "agent")
    marker = f"S{secrets.token_hex(6)}"
    _new_ticket(client, token, title=marker)

    response = client.get(EXPORT, params={"search": marker}, headers=_auth(token))
    assert response.status_code == 200, response.text

    line = response.content.decode("utf-8").splitlines()[1]
    assert line.count(";") == len(CSV_HEADER) - 1


def test_export_preserves_umlauts_in_utf8(client: TestClient, db: Session) -> None:
    _, token = _make_user(db, "agent")
    marker = f"ü{secrets.token_hex(6)}"
    title = f"{marker} Prüfgerät für Straße"
    _new_ticket(client, token, title=title)

    response = client.get(EXPORT, params={"search": marker}, headers=_auth(token))
    assert response.status_code == 200, response.text

    rows = _parse_csv(response.content)
    assert rows[1][1] == title
    assert "Prüfgerät" in response.content.decode("utf-8")


def test_export_applies_no_pagination(client: TestClient, db: Session) -> None:
    _, token = _make_user(db, "agent")
    marker = f"P{secrets.token_hex(6)}"
    for index in range(3):
        _new_ticket(client, token, title=f"{marker} {index}")

    response = client.get(
        EXPORT, params={"search": marker, "page": 1, "page_size": 1}, headers=_auth(token)
    )
    assert response.status_code == 200, response.text

    rows = _parse_csv(response.content)
    assert len(rows) - 1 == 3


def test_export_requires_an_agent_or_admin(client: TestClient, db: Session) -> None:
    _, melder_token = _make_user(db, "melder")
    _, agent_token = _make_user(db, "agent")

    forbidden = client.get(EXPORT, headers=_auth(melder_token))
    assert forbidden.status_code == 403
    assert forbidden.json()["error"]["code"] == "forbidden"

    assert client.get(EXPORT).status_code == 401
    assert client.get(EXPORT, headers=_auth(agent_token)).status_code == 200
