"""CSV export route. Filled in by the export ticket."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import not_implemented
from app.core.security import get_current_user
from app.db import get_db
from app.models import User

router = APIRouter(prefix="/tickets", tags=["export"])


@router.get("/export")
def export_tickets(
    search: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    assignee_id: int | None = None,
    sort: str = "due_at",
    order: str = "asc",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export the filtered ticket list as CSV. 501 until the export ticket lands."""
    not_implemented("GET /tickets/export")
