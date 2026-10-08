"""FastAPI entry point for the helpdesk API.

Creates the application under the ``/api/v1`` prefix, installs the unified
exception handlers, configures CORS from settings, runs the database migrations
on startup and mounts every router.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import get_cors_origins, get_settings
from app.core.errors import STATUS_CODES, error_response
from app.routers import auth, comments, dashboard, export, tickets, users

logger = logging.getLogger("app")


def _backend_dir() -> Path:
    """Locate the backend directory that holds ``alembic.ini``."""
    candidate = Path(__file__).resolve().parents[1]
    if (candidate / "alembic.ini").is_file():
        return candidate
    return Path.cwd()


def run_migrations(database_url: str) -> None:
    """Apply all Alembic migrations up to head."""
    from alembic import command
    from alembic.config import Config

    base_dir = _backend_dir()
    config = Config(str(base_dir / "alembic.ini"))
    config.set_main_option("script_location", str(base_dir / "migrations"))
    config.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(config, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Validate configuration and bring the database schema up to date."""
    settings = get_settings()
    run_migrations(settings.database_url)
    yield


app = FastAPI(title="Helpdesk API", version="0.1.0", lifespan=lifespan)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Render HTTP errors (including unmatched routes) with the unified body."""
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail:
        code = str(detail.get("code"))
        message = str(detail.get("message", detail))
        fields = detail.get("fields") or {}
    else:
        code = STATUS_CODES.get(exc.status_code, "error")
        message = str(detail)
        fields = {}
    return error_response(exc.status_code, code, message, fields)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Map request validation errors to field messages (422)."""
    fields: dict[str, str] = {}
    for error in exc.errors():
        location = [str(part) for part in error.get("loc", []) if part != "body"]
        field = ".".join(location) or "body"
        fields[field] = str(error.get("msg", "Invalid value"))
    return error_response(422, "validation_error", "Validation failed", fields)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all so unhandled errors keep the unified body (and CORS headers)."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return error_response(500, "internal_error", "Internal Server Error")


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


api = APIRouter(prefix="/api/v1")


@api.get("/health")
def health() -> dict:
    """Liveness/readiness probe."""
    return {"status": "ok"}


# Export is registered before the ticket routes so ``/tickets/export`` is not
# captured by ``/tickets/{ticket_id}``.
api.include_router(auth.router)
api.include_router(users.router)
api.include_router(export.router)
api.include_router(tickets.router)
api.include_router(comments.router)
api.include_router(dashboard.router)

app.include_router(api)
