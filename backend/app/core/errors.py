"""Unified error body helpers.

Every error leaving the API uses the same envelope::

    {"error": {"code": "...", "message": "...", "fields": {"field": "msg"}}}

The actual handlers live in ``app.main``; the helpers here build the payload
and let routes raise stub errors that already carry the right shape.
"""

from typing import Any

from fastapi import HTTPException
from fastapi.responses import JSONResponse

# Maps a plain HTTP status to a machine-readable error code. A detail dict may
# override this by carrying its own "code".
STATUS_CODES: dict[int, str] = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    422: "validation_error",
    500: "internal_error",
    501: "not_implemented",
    503: "service_unavailable",
}


def error_payload(code: str, message: str, fields: dict[str, str] | None = None) -> dict[str, Any]:
    """Build the unified error envelope."""
    return {"error": {"code": code, "message": message, "fields": fields or {}}}


def error_response(
    status_code: int,
    code: str,
    message: str,
    fields: dict[str, str] | None = None,
) -> JSONResponse:
    """Build a :class:`JSONResponse` carrying the unified error envelope."""
    return JSONResponse(status_code=status_code, content=error_payload(code, message, fields))


def not_implemented(feature: str) -> None:
    """Raise a 501 for a route whose feature ticket has not landed yet."""
    raise HTTPException(
        status_code=501,
        detail={
            "code": "not_implemented",
            "message": f"{feature} is not implemented yet",
            "fields": {},
        },
    )
