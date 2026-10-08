"""Application settings, read from the environment.

Configuration is read lazily through :func:`get_settings` so that importing a
module never requires the environment to be complete. The settings object is
validated once during application startup (see ``app.main.lifespan``), which
fails with a message naming the missing variable instead of a bare traceback.
"""

import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_CORS_ORIGINS = "http://localhost:5173"


class Settings(BaseSettings):
    """Runtime configuration for the backend service."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    cors_origins: str = DEFAULT_CORS_ORIGINS

    @property
    def cors_origin_list(self) -> list[str]:
        """The allowed CORS origins as a clean list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings, created on first use."""
    return Settings()


def get_cors_origins() -> list[str]:
    """Read the allowed CORS origins without requiring the full settings.

    CORS middleware has to be configured while the app object is built, so this
    reads the non-secret ``CORS_ORIGINS`` variable directly and falls back to a
    development default instead of forcing the whole (secret-bearing) settings
    object to validate at import time.
    """
    raw = os.environ.get("CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]
