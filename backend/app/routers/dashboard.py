"""Dashboard metric routes. Filled in by the dashboard ticket."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import not_implemented
from app.core.security import get_current_user
from app.db import get_db
from app.models import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/metrics")
def metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Return dashboard metrics. 501 until the dashboard ticket lands."""
    not_implemented("GET /dashboard/metrics")
