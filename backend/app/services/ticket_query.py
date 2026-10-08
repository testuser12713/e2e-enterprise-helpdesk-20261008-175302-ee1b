"""Shared ticket query building and serialization.

This module holds the filter signature the ticket list and the CSV export both
import, plus the query builder that applies the Melder scoping, search, filters,
sorting and pagination, and the serializer that produces the API shape.
"""

from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import Query
from sqlalchemy import Select, case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Ticket, User
from app.schemas.common import UserPublic

SortValue = Literal["due_at", "priority", "created_at"]
OrderValue = Literal["asc", "desc"]
StatusFilter = Literal["open", "in_progress", "closed"]
PriorityFilter = Literal["critical", "high", "medium", "low"]

# Severity ranking so ``sort=priority`` orders critical first, not alphabetically.
_PRIORITY_RANK = case(
    (Ticket.priority == "critical", 0),
    (Ticket.priority == "high", 1),
    (Ticket.priority == "medium", 2),
    (Ticket.priority == "low", 3),
    else_=4,
)


class TicketFilterParams:
    """Every filter, sort and pagination input the ticket list accepts."""

    def __init__(
        self,
        search: str | None = None,
        status: StatusFilter | None = None,
        priority: PriorityFilter | None = None,
        assignee_id: int | None = None,
        sort: SortValue = "due_at",
        order: OrderValue = "asc",
        page: Annotated[int, Query(ge=1)] = 1,
        page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    ) -> None:
        self.search = search or None
        self.status = status
        self.priority = priority
        self.assignee_id = assignee_id
        self.sort = sort
        self.order = order
        self.page = page
        self.page_size = page_size


def _filtered_query(filters: TicketFilterParams, user: User) -> Select:
    """Apply the Melder scoping, search and filters (no order or paging)."""
    conditions = []
    if user.role == "melder":
        conditions.append(Ticket.created_by_id == user.id)
    if filters.search:
        term = f"%{filters.search}%"
        conditions.append(or_(Ticket.title.ilike(term), Ticket.description.ilike(term)))
    if filters.status:
        conditions.append(Ticket.status == filters.status)
    if filters.priority:
        conditions.append(Ticket.priority == filters.priority)
    if filters.assignee_id is not None:
        conditions.append(Ticket.assignee_id == filters.assignee_id)

    query = select(Ticket)
    if conditions:
        query = query.where(*conditions)
    return query


def _order_expression(sort: SortValue, order: OrderValue):
    """Build the ORDER BY expression for a sort column and direction."""
    column = _PRIORITY_RANK if sort == "priority" else getattr(Ticket, sort, Ticket.due_at)
    expression = column.desc() if order == "desc" else column.asc()
    if sort == "due_at":
        expression = expression.nulls_last()
    return expression


def build_ticket_query(filters: TicketFilterParams, user: User) -> Select:
    """Build the filtered/sorted/paged ticket select for ``user``.

    A Melder only ever sees their own tickets; agents and admins see everything.
    """
    query = _filtered_query(filters, user).options(selectinload(Ticket.assignee))
    query = query.order_by(_order_expression(filters.sort, filters.order), Ticket.id.asc())
    return query.offset((filters.page - 1) * filters.page_size).limit(filters.page_size)


def count_ticket_query(filters: TicketFilterParams, user: User, db: Session) -> int:
    """Count the tickets matching ``filters`` for ``user``, ignoring paging."""
    statement = select(func.count()).select_from(_filtered_query(filters, user).subquery())
    return int(db.scalar(statement) or 0)


def iso_utc(value: datetime | None) -> str | None:
    """Render a datetime as an ISO-8601 UTC string, or ``None``."""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat()


def is_overdue(ticket: Ticket, now: datetime | None = None) -> bool:
    """Whether ``ticket`` is past its due date and not closed."""
    if ticket.due_at is None or ticket.status == "closed":
        return False
    due = ticket.due_at
    if due.tzinfo is None:
        due = due.replace(tzinfo=UTC)
    return due < (now or datetime.now(UTC))


def serialize_ticket(ticket: Ticket) -> dict:
    """Serialize a ticket to the API shape (ISO-8601 UTC, derived ``is_overdue``)."""
    assignee = None
    if ticket.assignee is not None:
        assignee = UserPublic.model_validate(ticket.assignee).model_dump()
    return {
        "id": ticket.id,
        "title": ticket.title,
        "description": ticket.description or "",
        "category": ticket.category,
        "priority": ticket.priority,
        "status": ticket.status,
        "created_by": ticket.created_by_id,
        "assignee": assignee,
        "due_at": iso_utc(ticket.due_at),
        "is_overdue": is_overdue(ticket),
        "created_at": iso_utc(ticket.created_at),
        "updated_at": iso_utc(ticket.updated_at),
        "closed_at": iso_utc(ticket.closed_at),
    }
