"""Request and response schemas for the ticket routes."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import UserPublic

CategoryValue = Literal["hardware", "software", "network", "access", "other"]
PriorityValue = Literal["critical", "high", "medium", "low"]
StatusValue = Literal["open", "in_progress", "closed"]


class TicketCreate(BaseModel):
    """Payload for creating a ticket."""

    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    category: CategoryValue
    priority: PriorityValue


class TicketUpdate(BaseModel):
    """Payload for a partial ticket update. Unset fields stay unchanged."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category: CategoryValue | None = None
    priority: PriorityValue | None = None
    status: StatusValue | None = None
    assignee_id: int | None = None


class AssignPayload(BaseModel):
    """Payload for assigning a ticket to an agent or admin."""

    assignee_id: int


class TicketRead(BaseModel):
    """A ticket as exposed by the API."""

    id: int
    title: str
    description: str
    category: str
    priority: str
    status: str
    created_by: int
    assignee: UserPublic | None = None
    due_at: datetime | None = None
    is_overdue: bool
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None = None


class TicketListResponse(BaseModel):
    """A page of tickets plus its pagination metadata."""

    items: list[TicketRead]
    total: int
    page: int
    page_size: int
    pages: int


class HistoryEntryRead(BaseModel):
    """One entry of a ticket's change log."""

    field: str
    old_value: str | None = None
    new_value: str | None = None
    actor: UserPublic
    created_at: datetime
