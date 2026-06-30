"""Resolve knowledge store records by ID."""

from ods.knowledge_store import StoreError


COLLECTION_BY_SESSION_FIELD = {
    "decisionIds": "decisions",
    "investigationIds": "investigations",
    "parkingLotIds": "parkingLot",
    "riskIds": "risks",
}


def index_records(store: dict, collection: str) -> dict[str, dict]:
    records: dict[str, dict] = {}
    for record in store.get(collection, []):
        if isinstance(record, dict) and "id" in record:
            records[record["id"]] = record
    return records


def resolve_ids(
    store: dict,
    record_ids: list[str],
    *,
    collection: str,
) -> tuple[list[dict], list[str]]:
    index = index_records(store, collection)
    resolved: list[dict] = []
    missing: list[str] = []
    for record_id in sorted(record_ids):
        record = index.get(record_id)
        if record is None:
            missing.append(record_id)
        else:
            resolved.append(record)
    return resolved, missing


def resolve_session_links(store: dict, session: dict) -> dict[str, list[dict]]:
    """Resolve all atomic records linked from a Session."""
    resolved: dict[str, list[dict]] = {}
    missing_all: list[str] = []

    for field, collection in COLLECTION_BY_SESSION_FIELD.items():
        record_ids = session.get(field) or []
        records, missing = resolve_ids(store, record_ids, collection=collection)
        resolved[collection] = records
        for record_id in missing:
            missing_all.append(f"{field}: {record_id}")

    if missing_all:
        joined = ", ".join(missing_all)
        raise StoreError(f"Cannot resolve linked records for session: {joined}")

    return resolved


def closed_sessions_sorted(store: dict) -> list[dict]:
    """Return closed sessions sorted by endedAt descending, then id descending."""
    sessions = [
        session
        for session in store.get("sessions", [])
        if isinstance(session, dict)
        and session.get("status") == "closed"
        and session.get("endedAt")
    ]
    return sorted(
        sessions,
        key=lambda session: (session["endedAt"], session.get("id", "")),
        reverse=True,
    )


def open_records(store: dict, collection: str, *, status: str = "open") -> list[dict]:
    """Return open records from a collection sorted by id."""
    records = [
        record
        for record in store.get(collection, [])
        if isinstance(record, dict)
        and record.get("status") == status
        and "id" in record
    ]
    return sorted(records, key=lambda record: record["id"])


def decisions_since_previous_session(store: dict) -> tuple[list[dict], dict | None, dict | None]:
    """Return decisions created after the previous closed session ended."""
    sessions = closed_sessions_sorted(store)
    latest = sessions[0] if sessions else None
    previous = sessions[1] if len(sessions) > 1 else None

    decisions = [
        record
        for record in store.get("decisions", [])
        if isinstance(record, dict) and "id" in record
    ]

    if previous is None:
        return sorted(decisions, key=lambda record: record["id"]), latest, previous

    cutoff = previous["endedAt"]
    since = [
        record
        for record in decisions
        if record.get("createdAt", "") > cutoff
    ]
    return sorted(since, key=lambda record: record["id"]), latest, previous
