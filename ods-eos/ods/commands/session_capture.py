"""Interactive session capture command."""

from pathlib import Path

from ods.commands.prompts import read_multiline, read_optional, read_required
from ods.commands.session import build_session_record
from ods.config import get_eod_dir, get_store_path
from ods.eos_pipeline import print_eos_pipeline_summary, run_eos_pipeline
from ods.generators.eod import write_eod
from ods.knowledge_store import load_store, save_store


class SessionCaptureError(Exception):
    """Session capture cannot complete without writing invalid store data."""


def run_session_capture(path: Path | None = None) -> None:
    """Run an interactive capture session and persist a closed Session container."""
    store_path = path or get_store_path()
    store = load_store(store_path)

    print("ODS-EOS Session Capture")
    print("=======================")
    print()
    print("Use 'work' for the full founder capture workflow with linked atomic records.")
    print()

    what_happened = read_multiline("1. What happened today?")
    while not what_happened:
        print("  (required — please describe what happened today.)")
        what_happened = read_multiline("1. What happened today?")

    print()
    decision = read_optional("2. Was a decision made? (optional) ")

    print()
    investigation = read_optional("3. Is there an open investigation? (optional) ")

    print()
    print("4. Any Parking Lot items? (optional)")
    print("  (Enter one item per line; blank line when finished.)")
    parking_lot: list[str] = []
    while True:
        line = input("  > ").strip()
        if not line:
            break
        parking_lot.append(line)

    print()
    risks = read_optional("5. Risks? (optional) ")

    print()
    tomorrow = read_required("6. Where should tomorrow begin? ")

    pending: list[str] = []
    if decision:
        pending.append("decision")
    if investigation:
        pending.append("investigation")
    if parking_lot:
        pending.append("parking lot")
    if risks:
        pending.append("risk")
    if pending:
        joined = ", ".join(pending)
        raise SessionCaptureError(
            "Atomic capture is not available in this command for: "
            f"{joined}. "
            "Use 'python3 cli.py work' instead."
        )

    session = build_session_record(
        store,
        what_happened=what_happened,
        planning_intent=tomorrow,
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
    print(f"Session captured: {session['id']}")
    eod_path = write_eod(store, session, get_eod_dir())
    print(f"  EOD report: {eod_path}")
    print_eos_pipeline_summary(run_eos_pipeline(eod_path=eod_path))
