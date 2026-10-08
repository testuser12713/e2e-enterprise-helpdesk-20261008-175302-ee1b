"""SLA due-date rules: one check per priority level."""

from datetime import UTC, datetime, timedelta

import pytest

from app.services.sla import DUE_HOURS, compute_due_at

BASE = datetime(2026, 10, 8, 12, 0, tzinfo=UTC)


def test_due_hours_cover_every_priority() -> None:
    assert set(DUE_HOURS) == {"critical", "high", "medium", "low"}


@pytest.mark.parametrize(
    ("priority", "hours"),
    [("critical", 4), ("high", 24), ("medium", 72), ("low", 168)],
)
def test_compute_due_at_adds_the_priority_window(priority: str, hours: int) -> None:
    assert compute_due_at(priority, BASE) == BASE + timedelta(hours=hours)


def test_compute_due_at_matches_the_declared_table() -> None:
    for priority, hours in DUE_HOURS.items():
        assert compute_due_at(priority, BASE) == BASE + timedelta(hours=hours)


def test_unknown_priority_raises_value_error() -> None:
    with pytest.raises(ValueError):
        compute_due_at("urgent", BASE)
