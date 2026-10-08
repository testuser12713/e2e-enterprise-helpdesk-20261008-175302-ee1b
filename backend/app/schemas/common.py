"""Schemas shared across every router."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserPublic(BaseModel):
    """A user as exposed by the API. Never carries the password hash."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    last_login_at: datetime | None = None


class ErrorBody(BaseModel):
    """The inner body of every error response."""

    code: str
    message: str
    fields: dict[str, str] = {}


class ErrorResponse(BaseModel):
    """The unified error envelope returned by every failing request."""

    error: ErrorBody
