"""Session container record builders."""

from datetime import datetime, timezone
from pathlib import Path

from ods.commands.prompts import next_record_id, utc_now
from ods.knowledge_store import one_line_summary


def session_day_start() -> str:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def next_session_id(store: dict) -> str:
    return next_record_id(store, "sessions", "ses")


def build_session_record(
    store: dict,
    *,
    what_happened: str,
    planning_intent: str,
    decision_ids: list[str] | None = None,
    investigation_ids: list[str] | None = None,
    parking_lot_ids: list[str] | None = None,
    risk_ids: list[str] | None = None,
    repository: str | None = None,
) -> dict:
    now = utc_now()
    record: dict = {
        "id": next_session_id(store),
        "createdAt": now,
        "updatedAt": now,
        "startedAt": session_day_start(),
        "endedAt": now,
        "status": "closed",
        "planningIntent": planning_intent,
        "repository": repository if repository is not None else str(Path.cwd()),
    }

    summary = one_line_summary(what_happened)
    if summary:
        record["summary"] = summary

    if decision_ids:
        record["decisionIds"] = decision_ids
    if investigation_ids:
        record["investigationIds"] = investigation_ids
    if parking_lot_ids:
        record["parkingLotIds"] = parking_lot_ids
    if risk_ids:
        record["riskIds"] = risk_ids

    return record
