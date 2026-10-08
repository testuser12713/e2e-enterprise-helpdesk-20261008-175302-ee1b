"""Administrator user management routes.

Listing, creating and updating users is reserved for the ``admin`` role.
``GET /users/assignable`` is open to agents and admins as well, because both may
assign tickets and therefore need to populate the assignment dropdown. Passwords
are hashed with :func:`app.core.security.hash_password`; the hash never leaves the
database and is never logged.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, require_roles
from app.db import get_db
from app.models import User
from app.schemas.common import UserPublic
from app.schemas.users import UserCreate, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def _get_user_or_404(user_id: int, db: Session) -> User:
    """Load a user by id or raise the unified 404 body."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "User not found", "fields": {}},
        )
    return user


@router.get("", response_model=list[UserPublic])
def list_users(
    role: str | None = None,
    is_active: bool | None = None,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> list[UserPublic]:
    """List users, optionally filtered by role and activation state (admin only)."""
    stmt = select(User)
    if role is not None:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active.is_(is_active))
    stmt = stmt.order_by(User.id)
    return list(db.scalars(stmt).all())


@router.post("", status_code=status.HTTP_201_CREATED, response_model=UserPublic)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> UserPublic:
    """Create a user with the given role (admin only)."""
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "conflict",
                "message": "E-mail already registered",
                "fields": {"email": "This e-mail is already registered"},
            },
        )

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/assignable", response_model=list[UserPublic])
def list_assignable(
    current_user: User = Depends(require_roles("agent", "admin")),
    db: Session = Depends(get_db),
) -> list[UserPublic]:
    """Return active agents and administrators for the assignment dropdown."""
    stmt = (
        select(User)
        .where(User.is_active.is_(True), User.role.in_(("agent", "admin")))
        .order_by(User.full_name, User.id)
    )
    return list(db.scalars(stmt).all())


@router.patch("/{user_id}", response_model=UserPublic)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> UserPublic:
    """Change a user's role and/or activation state (admin only)."""
    user = _get_user_or_404(user_id, db)

    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.commit()
    db.refresh(user)
    return user
