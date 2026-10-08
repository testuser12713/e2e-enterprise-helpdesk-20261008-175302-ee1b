"""Schemas for ticket comments.

A comment is always attached to a ticket and carries its author as the public
user shape. The request body is trimmed and must not be empty, which the
unified validation handler reports as a 422 field message under ``body``.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.common import UserPublic


class CommentCreate(BaseModel):
    """Request body for ``POST /tickets/{ticket_id}/comments``."""

    body: str

    @field_validator("body")
    @classmethod
    def _body_not_empty(cls, value: str) -> str:
        """Reject a body that is empty or only whitespace."""
        stripped = value.strip()
        if not stripped:
            raise ValueError("Comment body must not be empty")
        return stripped


class CommentRead(BaseModel):
    """A comment as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    body: str
    author: UserPublic
    created_at: datetime
