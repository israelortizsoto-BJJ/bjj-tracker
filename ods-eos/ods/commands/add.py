"""Interactive add commands for atomic knowledge store records."""

from pathlib import Path

from ods.commands.prompts import read_evidence_references, read_multiline, read_required
from ods.config import get_store_path
from ods.knowledge_store import load_store, save_store
from ods.records import (
    build_decision_record,
    build_investigation_record,
    build_parking_record,
    build_risk_record,
)


class AddError(Exception):
    """Add command cannot complete without writing invalid store data."""


def _append_record(
    store: dict,
    *,
    collection: str,
    record: dict,
    path: Path,
) -> str:
    store[collection].append(record)
    save_store(path, store)
    return record["id"]


def capture_decision(store: dict, path: Path, *, banner: bool = True) -> str:
    if banner:
        print("ODS-EOS Add Decision")
        print("====================")
        print()

    description = read_multiline("What was decided?")
    while not description:
        print("  (required — please describe the decision.)")
        description = read_multiline("What was decided?")

    if banner:
        print()
        print("Decision date: today (UTC)")
        print()

    supporting_evidence = read_evidence_references(minimum=1)

    record = build_decision_record(
        store,
        description=description,
        supporting_evidence=supporting_evidence,
    )

    record_id = _append_record(store, collection="decisions", record=record, path=path)
    if banner:
        print()
        print(f"Decision created: {record_id}")
    else:
        print(f"  Decision created: {record_id}")
    return record_id


def capture_investigation(store: dict, path: Path, *, banner: bool = True) -> str:
    if banner:
        print("ODS-EOS Add Investigation")
        print("=========================")
        print()

    title = read_required("Title: ")
    print()
    objective = read_multiline("Objective (what does this investigation seek to determine?)")
    while not objective:
        print("  (required — please describe the objective.)")
        objective = read_multiline("Objective (what does this investigation seek to determine?)")

    record = build_investigation_record(store, title=title, objective=objective)

    record_id = _append_record(
        store, collection="investigations", record=record, path=path
    )
    if banner:
        print()
        print(f"Investigation created: {record_id}")
    else:
        print(f"  Investigation created: {record_id}")
    return record_id


def capture_parking(store: dict, path: Path, *, banner: bool = True) -> str:
    if banner:
        print("ODS-EOS Add Parking Lot Item")
        print("============================")
        print()

    title = read_required("Title: ")
    print()
    reason_deferred = read_multiline("Reason deferred:")
    while not reason_deferred:
        print("  (required — please explain why this is deferred.)")
        reason_deferred = read_multiline("Reason deferred:")

    record = build_parking_record(
        store, title=title, reason_deferred=reason_deferred
    )

    record_id = _append_record(store, collection="parkingLot", record=record, path=path)
    if banner:
        print()
        print(f"Parking lot item created: {record_id}")
    else:
        print(f"  Parking lot item created: {record_id}")
    return record_id


def capture_risk(store: dict, path: Path, *, banner: bool = True) -> str:
    if banner:
        print("ODS-EOS Add Risk")
        print("================")
        print()

    description = read_multiline("What could go wrong?")
    while not description:
        print("  (required — please describe the risk.)")
        description = read_multiline("What could go wrong?")

    record = build_risk_record(store, description=description)

    record_id = _append_record(store, collection="risks", record=record, path=path)
    if banner:
        print()
        print(f"Risk created: {record_id}")
    else:
        print(f"  Risk created: {record_id}")
    return record_id


def run_add_decision(path: Path | None = None) -> None:
    store_path = path or get_store_path()
    store = load_store(store_path)
    capture_decision(store, store_path)


def run_add_investigation(path: Path | None = None) -> None:
    store_path = path or get_store_path()
    store = load_store(store_path)
    capture_investigation(store, store_path)


def run_add_parking(path: Path | None = None) -> None:
    store_path = path or get_store_path()
    store = load_store(store_path)
    capture_parking(store, store_path)


def run_add_risk(path: Path | None = None) -> None:
    store_path = path or get_store_path()
    store = load_store(store_path)
    capture_risk(store, store_path)


def run_add(record_type: str, path: Path | None = None) -> None:
    handlers = {
        "decision": run_add_decision,
        "investigation": run_add_investigation,
        "parking": run_add_parking,
        "risk": run_add_risk,
    }
    handler = handlers.get(record_type)
    if handler is None:
        raise AddError(f"Unknown record type: {record_type!r}")
    handler(path)
