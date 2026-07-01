"""Frozen public contract for ODS event types."""

EVENT_SCHEMA_VERSION = "0.1"

MISSION_BEGIN = "mission.begin"
MISSION_CLOSE = "mission.close"
SESSION_CLOSED = "session.closed"
DECISION_PROMOTED = "decision.promoted"
WORK_STARTED = "work.started"
WORK_PROGRESS = "work.progress"

EVENT_TYPES = frozenset(
    {
        MISSION_BEGIN,
        MISSION_CLOSE,
        SESSION_CLOSED,
        DECISION_PROMOTED,
        WORK_STARTED,
        WORK_PROGRESS,
    }
)

OPERATIONAL_POSTURES = frozenset(
    {
        "Executing",
        "Paused",
        "Completed",
        "Ready to Resume",
        "Blocked",
    }
)
