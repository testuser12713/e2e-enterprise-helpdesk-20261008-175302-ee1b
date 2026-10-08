"""Ticket CRUD and workflow routes."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.security import get_current_user
from app.db import get_db
from app.deps import ensure_ticket_access, get_ticket_or_404
from app.models import Ticket, TicketChange, User
from app.schemas.common import UserPublic
from app.schemas.tickets import (
    AssignPayload,
    HistoryEntryRead,
    TicketCreate,
    TicketListResponse,
    TicketRead,
    TicketUpdate,
)
from app.services.history import record_change
from app.services.sla import compute_due_at
from app.services.ticket_query import (
    TicketFilterParams,
    build_ticket_query,
    count_ticket_query,
    iso_utc,
    serialize_ticket,
)

router = APIRouter(prefix="/tickets", tags=["tickets"])

_TRACKED_FIELDS = ("status", "priority", "category")


def _forbidden(message: str) -> HTTPException:
    return HTTPException(
        status_code=403,
        detail={"code": "forbidden", "message": message, "fields": {}},
    )


def _require_assignee_role(user: User) -> None:
    """Assigning and closing are agent/admin actions (AC-03)."""
    if user.role == "melder":
        raise _forbidden("You do not have permission to perform this action")


def _resolve_assignee(db: Session, assignee_id: int) -> User:
    """Return the target user or raise 422 when they cannot be assigned."""
    assignee = db.get(User, assignee_id)
    if assignee is None or not assignee.is_active or assignee.role not in ("agent", "admin"):
        raise HTTPException(
            status_code=422,
            detail={
                "code": "validation_error",
                "message": "Validation failed",
                "fields": {"assignee_id": "Assignee must be an active agent or admin"},
            },
        )
    return assignee


def _serialize_history(change: TicketChange) -> dict:
    return {
        "field": change.field,
        "old_value": change.old_value,
        "new_value": change.new_value,
        "actor": UserPublic.model_validate(change.actor).model_dump(),
        "created_at": iso_utc(change.created_at),
    }


def _apply_assignee(db: Session, ticket: Ticket, assignee_id: int | None, actor: User) -> None:
    """Set (or clear) the assignee and log the change. Never touches due_at."""
    if assignee_id == ticket.assignee_id:
        return
    assignee = _resolve_assignee(db, assignee_id) if assignee_id is not None else None
    old_name = ticket.assignee.full_name if ticket.assignee is not None else None
    new_name = assignee.full_name if assignee is not None else None
    ticket.assignee = assignee
    record_change(db, ticket, "assignee", old_name, new_name, actor)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=TicketRead)
def create_ticket(
    payload: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Create a ticket: starts ``open`` with a due date derived from its priority."""
    ticket = Ticket(
        title=payload.title,
        description=payload.description,
        category=payload.category,
        priority=payload.priority,
        status="open",
        created_by_id=current_user.id,
        due_at=compute_due_at(payload.priority, datetime.now(UTC)),
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return serialize_ticket(ticket)


@router.get("", response_model=TicketListResponse)
def list_tickets(
    filters: TicketFilterParams = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """List tickets with search, filters, sorting and pagination."""
    tickets = db.scalars(build_ticket_query(filters, current_user)).all()
    total = count_ticket_query(filters, current_user, db)
    pages = (total + filters.page_size - 1) // filters.page_size if total else 0
    return {
        "items": [serialize_ticket(ticket) for ticket in tickets],
        "total": total,
        "page": filters.page,
        "page_size": filters.page_size,
        "pages": pages,
    }


@router.get("/{ticket_id}", response_model=TicketRead)
def get_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Fetch one ticket (Melder: own only)."""
    ticket = get_ticket_or_404(ticket_id, db)
    ensure_ticket_access(current_user, ticket)
    return serialize_ticket(ticket)


@router.patch("/{ticket_id}", response_model=TicketRead)
def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Partially update a ticket, logging tracked changes."""
    ticket = get_ticket_or_404(ticket_id, db)
    ensure_ticket_access(current_user, ticket)
    data = payload.model_dump(exclude_unset=True)

    if current_user.role == "melder":
        if "assignee_id" in data:
            raise _forbidden("Melder may not assign tickets")
        if data.get("status") == "closed":
            raise _forbidden("Melder may not close tickets")

    for field in ("title", "description", "category", "priority", "status"):
        if field not in data or data[field] is None:
            continue
        new_value = data[field]
        old_value = getattr(ticket, field)
        if new_value == old_value:
            continue
        setattr(ticket, field, new_value)
        if field in _TRACKED_FIELDS:
            record_change(db, ticket, field, old_value, new_value, current_user)
        if field == "priority":
            ticket.due_at = compute_due_at(new_value, datetime.now(UTC))
        if field == "status":
            ticket.closed_at = datetime.now(UTC) if new_value == "closed" else None

    if "assignee_id" in data:
        _apply_assignee(db, ticket, data["assignee_id"], current_user)

    db.commit()
    db.refresh(ticket)
    return serialize_ticket(ticket)


@router.post("/{ticket_id}/assign", response_model=TicketRead)
def assign_ticket(
    ticket_id: int,
    payload: AssignPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Assign a ticket to an active agent/admin without changing its due date."""
    ticket = get_ticket_or_404(ticket_id, db)
    ensure_ticket_access(current_user, ticket)
    _require_assignee_role(current_user)
    _apply_assignee(db, ticket, payload.assignee_id, current_user)
    db.commit()
    db.refresh(ticket)
    return serialize_ticket(ticket)


@router.post("/{ticket_id}/close", response_model=TicketRead)
def close_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Close a ticket and stamp the closing time."""
    ticket = get_ticket_or_404(ticket_id, db)
    ensure_ticket_access(current_user, ticket)
    _require_assignee_role(current_user)

    if ticket.status != "closed":
        old_status = ticket.status
        ticket.status = "closed"
        ticket.closed_at = datetime.now(UTC)
        record_change(db, ticket, "status", old_status, "closed", current_user)

    db.commit()
    db.refresh(ticket)
    return serialize_ticket(ticket)


@router.get("/{ticket_id}/history", response_model=list[HistoryEntryRead])
def ticket_history(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return a ticket's change log, oldest first."""
    ticket = get_ticket_or_404(ticket_id, db)
    ensure_ticket_access(current_user, ticket)
    changes = db.scalars(
        select(TicketChange)
        .options(selectinload(TicketChange.actor))
        .where(TicketChange.ticket_id == ticket_id)
        .order_by(TicketChange.created_at.asc(), TicketChange.id.asc())
    ).all()
    return [_serialize_history(change) for change in changes]
