"""Shared pytest fixtures for the backend test suite."""

import os
import secrets
from collections.abc import Callable, Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture(scope="session", autouse=True)
def _test_environment() -> Generator[None]:
    """Ensure a signing key exists before the app reads its settings.

    ``DATABASE_URL`` must already point at a reachable database (the pipeline
    provides one); the tests create no fallback of their own.
    """
    os.environ.setdefault("JWT_SECRET", secrets.token_hex(32))
    yield


@pytest.fixture()
def app(_test_environment: None) -> FastAPI:
    from app.main import app as fastapi_app

    return fastapi_app


@pytest.fixture()
def client(app: FastAPI) -> Generator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def make_token() -> Callable[..., str]:
    """Create signed access tokens without touching the database."""
    from app.core.security import create_access_token
    from app.models import User

    def _make(user_id: int = 1, role: str = "agent") -> str:
        user = User(
            id=user_id,
            email=f"user{user_id}@example.com",
            full_name=f"User {user_id}",
            role=role,
            is_active=True,
        )
        return create_access_token(user)

    return _make
