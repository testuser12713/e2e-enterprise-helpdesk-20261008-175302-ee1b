"""Shared authentication and authorization plumbing.

Every route that needs an authenticated user declares
:func:`get_current_user`; every role-restricted route declares
:func:`require_roles`. Passwords are hashed with bcrypt and sessions are HS256
JWTs carrying ``sub``, ``role``, ``iat`` and ``exp``.
"""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db import get_db
from app.models import User

_UNAUTHORIZED = {
    "code": "unauthorized",
    "message": "Authentication required",
    "fields": {},
}
_FORBIDDEN = {
    "code": "forbidden",
    "message": "You do not have permission to perform this action",
    "fields": {},
}


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Check a plaintext password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(user: User) -> str:
    """Create a signed JWT for ``user``."""
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    """Decode and verify a JWT, raising 401 when invalid or expired."""
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=_UNAUTHORIZED) from exc


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Resolve the authenticated user from the Bearer token, or raise 401."""
    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail=_UNAUTHORIZED)

    payload = decode_token(token)
    subject = payload.get("sub")
    try:
        user_id = int(subject)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail=_UNAUTHORIZED) from exc

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail=_UNAUTHORIZED)
    return user


def require_roles(*roles: str) -> Callable[..., User]:
    """Build a dependency that allows only the given roles, else 403."""

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail=_FORBIDDEN)
        return current_user

    return dependency
