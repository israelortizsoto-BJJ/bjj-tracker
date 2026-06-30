import json
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = "0.2"
LEGACY_SCHEMA_VERSION = "0.1"

REQUIRED_COLLECTIONS = (
    "sessions",
    "investigations",
    "boundaries",
    "qaRuns",
    "decisions",
    "parkingLot",
    "doctrines",
    "insights",
    "risks",
)

SESSION_RELATIONSHIP_FIELDS = (
    "investigationIds",
    "decisionIds",
    "qaRunIds",
    "parkingLotIds",
    "boundaryIds",
    "doctrineIds",
    "insightIds",
    "riskIds",
)

SUMMARY_FORBIDDEN_MARKERS = (
    "decision:",
    "parking lot:",
    "open investigation:",
    "risks:",
    "tomorrow begins:",
    "what happened today:",
)


class StoreError(Exception):
    """Knowledge store load, save, or validation failure."""


def empty_store() -> dict:
    now = _utc_now()
    return {
        "schemaVersion": SCHEMA_VERSION,
        "updatedAt": now,
        "sessions": [],
        "investigations": [],
        "boundaries": [],
        "qaRuns": [],
        "decisions": [],
        "parkingLot": [],
        "doctrines": [],
        "insights": [],
        "risks": [],
    }


def migrate_envelope(store: dict) -> dict:
    """Upgrade a v0.1 envelope to v0.2 in memory. Does not fix invalid sessions."""
    if store.get("schemaVersion") != LEGACY_SCHEMA_VERSION:
        return store

    migrated = dict(store)
    migrated["schemaVersion"] = SCHEMA_VERSION

    for collection in ("doctrines", "insights", "risks"):
        migrated.setdefault(collection, [])

    for investigation in migrated.get("investigations", []):
        if not isinstance(investigation, dict):
            continue
        closed_boundary = investigation.get("closedBoundary")
        if not closed_boundary:
            continue
        related = list(investigation.get("relatedBoundaryIds") or [])
        if closed_boundary not in related:
            investigation["relatedBoundaryIds"] = related + [closed_boundary]

    return migrated


def validate_session_summary(summary: str, *, session_id: str | None = None) -> list[str]:
    errors: list[str] = []
    prefix = f"Session {session_id!r}: " if session_id else "Session: "

    if "\n" in summary:
        errors.append(
            f"{prefix}summary must be a one-line focus label; "
            "multi-line content belongs in atomic records."
        )

    lowered = summary.lower()
    for marker in SUMMARY_FORBIDDEN_MARKERS:
        if marker in lowered:
            errors.append(
                f"{prefix}summary must not embed atomic facts "
                f"(found forbidden marker {marker!r})."
            )
            break

    return errors


def validate_session(session: dict, index: int) -> list[str]:
    errors: list[str] = []
    session_id = session.get("id", f"<sessions[{index}]>")

    if session.get("status") == "closed" and not session.get("endedAt"):
        errors.append(f"Session {session_id!r}: endedAt is required when status is closed.")

    summary = session.get("summary")
    if isinstance(summary, str) and summary.strip():
        errors.extend(validate_session_summary(summary, session_id=session_id))

    for field in SESSION_RELATIONSHIP_FIELDS:
        value = session.get(field)
        if value is None:
            continue
        if not isinstance(value, list):
            errors.append(f"Session {session_id!r}: {field} must be an array.")
        elif not all(isinstance(item, str) for item in value):
            errors.append(f"Session {session_id!r}: {field} must contain only string IDs.")

    return errors


def validate_envelope(store: dict) -> list[str]:
    errors: list[str] = []

    if not isinstance(store, dict):
        return ["Knowledge store root must be a JSON object."]

    if "schemaVersion" not in store:
        errors.append("Missing required field: schemaVersion")
    elif store["schemaVersion"] not in (SCHEMA_VERSION, LEGACY_SCHEMA_VERSION):
        errors.append(
            f"Unsupported schemaVersion: {store['schemaVersion']!r} "
            f"(expected {SCHEMA_VERSION!r})"
        )

    if "updatedAt" not in store:
        errors.append("Missing required field: updatedAt")

    version = store.get("schemaVersion")
    collections = REQUIRED_COLLECTIONS if version == SCHEMA_VERSION else REQUIRED_COLLECTIONS[:6]

    for collection in collections:
        if collection not in store:
            errors.append(f"Missing required collection: {collection}")
        elif not isinstance(store[collection], list):
            errors.append(f"Collection {collection!r} must be an array.")

    if version == SCHEMA_VERSION:
        for index, session in enumerate(store.get("sessions", [])):
            if isinstance(session, dict):
                errors.extend(validate_session(session, index))
            else:
                errors.append(f"sessions[{index}] must be an object.")

    return errors


def load_store(path: Path, *, migrate_legacy: bool = True) -> dict:
    if not path.exists():
        raise StoreError(f"Knowledge store not found: {path}")

    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise StoreError(f"Cannot read knowledge store: {exc}") from exc

    try:
        store = json.loads(text)
    except json.JSONDecodeError as exc:
        raise StoreError(f"Invalid JSON in knowledge store: {exc}") from exc

    if migrate_legacy and store.get("schemaVersion") == LEGACY_SCHEMA_VERSION:
        store = migrate_envelope(store)

    errors = validate_envelope(store)
    if errors:
        message = "Knowledge store validation failed:\n  - " + "\n  - ".join(errors)
        raise StoreError(message)

    return store


def save_store(path: Path, store: dict) -> dict:
    if store.get("schemaVersion") == LEGACY_SCHEMA_VERSION:
        store = migrate_envelope(store)

    errors = validate_envelope(store)
    if errors:
        message = "Knowledge store validation failed:\n  - " + "\n  - ".join(errors)
        raise StoreError(message)

    store["schemaVersion"] = SCHEMA_VERSION
    store["updatedAt"] = _utc_now()

    for collection in ("doctrines", "insights", "risks"):
        store.setdefault(collection, [])

    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(store, indent=2) + "\n",
            encoding="utf-8",
        )
    except OSError as exc:
        raise StoreError(f"Cannot write knowledge store: {exc}") from exc

    return store


def one_line_summary(text: str, *, max_length: int = 200) -> str:
    """Reduce multiline input to a single-line session focus label."""
    first_line = text.strip().splitlines()[0].strip() if text.strip() else ""
    if len(first_line) <= max_length:
        return first_line
    return first_line[: max_length - 1].rstrip() + "…"


def _utc_now() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )
