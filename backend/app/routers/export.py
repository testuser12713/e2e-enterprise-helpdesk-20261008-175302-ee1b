"""CSV export route for the filtered ticket list."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db import get_db
from app.models import User
from app.services.csv_export import tickets_to_csv
from app.services.ticket_query import TicketFilterParams, build_ticket_query

router = APIRouter(prefix="/tickets", tags=["export"])

CSV_MEDIA_TYPE = "text/csv; charset=utf-8"
CSV_FILENAME = "tickets.csv"


@router.get("/export")
def export_tickets(
    filters: TicketFilterParams = Depends(),
    current_user: User = Depends(require_roles("agent", "admin")),
    db: Session = Depends(get_db),
) -> Response:
    """Export the filtered, sorted ticket list as a CSV download.

    Accepts the same filters as ``GET /tickets`` and applies no pagination, so
    the file contains exactly the tickets the equally filtered list shows.
    """
    query = build_ticket_query(filters, current_user).limit(None).offset(None)
    tickets = list(db.scalars(query).all())
    return Response(
        content=tickets_to_csv(tickets),
        media_type=CSV_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{CSV_FILENAME}"'},
    )
