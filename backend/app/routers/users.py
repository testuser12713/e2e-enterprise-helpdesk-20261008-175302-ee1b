"""Administrator user management routes. Filled in by the users ticket."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.errors import not_implemented
from app.core.security import require_roles
from app.db import get_db
from app.models import User
from app.schemas.common import UserPublic

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserPublic])
def list_users(
    role: str | None = None,
    is_active: bool | None = None,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> list[UserPublic]:
    """List users (admin only). 501 until the users ticket lands."""
    not_implemented("GET /users")


@router.post("", status_code=status.HTTP_201_CREATED, response_model=UserPublic)
def create_user(
    payload: dict,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> UserPublic:
    """Create a user (admin only). 501 until the users ticket lands."""
    not_implemented("POST /users")


@router.get("/assignable", response_model=list[UserPublic])
def list_assignable(
    current_user: User = Depends(require_roles("agent", "admin")),
    db: Session = Depends(get_db),
) -> list[UserPublic]:
    """List active agents/admins for assignment. 501 until filled."""
    not_implemented("GET /users/assignable")


@router.patch("/{user_id}", response_model=UserPublic)
def update_user(
    user_id: int,
    payload: dict,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> UserPublic:
    """Update role/active state (admin only). 501 until the users ticket lands."""
    not_implemented("PATCH /users/{user_id}")
