"""Promotion Bridge adapter — canonical payload to knowledge store."""

import json
from pathlib import Path

from ods.commands.session import build_session_record
from ods.config import get_eod_dir, get_store_path
from ods.eos_pipeline import print_eos_pipeline_summary, run_eos_pipeline
from ods.generators.eod import write_eod
from ods.knowledge_store import load_store, save_store
from ods.payload import validate_payload
from ods.records import (
    build_decision_record,
    build_investigation_record,
    build_parking_record,
    build_risk_record,
)


class IngestError(Exception):
    """Promotion payload validation or ingest failure."""


def apply_payload(store: dict, payload: dict) -> tuple[dict, dict[str, list[str]]]:
    """Convert a validated payload into store records. Does not persist."""
    session_data = payload["session"]
    project_name = payload["project"]["name"].strip()

    decision_ids: list[str] = []
    investigation_ids: list[str] = []
    parking_lot_ids: list[str] = []
    risk_ids: list[str] = []

    for item in payload["decisions"]:
        record = build_decision_record(
            store,
            description=item["description"].strip(),
            supporting_evidence=item["supportingEvidence"],
            date=item.get("date"),
        )
        store["decisions"].append(record)
        decision_ids.append(record["id"])

    for item in payload["investigations"]:
        record = build_investigation_record(
            store,
            title=item["title"].strip(),
            objective=item["objective"].strip(),
        )
        store["investigations"].append(record)
        investigation_ids.append(record["id"])

    for item in payload["parkingLot"]:
        record = build_parking_record(
            store,
            title=item["title"].strip(),
            reason_deferred=item["reasonDeferred"].strip(),
        )
        store["parkingLot"].append(record)
        parking_lot_ids.append(record["id"])

    for item in payload["risks"]:
        record = build_risk_record(store, description=item["description"].strip())
        store["risks"].append(record)
        risk_ids.append(record["id"])

    summary = session_data.get("summary") or ""
    session = build_session_record(
        store,
        what_happened=summary,
        planning_intent=session_data["planningIntent"].strip(),
        decision_ids=decision_ids or None,
        investigation_ids=investigation_ids or None,
        parking_lot_ids=parking_lot_ids or None,
        risk_ids=risk_ids or None,
        repository=project_name,
    )
    store["sessions"].append(session)

    counts = {
        "decisions": decision_ids,
        "investigations": investigation_ids,
        "parkingLot": parking_lot_ids,
        "risks": risk_ids,
    }
    return session, counts


def run_ingest(payload_path: Path, *, store_path: Path | None = None) -> None:
    path = store_path or get_store_path()

    try:
        text = payload_path.read_text(encoding="utf-8")
    except OSError as exc:
        raise IngestError(f"Cannot read payload file: {exc}") from exc

    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise IngestError(f"Invalid JSON in payload file: {exc}") from exc

    validate_payload(payload, error_class=IngestError)

    store = load_store(path)
    session, counts = apply_payload(store, payload)
    save_store(path, store)

    eod_path = write_eod(store, session, get_eod_dir())

    print("Promotion ingested successfully.")
    print()
    print("Session:")
    print(session["id"])
    print()
    print("Decisions:")
    print(len(counts["decisions"]))
    print()
    print("Investigations:")
    print(len(counts["investigations"]))
    print()
    print("Parking Lot:")
    print(len(counts["parkingLot"]))
    print()
    print("Risks:")
    print(len(counts["risks"]))
    print()
    print("EOD:")
    print(eod_path)
    print_eos_pipeline_summary(run_eos_pipeline(eod_path=eod_path))
