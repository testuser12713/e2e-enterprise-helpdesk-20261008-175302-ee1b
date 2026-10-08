"""Request and response schemas for registration and login.

The plaintext password appears only on the way in; no response model in this
module (or anywhere else) carries it or its hash.
"""

import re

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import UserPublic

# Minimum password length enforced by the registration form and the API.
MIN_PASSWORD_LENGTH = 8

# A deliberately small, dependency-free e-mail check: one ``@`` separating a
# local part and a domain that contains a dot. It rejects the obvious garbage
# ("not-an-email", "a@b", "a b@c.d") without pulling in an extra package.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_email(value: str) -> str:
    """Strip surrounding whitespace and lower-case an e-mail address."""
    return value.strip().lower()


class RegisterRequest(BaseModel):
    """Body of ``POST /auth/register``."""

    email: str
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=MIN_PASSWORD_LENGTH)

    @field_validator("email")
    @classmethod
    def _validate_email(cls, value: str) -> str:
        normalized = _normalize_email(value)
        if not _EMAIL_RE.match(normalized):
            raise ValueError("value is not a valid email address")
        return normalized


class LoginRequest(BaseModel):
    """Body of ``POST /auth/login``."""

    email: str
    password: str

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, value: str) -> str:
        return _normalize_email(value)


class LoginResponse(BaseModel):
    """Body of a successful ``POST /auth/login``."""

    access_token: str
    token_type: str = "bearer"
    user: UserPublic
