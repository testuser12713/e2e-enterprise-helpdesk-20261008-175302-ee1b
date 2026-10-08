"""Database engine, session factory and the FastAPI session dependency.

The engine is created lazily so that importing this module never requires
``DATABASE_URL``; the process fails with a named variable only when it actually
needs the database.
"""

from collections.abc import Generator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    """Return the process-wide engine, creating it on first use."""
    global _engine
    if _engine is None:
        _engine = create_engine(get_settings().database_url, pool_pre_ping=True)
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    """Return the process-wide session factory, creating it on first use."""
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=get_engine(), autoflush=False, autocommit=False)
    return _session_factory


def get_db() -> Generator[Session]:
    """FastAPI dependency yielding a database session per request."""
    db = get_session_factory()()
    try:
        yield db
    finally:
        db.close()


def __getattr__(name: str) -> object:
    """Expose ``engine`` and ``SessionLocal`` lazily for code that imports them."""
    if name == "engine":
        return get_engine()
    if name == "SessionLocal":
        return get_session_factory()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
