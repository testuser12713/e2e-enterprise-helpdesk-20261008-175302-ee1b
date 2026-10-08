"""Tests for the ticket comment endpoints.

Each test seeds its own users and tickets and cleans up exactly the rows it
created, leaving the tables owned by other tickets untouched.
"""

import secrets
from collections.abc import Generator
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.security import create_access_token
from app.db import get_session_factory
from app.models import Comment, Ticket, User


@pytest.fixture()
def seed(client: TestClient) -> Generator[dict]:
    """Create a Melder (with own + foreign tickets), an agent and their tokens."""
    session_factory = get_session_factory()
    db = session_factory()
    suffix = secrets.token_hex(4)
    try:
        melder = User(
            email=f"melder-{suffix}@example.com",
            full_name="Mia Melder",
            password_hash="not-used",
            role="melder",
            is_active=True,
        )
        agent = User(
            email=f"agent-{suffix}@example.com",
            full_name="Anna Agent",
            password_hash="not-used",
            role="agent",
            is_active=True,
        )
        outsider = User(
            email=f"outsider-{suffix}@example.com",
            full_name="Olaf Outsider",
            password_hash="not-used",
            role="melder",
            is_active=True,
        )
        db.add_all([melder, agent, outsider])
        db.commit()

        ticket = Ticket(
            title="Printer is jammed",
            description="",
            category="hardware",
            priority="high",
            status="open",
            created_by_id=melder.id,
        )
        foreign_ticket = Ticket(
            title="Someone else's ticket",
            description="",
            category="other",
            priority="low",
            status="open",
            created_by_id=outsider.id,
        )
        db.add_all([ticket, foreign_ticket])
        db.commit()

        data = {
            "melder_token": create_access_token(melder),
            "agent_token": create_access_token(agent),
            "melder_name": melder.full_name,
            "ticket_id": ticket.id,
            "foreign_ticket_id": foreign_ticket.id,
            "user_ids": [melder.id, agent.id, outsider.id],
            "ticket_ids": [ticket.id, foreign_ticket.id],
        }
    finally:
        db.close()

    yield data

    cleanup = session_factory()
    try:
        cleanup.execute(delete(Comment).where(Comment.ticket_id.in_(data["ticket_ids"])))
        cleanup.execute(delete(Ticket).where(Ticket.id.in_(data["ticket_ids"])))
        cleanup.execute(delete(User).where(User.id.in_(data["user_ids"])))
        cleanup.commit()
    finally:
        cleanup.close()


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_post_then_read_returns_comment(client: TestClient, seed: dict) -> None:
    url = f"/api/v1/tickets/{seed['ticket_id']}/comments"

    created = client.post(url, json={"body": "First reply"}, headers=_auth(seed["melder_token"]))
    assert created.status_code == 201
    body = created.json()
    assert body["body"] == "First reply"
    assert body["ticket_id"] == seed["ticket_id"]
    assert body["author"]["id"] == seed["user_ids"][0]
    assert body["author"]["full_name"] == seed["melder_name"]
    assert "created_at" in body

    listed = client.get(url, headers=_auth(seed["melder_token"]))
    assert listed.status_code == 200
    comments = listed.json()
    assert isinstance(comments, list)
    assert [comment["id"] for comment in comments] == [body["id"]]


def test_new_comment_is_last_with_author_and_timestamp(client: TestClient, seed: dict) -> None:
    url = f"/api/v1/tickets/{seed['ticket_id']}/comments"
    headers = _auth(seed["agent_token"])

    first = client.post(url, json={"body": "Older comment"}, headers=headers)
    assert first.status_code == 201
    second = client.post(url, json={"body": "Newer comment"}, headers=headers)
    assert second.status_code == 201

    comments = client.get(url, headers=headers).json()
    assert len(comments) == 2
    assert comments[0]["body"] == "Older comment"
    assert comments[-1]["body"] == "Newer comment"
    assert comments[-1]["author"]["full_name"] == "Anna Agent"
    assert datetime.fromisoformat(comments[-1]["created_at"])


def test_comment_survives_fresh_db_session(client: TestClient, seed: dict) -> None:
    unique_body = f"persisted-{secrets.token_hex(4)}"
    url = f"/api/v1/tickets/{seed['ticket_id']}/comments"
    created = client.post(url, json={"body": unique_body}, headers=_auth(seed["melder_token"]))
    assert created.status_code == 201

    session = get_session_factory()()
    try:
        stored = session.scalars(select(Comment).where(Comment.body == unique_body)).one()
        assert stored.ticket_id == seed["ticket_id"]
        assert stored.author_id == seed["user_ids"][0]
    finally:
        session.close()


def test_melder_cannot_comment_on_foreign_ticket(client: TestClient, seed: dict) -> None:
    url = f"/api/v1/tickets/{seed['foreign_ticket_id']}/comments"
    response = client.post(url, json={"body": "Not mine"}, headers=_auth(seed["melder_token"]))
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


def test_melder_cannot_read_foreign_ticket_comments(client: TestClient, seed: dict) -> None:
    url = f"/api/v1/tickets/{seed['foreign_ticket_id']}/comments"
    response = client.get(url, headers=_auth(seed["melder_token"]))
    assert response.status_code == 403


def test_agent_may_comment_on_any_ticket(client: TestClient, seed: dict) -> None:
    url = f"/api/v1/tickets/{seed['foreign_ticket_id']}/comments"
    response = client.post(url, json={"body": "Agent reply"}, headers=_auth(seed["agent_token"]))
    assert response.status_code == 201


def test_unknown_ticket_returns_404(client: TestClient, seed: dict) -> None:
    response = client.get("/api/v1/tickets/999999/comments", headers=_auth(seed["agent_token"]))
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_comments_without_token_returns_401(client: TestClient, seed: dict) -> None:
    url = f"/api/v1/tickets/{seed['ticket_id']}/comments"
    assert client.get(url).status_code == 401
    assert client.post(url, json={"body": "hi"}).status_code == 401


def test_empty_body_returns_422_field_message(client: TestClient, seed: dict) -> None:
    url = f"/api/v1/tickets/{seed['ticket_id']}/comments"
    response = client.post(url, json={"body": ""}, headers=_auth(seed["melder_token"]))
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert "body" in error["fields"]
