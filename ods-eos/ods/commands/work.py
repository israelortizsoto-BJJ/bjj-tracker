"""Founder capture workflow — one engineering work session end-to-end."""

from pathlib import Path

from ods.commands.add import (
    capture_decision,
    capture_investigation,
    capture_parking,
    capture_risk,
)
from ods.commands.prompts import read_multiline, read_required, read_yes_no
from ods.commands.session import build_session_record
from ods.config import get_eod_dir, get_store_path
from ods.eos_pipeline import print_eos_pipeline_summary, run_eos_pipeline
from ods.generators.eod import write_eod
from ods.knowledge_store import load_store, save_store


class WorkError(Exception):
    """Work session cannot complete without writing invalid store data."""


def _capture_optional_records(
    store: dict,
    path: Path,
    *,
    prompt: str,
    capture,
) -> list[str]:
    record_ids: list[str] = []
    if not read_yes_no(prompt):
        return record_ids

    print()
    while True:
        record_ids.append(capture(store, path, banner=False))
        print()
        if not read_yes_no("  Add another? (y/n): "):
            break
        print()
    return record_ids


def run_work(path: Path | None = None) -> None:
    """Guide the operator through one linked engineering work session."""
    store_path = path or get_store_path()
    store = load_store(store_path)

    print("ODS-EOS Work Session")
    print("====================")
    print()

    what_happened = read_multiline("What happened today?")
    while not what_happened:
        print("  (required — please describe what happened today.)")
        what_happened = read_multiline("What happened today?")

    print()
    decision_ids: list[str] = []
    if read_yes_no("Was a decision made? (y/n): "):
        print()
        decision_ids.append(capture_decision(store, store_path, banner=False))
        print()

    investigation_ids = _capture_optional_records(
        store,
        store_path,
        prompt="Any investigations? (y/n): ",
        capture=capture_investigation,
    )

    parking_lot_ids = _capture_optional_records(
        store,
        store_path,
        prompt="Any parking lot items? (y/n): ",
        capture=capture_parking,
    )

    risk_ids = _capture_optional_records(
        store,
        store_path,
        prompt="Any risks? (y/n): ",
        capture=capture_risk,
    )

    print()
    planning_intent = read_required("Where should tomorrow begin? ")

    session = build_session_record(
        store,
        what_happened=what_happened,
        planning_intent=planning_intent,
        decision_ids=decision_ids,
        investigation_ids=investigation_ids,
        parking_lot_ids=parking_lot_ids,
        risk_ids=risk_ids,
    )

    if "\n" in what_happened.strip():
        print()
        print(
            "Note: only the first line of today's activity is stored as the "
            "session focus label."
        )

    store["sessions"].append(session)
    save_store(store_path, store)

    print()
    print(f"Work session complete: {session['id']}")
    if decision_ids:
        print(f"  Decisions: {', '.join(decision_ids)}")
    if investigation_ids:
        print(f"  Investigations: {', '.join(investigation_ids)}")
    if parking_lot_ids:
        print(f"  Parking lot: {', '.join(parking_lot_ids)}")
    if risk_ids:
        print(f"  Risks: {', '.join(risk_ids)}")

    eod_path = write_eod(store, session, get_eod_dir())
    print(f"  EOD report: {eod_path}")
    print_eos_pipeline_summary(run_eos_pipeline(eod_path=eod_path))
