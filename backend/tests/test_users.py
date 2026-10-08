"""Tests for the administrator user management endpoints.

The registration/login ticket has not landed on this branch, so helper users are
inserted directly through the session factory and signed with
:func:`app.core.security.create_access_token`. Everything these tests create uses
the ``users-test.local`` domain and is removed again before and after each test.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.security import create_access_token, hash_password
from app.db import get_session_factory
from app.models import User

TEST_DOMAIN = "users-test.local"
PASSWORD = "sup3r-secret"


def _email(prefix: str = "user") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@{TEST_DOMAIN}"


def _make_user(
    role: str = "melder",
    *,
    is_active: bool = True,
    full_name: str = "Test User",
    password: str = PASSWORD,
) -> tuple[User, str]:
    """Insert a user directly and return it together with a valid token."""
    db = get_session_factory()()
    try:
        user = User(
            email=_email(role),
            full_name=full_name,
            password_hash=hash_password(password),
            role=role,
            is_active=is_active,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user, create_access_token(user)
    finally:
        db.close()


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _purge() -> None:
    db = get_session_factory()()
    try:
        db.execute(delete(User).where(User.email.like(f"%@{TEST_DOMAIN}")))
        db.commit()
    finally:
        db.close()


@pytest.fixture(autouse=True)
def _isolate_users(client: TestClient) -> None:
    """Start and end every test with only the rows this file owns removed."""
    _purge()
    yield
    _purge()


def test_admin_creates_user(client: TestClient) -> None:
    _, token = _make_user("admin")
    email = _email("created")

    response = client.post(
        "/api/v1/users",
        json={"email": email, "full_name": "Neue Person", "password": PASSWORD, "role": "agent"},
        headers=_auth(token),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == email
    assert body["full_name"] == "Neue Person"
    assert body["role"] == "agent"
    assert body["is_active"] is True
    assert "password" not in body
    assert "password_hash" not in body

    # The stored value is a bcrypt hash, never the plaintext password.
    db = get_session_factory()()
    try:
        stored = db.scalar(select(User).where(User.email == email))
        assert stored is not None
        assert stored.password_hash != PASSWORD
        assert stored.password_hash.startswith("$2")
    finally:
        db.close()


def test_create_user_with_duplicate_email_returns_409(client: TestClient) -> None:
    _, token = _make_user("admin")
    payload = {
        "email": _email("dupe"),
        "full_name": "Doppelt",
        "password": PASSWORD,
        "role": "melder",
    }

    first = client.post("/api/v1/users", json=payload, headers=_auth(token))
    assert first.status_code == 201

    second = client.post("/api/v1/users", json=payload, headers=_auth(token))
    assert second.status_code == 409
    body = second.json()
    assert body["error"]["code"] == "conflict"
    assert "email" in body["error"]["fields"]


def test_create_user_with_unknown_role_returns_422(client: TestClient) -> None:
    _, token = _make_user("admin")

    response = client.post(
        "/api/v1/users",
        json={
            "email": _email("badrole"),
            "full_name": "Bad Role",
            "password": PASSWORD,
            "role": "superuser",
        },
        headers=_auth(token),
    )

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert "role" in body["error"]["fields"]


def test_admin_changes_role(client: TestClient) -> None:
    _, token = _make_user("admin")
    target, _ = _make_user("melder")

    response = client.patch(
        f"/api/v1/users/{target.id}",
        json={"role": "agent"},
        headers=_auth(token),
    )

    assert response.status_code == 200
    assert response.json()["role"] == "agent"

    db = get_session_factory()()
    try:
        db.expire_all()
        refreshed = db.get(User, target.id)
        assert refreshed is not None
        assert refreshed.role == "agent"
    finally:
        db.close()


def test_update_unknown_user_returns_404(client: TestClient) -> None:
    _, token = _make_user("admin")

    response = client.patch(
        "/api/v1/users/99999999",
        json={"is_active": False},
        headers=_auth(token),
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_deactivated_user_cannot_log_in_or_use_token_and_leaves_assignable(
    client: TestClient,
) -> None:
    _, admin_token = _make_user("admin")
    agent, agent_token = _make_user("agent", full_name="Ziel Agent")

    before = client.get("/api/v1/users/assignable", headers=_auth(admin_token))
    assert before.status_code == 200
    assert agent.id in {user["id"] for user in before.json()}

    updated = client.patch(
        f"/api/v1/users/{agent.id}",
        json={"is_active": False},
        headers=_auth(admin_token),
    )
    assert updated.status_code == 200
    assert updated.json()["is_active"] is False

    after = client.get("/api/v1/users/assignable", headers=_auth(admin_token))
    assert after.status_code == 200
    assert agent.id not in {user["id"] for user in after.json()}

    # The existing token is rejected on the very next request by get_current_user.
    protected = client.get("/api/v1/tickets", headers=_auth(agent_token))
    assert protected.status_code == 401

    # Logging in again must not succeed for the deactivated account. The auth
    # ticket owns the login body; whatever it answers, it is never a 200 here.
    login = client.post(
        "/api/v1/auth/login",
        json={"email": agent.email, "password": PASSWORD},
    )
    assert login.status_code != 200


def test_list_filters_by_role_and_active_state(client: TestClient) -> None:
    _, token = _make_user("admin")
    active_agent, _ = _make_user("agent")
    inactive_melder, _ = _make_user("melder", is_active=False)

    by_role = client.get("/api/v1/users", params={"role": "agent"}, headers=_auth(token))
    assert by_role.status_code == 200
    role_ids = {user["id"] for user in by_role.json()}
    assert active_agent.id in role_ids
    assert inactive_melder.id not in role_ids

    inactive = client.get("/api/v1/users", params={"is_active": False}, headers=_auth(token))
    assert inactive.status_code == 200
    inactive_ids = {user["id"] for user in inactive.json()}
    assert inactive_melder.id in inactive_ids
    assert active_agent.id not in inactive_ids


def test_assignable_lists_only_active_agents_and_admins(client: TestClient) -> None:
    _, token = _make_user("admin")
    active_agent, _ = _make_user("agent")
    inactive_agent, _ = _make_user("agent", is_active=False)
    melder, _ = _make_user("melder")

    response = client.get("/api/v1/users/assignable", headers=_auth(token))

    assert response.status_code == 200
    ids = {user["id"] for user in response.json()}
    assert active_agent.id in ids
    assert inactive_agent.id not in ids
    assert melder.id not in ids


def test_non_admin_is_forbidden_on_admin_endpoints(client: TestClient) -> None:
    _, melder_token = _make_user("melder")
    _, agent_token = _make_user("agent")
    target, _ = _make_user("melder")

    for token in (melder_token, agent_token):
        list_response = client.get("/api/v1/users", headers=_auth(token))
        assert list_response.status_code == 403
        assert list_response.json()["error"]["code"] == "forbidden"

        create_response = client.post(
            "/api/v1/users",
            json={
                "email": _email("nope"),
                "full_name": "Nope",
                "password": PASSWORD,
                "role": "melder",
            },
            headers=_auth(token),
        )
        assert create_response.status_code == 403

        patch_response = client.patch(
            f"/api/v1/users/{target.id}",
            json={"role": "admin"},
            headers=_auth(token),
        )
        assert patch_response.status_code == 403

    # A Melder may not read the assignment list either.
    assert client.get("/api/v1/users/assignable", headers=_auth(melder_token)).status_code == 403
    # An agent needs it to assign tickets.
    assert client.get("/api/v1/users/assignable", headers=_auth(agent_token)).status_code == 200


def test_users_endpoints_require_authentication(client: TestClient) -> None:
    valid_body = {
        "email": _email("noauth"),
        "full_name": "No Auth",
        "password": PASSWORD,
        "role": "melder",
    }
    assert client.get("/api/v1/users").status_code == 401
    assert client.post("/api/v1/users", json=valid_body).status_code == 401
    assert client.get("/api/v1/users/assignable").status_code == 401
    assert client.patch("/api/v1/users/1", json={"role": "admin"}).status_code == 401
