"""Ticket change log helper.

Every write of a tracked field (status, priority, category, assignee) goes
through :func:`record_change`, so the change log stays complete and consistent.
The caller owns the transaction: this only stages the row on the session.
"""

from sqlalchemy.orm import Session

from app.models import Ticket, TicketChange, User


def record_change(
    db: Session,
    ticket: Ticket,
    field: str,
    old_value: object,
    new_value: object,
    actor: User,
) -> TicketChange:
    """Stage a :class:`TicketChange` row for ``ticket`` and return it.

    Values are stored as text (or ``None``); the actual commit is left to the
    caller so a request writes the ticket and its log entry atomically.
    """
    change = TicketChange(
        ticket_id=ticket.id,
        field=field,
        old_value=None if old_value is None else str(old_value),
        new_value=None if new_value is None else str(new_value),
        actor_id=actor.id,
    )
    db.add(change)
    return change
