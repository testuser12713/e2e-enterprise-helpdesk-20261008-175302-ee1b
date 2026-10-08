"""Ticket comment routes. Filled in by the comment ticket."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.errors import not_implemented
from app.core.security import get_current_user
from app.db import get_db
from app.models import User

router = APIRouter(prefix="/tickets", tags=["comments"])


@router.get("/{ticket_id}/comments")
def list_comments(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list:
    """List a ticket's comments. 501 until the comment ticket lands."""
    not_implemented("GET /tickets/{ticket_id}/comments")


@router.post("/{ticket_id}/comments", status_code=status.HTTP_201_CREATED)
def create_comment(
    ticket_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Add a comment. 501 until the comment ticket lands."""
    not_implemented("POST /tickets/{ticket_id}/comments")
