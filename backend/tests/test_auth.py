"""Tests for registration, login and the current-user endpoint.

Each test creates its own users with unique e-mail addresses so the tests do not
depend on (or disturb) rows another ticket owns.
"""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import get_session_factory
from app.models import User

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
ME = "/api/v1/auth/me"
PASSWORD = "correct-horse-9"


def _unique_email() -> str:
    return f"melder-{uuid.uuid4().hex}@example.com"


def _register(client: TestClient, email: str, password: str = PASSWORD) -> dict:
    response = client.post(
        REGISTER,
        json={"email": email, "full_name": "Test Melder", "password": password},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _login(client: TestClient, email: str, password: str = PASSWORD):
    return client.post(LOGIN, json={"email": email, "password": password})


def test_register_then_login_returns_token_and_user(client: TestClient) -> None:
    email = _unique_email()
    created = _register(client, email)

    assert created["email"] == email
    assert created["full_name"] == "Test Melder"
    assert created["role"] == "melder"
    assert created["is_active"] is True
    assert set(created) == {"id", "email", "full_name", "role", "is_active", "last_login_at"}

    response = _login(client, email)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["email"] == email
    assert "password" not in body["user"]
    assert "password_hash" not in body["user"]


def test_me_returns_current_user_with_token(client: TestClient) -> None:
    email = _unique_email()
    _register(client, email)
    token = _login(client, email).json()["access_token"]

    response = client.get(ME, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email"] == email
    assert body["role"] == "melder"
    assert body["is_active"] is True


def test_login_wrong_password_returns_401(client: TestClient) -> None:
    email = _unique_email()
    _register(client, email)

    response = _login(client, email, password="wrong-password-1")
    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "unauthorized"
    assert {"code", "message", "fields"} <= set(body["error"])


def test_login_inactive_account_returns_401(client: TestClient) -> None:
    email = _unique_email()
    user_id = _register(client, email)["id"]

    session = get_session_factory()()
    try:
        user = session.get(User, user_id)
        user.is_active = False
        session.commit()
    finally:
        session.close()

    response = _login(client, email)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_duplicate_email_returns_409(client: TestClient) -> None:
    email = _unique_email()
    _register(client, email)

    response = client.post(
        REGISTER,
        json={"email": email, "full_name": "Other", "password": PASSWORD},
    )
    assert response.status_code == 409
    body = response.json()
    assert body["error"]["code"] == "conflict"
    assert "email" in body["error"]["fields"]


def test_password_is_only_stored_as_hash(client: TestClient) -> None:
    email = _unique_email()
    user_id = _register(client, email, password=PASSWORD)["id"]

    session = get_session_factory()()
    try:
        user = session.scalar(select(User).where(User.id == user_id))
        assert user is not None
        assert user.password_hash != PASSWORD
        assert PASSWORD not in user.password_hash
        assert user.password_hash.startswith("$2")
    finally:
        session.close()


def test_me_without_token_returns_unified_401(client: TestClient) -> None:
    response = client.get(ME)
    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "unauthorized"
    assert {"code", "message", "fields"} <= set(body["error"])


def test_register_invalid_email_returns_422_field_message(client: TestClient) -> None:
    response = client.post(
        REGISTER,
        json={"email": "not-an-email", "full_name": "X", "password": PASSWORD},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert "email" in body["error"]["fields"]


def test_register_short_password_returns_422_field_message(client: TestClient) -> None:
    response = client.post(
        REGISTER,
        json={"email": _unique_email(), "full_name": "X", "password": "short"},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert "password" in body["error"]["fields"]
