"""Skeleton contract tests: the app boots, health answers and errors are unified.

These tests only assert what the scaffold itself delivers. They never assert the
temporary 501 answer of a route owned by another ticket.
"""

from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_protected_route_without_token_returns_unified_401(client: TestClient) -> None:
    response = client.get("/api/v1/tickets")
    assert response.status_code == 401
    body = response.json()
    assert "error" in body
    assert {"code", "message", "fields"} <= set(body["error"])
    assert body["error"]["code"] == "unauthorized"


def test_unknown_path_returns_unified_404(client: TestClient) -> None:
    response = client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    body = response.json()
    assert "error" in body
    assert {"code", "message", "fields"} <= set(body["error"])


def test_app_lifespan_applies_migrations_and_serves_health() -> None:
    from app.main import app

    with TestClient(app) as context_client:
        response = context_client.get("/api/v1/health")
        assert response.status_code == 200
