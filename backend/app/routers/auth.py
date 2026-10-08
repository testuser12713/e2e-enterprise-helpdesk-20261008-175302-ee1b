"""Authentication routes. Filled in by the registration/login ticket."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.errors import not_implemented
from app.core.security import get_current_user
from app.db import get_db
from app.models import User
from app.schemas.common import UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserPublic)
def register(payload: dict, db: Session = Depends(get_db)) -> UserPublic:
    """Register a new Melder account (501 until the auth ticket lands)."""
    not_implemented("POST /auth/register")


@router.post("/login")
def login(payload: dict, db: Session = Depends(get_db)) -> dict:
    """Authenticate and return a session token (501 until the auth ticket)."""
    not_implemented("POST /auth/login")


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)) -> UserPublic:
    """Return the authenticated user (501 until the auth ticket lands)."""
    not_implemented("GET /auth/me")
