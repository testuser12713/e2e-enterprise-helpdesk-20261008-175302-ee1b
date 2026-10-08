"""Authentication routes: registration, login and the current-user endpoint."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.db import get_db
from app.models import User
from app.schemas.auth import LoginRequest, LoginResponse, RegisterRequest
from app.schemas.common import UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])

_UNAUTHORIZED = {
    "code": "unauthorized",
    "message": "Invalid email or password",
    "fields": {},
}
_INACTIVE = {
    "code": "unauthorized",
    "message": "This account is deactivated",
    "fields": {},
}
_EMAIL_TAKEN = {
    "code": "conflict",
    "message": "Email already registered",
    "fields": {"email": "This email address is already registered"},
}


def _find_user_by_email(db: Session, email: str) -> User | None:
    """Find a user by e-mail, case-insensitively."""
    return db.scalar(select(User).where(func.lower(User.email) == email))


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserPublic)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> User:
    """Register a new Melder account with a hashed password."""
    if _find_user_by_email(db, payload.email) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_EMAIL_TAKEN)

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role="melder",
        is_active=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_EMAIL_TAKEN) from exc
    db.refresh(user)
    return user


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    """Authenticate a user and return a session token."""
    user = _find_user_by_email(db, payload.email)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_UNAUTHORIZED)
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_INACTIVE)

    token = create_access_token(user)
    return LoginResponse(access_token=token, token_type="bearer", user=user)


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)) -> User:
    """Return the authenticated user."""
    return current_user
