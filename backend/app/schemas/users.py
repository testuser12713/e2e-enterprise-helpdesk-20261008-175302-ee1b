"""Schemas for administrator user management.

``role`` is constrained to the values the domain allows, so an unknown role is
rejected by request validation with the unified 422 body. Responses always use
:class:`app.schemas.common.UserPublic`, which never carries the password hash.
"""

from typing import Literal

from pydantic import BaseModel, Field

Role = Literal["melder", "agent", "admin"]


class UserCreate(BaseModel):
    """Payload for creating a user from the administration area."""

    email: str = Field(min_length=1, max_length=255)
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)
    role: Role


class UserUpdate(BaseModel):
    """Payload for changing a user's role and/or activation state."""

    role: Role | None = None
    is_active: bool | None = None
