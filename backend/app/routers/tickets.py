"""Ticket CRUD and workflow routes. Filled in by the ticket-CRUD ticket."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.errors import not_implemented
from app.core.security import get_current_user
from app.db import get_db
from app.models import User

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_ticket(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Create a ticket. 501 until the ticket-CRUD ticket lands."""
    not_implemented("POST /tickets")


@router.get("")
def list_tickets(
    search: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    assignee_id: int | None = None,
    sort: str = "due_at",
    order: str = "asc",
    page: int = 1,
    page_size: int = 25,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """List tickets with filters. 501 until the ticket-CRUD ticket lands."""
    not_implemented("GET /tickets")


@router.get("/{ticket_id}")
def get_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Fetch one ticket. 501 until the ticket-CRUD ticket lands."""
    not_implemented("GET /tickets/{ticket_id}")


@router.patch("/{ticket_id}")
def update_ticket(
    ticket_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Update a ticket. 501 until the ticket-CRUD ticket lands."""
    not_implemented("PATCH /tickets/{ticket_id}")


@router.post("/{ticket_id}/assign")
def assign_ticket(
    ticket_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Assign a ticket. 501 until the ticket-CRUD ticket lands."""
    not_implemented("POST /tickets/{ticket_id}/assign")


@router.post("/{ticket_id}/close")
def close_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Close a ticket. 501 until the ticket-CRUD ticket lands."""
    not_implemented("POST /tickets/{ticket_id}/close")


@router.get("/{ticket_id}/history")
def ticket_history(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list:
    """Return the ticket change log. 501 until the ticket-CRUD ticket lands."""
    not_implemented("GET /tickets/{ticket_id}/history")
