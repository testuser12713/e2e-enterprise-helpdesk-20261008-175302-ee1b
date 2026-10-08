"""Ticket comment routes.

Both routes load the ticket through the shared dependencies so that an unknown
ticket answers 404 and a Melder reaching a foreign ticket answers 403.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db import get_db
from app.deps import ensure_ticket_access, get_ticket_or_404
from app.models import Comment, User
from app.schemas.comments import CommentCreate, CommentRead

router = APIRouter(prefix="/tickets", tags=["comments"])


@router.get("/{ticket_id}/comments", response_model=list[CommentRead])
def list_comments(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Comment]:
    """Return the ticket's comments, oldest first."""
    ticket = get_ticket_or_404(ticket_id, db)
    ensure_ticket_access(current_user, ticket)
    return list(
        db.scalars(
            select(Comment)
            .where(Comment.ticket_id == ticket_id)
            .order_by(Comment.created_at.asc(), Comment.id.asc())
        ).all()
    )


@router.post(
    "/{ticket_id}/comments", status_code=status.HTTP_201_CREATED, response_model=CommentRead
)
def create_comment(
    ticket_id: int,
    payload: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Comment:
    """Create a comment on the ticket authored by the current user."""
    ticket = get_ticket_or_404(ticket_id, db)
    ensure_ticket_access(current_user, ticket)
    comment = Comment(ticket_id=ticket_id, author_id=current_user.id, body=payload.body)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment
