"""Shared ticket query building and serialization.

This module holds the filter signature the ticket list and the CSV export both
import. Its behaviour is filled in by the ticket-CRUD ticket; until then both
functions raise the unified 501 error.
"""

from dataclasses import dataclass

from sqlalchemy import Select

from app.core.errors import not_implemented
from app.models import Ticket, User


@dataclass
class TicketFilterParams:
    """Every filter, sort and pagination input the ticket list accepts."""

    search: str | None = None
    status: str | None = None
    priority: str | None = None
    assignee_id: int | None = None
    sort: str = "due_at"
    order: str = "asc"
    page: int = 1
    page_size: int = 25


def build_ticket_query(filters: TicketFilterParams, user: User) -> Select:
    """Build the filtered/sorted ticket select. Implemented by the CRUD ticket."""
    not_implemented("build_ticket_query")


def serialize_ticket(ticket: Ticket) -> dict:
    """Serialize a ticket to the API shape. Implemented by the CRUD ticket."""
    not_implemented("serialize_ticket")
