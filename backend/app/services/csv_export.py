"""CSV serialization for the filtered ticket export.

The export shares its columns with the ticket list: the same tickets, in the
same order, rendered as a semicolon-separated UTF-8 document with a fixed,
German header row.
"""

import csv
from io import StringIO

from app.models import Ticket
from app.services.ticket_query import serialize_ticket

# Fixed column order promised by AC-13.
CSV_HEADER: list[str] = [
    "ID",
    "Titel",
    "Kategorie",
    "Priorität",
    "Status",
    "Zuständig",
    "Fälligkeit",
    "Überfällig",
    "Erstellt am",
]

CSV_DELIMITER = ";"
CSV_LINETERMINATOR = "\r\n"


def _cell(value: object) -> str:
    """Render a serialized value as a CSV cell (empty string for ``None``)."""
    return "" if value is None else str(value)


def ticket_row(ticket: Ticket) -> list[str]:
    """Render one ticket as a CSV row in the fixed column order."""
    data = serialize_ticket(ticket)
    assignee = data.get("assignee")
    assignee_name = assignee["full_name"] if assignee else ""
    return [
        _cell(data["id"]),
        _cell(data["title"]),
        _cell(data["category"]),
        _cell(data["priority"]),
        _cell(data["status"]),
        assignee_name,
        _cell(data["due_at"]),
        "ja" if data["is_overdue"] else "nein",
        _cell(data["created_at"]),
    ]


def tickets_to_csv(tickets: list[Ticket]) -> str:
    """Serialize ``tickets`` into the export document, header included."""
    buffer = StringIO()
    writer = csv.writer(
        buffer,
        delimiter=CSV_DELIMITER,
        lineterminator=CSV_LINETERMINATOR,
    )
    writer.writerow(CSV_HEADER)
    for ticket in tickets:
        writer.writerow(ticket_row(ticket))
    return buffer.getvalue()
