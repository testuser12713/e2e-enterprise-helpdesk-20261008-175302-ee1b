"""Shared ticket dependencies used by the ticket, comment and history routes."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Ticket, User


def get_ticket_or_404(ticket_id: int, db: Session) -> Ticket:
    """Load a ticket by id or raise the unified 404."""
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Ticket not found", "fields": {}},
        )
    return ticket


def ensure_ticket_access(user: User, ticket: Ticket) -> None:
    """Allow agents/admins everything; a Melder only their own tickets (403)."""
    if user.role == "melder" and ticket.created_by_id != user.id:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "forbidden",
                "message": "You do not have permission to access this ticket",
                "fields": {},
            },
        )
