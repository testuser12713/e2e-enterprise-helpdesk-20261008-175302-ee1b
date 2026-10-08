"""SLA rules: the due date a ticket gets from its priority.

The hours are the single source of truth for both ticket creation and any later
priority change, so the due date can never drift from the priority shown.
"""

from datetime import datetime, timedelta

# How long a ticket of a given priority may stay open before it is due.
DUE_HOURS: dict[str, int] = {
    "critical": 4,
    "high": 24,
    "medium": 72,
    "low": 168,
}


def compute_due_at(priority: str, base: datetime) -> datetime:
    """Return ``base`` plus the SLA window for ``priority``.

    Raises:
        ValueError: when ``priority`` is not one of the known SLA levels.
    """
    try:
        hours = DUE_HOURS[priority]
    except KeyError as exc:
        raise ValueError(f"Unknown priority: {priority!r}") from exc
    return base + timedelta(hours=hours)
