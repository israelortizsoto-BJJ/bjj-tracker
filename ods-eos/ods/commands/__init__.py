from pathlib import Path

from ods import __version__
from ods.commands.add import run_add
from ods.commands.capture import run_capture
from ods.commands.ingest import run_ingest
from ods.commands.proposal import run_proposal
from ods.commands.today import run_today
from ods.commands.work import run_work
from ods.config import get_morning_dir, get_store_path
from ods.generators.morning import write_morning
from ods.commands.prompts import utc_today
from ods.knowledge_store import empty_store, load_store, save_store

COMMAND_HELP = {
    "init": "Initialize the knowledge store.",
    "work": "Run a linked founder capture work session.",
    "capture": "Run an interactive session capture.",
    "add": "Add an atomic record (decision, investigation, parking, risk).",
    "ingest": "Ingest a canonical promotion payload JSON file.",
    "proposal": "Build a canonical promotion payload from structured operator input.",
    "morning": "Generate morning brief.",
    "today": "Show founder command center for today.",
    "eod": "Generate end-of-day report.",
    "validate": "Verify knowledge store and report status.",
    "version": "Report the ODS-EOS version.",
}

ADD_RECORD_TYPES = ("decision", "investigation", "parking", "risk")


def run_init(path: Path | None = None) -> None:
    store_path = path or get_store_path()

    if store_path.exists():
        print("Knowledge store already initialized.")
        return

    save_store(store_path, empty_store())
    load_store(store_path)
    print("Knowledge store initialized.")


COLLECTION_LABELS = (
    ("sessions", "Sessions"),
    ("investigations", "Investigations"),
    ("boundaries", "Boundaries"),
    ("qaRuns", "QA Runs"),
    ("decisions", "Decisions"),
    ("parkingLot", "Parking Lot"),
    ("doctrines", "Doctrines"),
    ("insights", "Insights"),
    ("risks", "Risks"),
)


def run_validate(path: Path | None = None) -> None:
    store = load_store(path or get_store_path())

    print("Knowledge store is valid.")
    print()
    print(f"Schema Version: {store['schemaVersion']}")
    print()
    print("Records")
    print()
    for key, label in COLLECTION_LABELS:
        print(f"{label}: {len(store[key])}")


def run_morning(path: Path | None = None) -> None:
    store = load_store(path or get_store_path())
    report_date = utc_today()
    output_path = write_morning(store, get_morning_dir(), report_date)
    print(f"Morning brief: {output_path}")


def run_version() -> None:
    print(f"ODS-EOS {__version__}")


def run_command(
    command: str,
    *,
    record_type: str | None = None,
    payload_path: Path | None = None,
    proposal_input_path: Path | None = None,
) -> int:
    if command == "init":
        run_init()
        return 0
    if command == "work":
        run_work()
        return 0
    if command == "capture":
        run_capture()
        return 0
    if command == "add":
        if record_type is None:
            print("Error: record type required. Use: add decision|investigation|parking|risk")
            return 1
        run_add(record_type)
        return 0
    if command == "ingest":
        if payload_path is None:
            print("Error: payload file required. Use: ingest payload.json")
            return 1
        run_ingest(payload_path)
        return 0
    if command == "proposal":
        if proposal_input_path is None:
            print("Error: input file required. Use: proposal examples/work-session.yaml")
            return 1
        run_proposal(proposal_input_path)
        return 0
    if command == "morning":
        run_morning()
        return 0
    if command == "today":
        run_today()
        return 0
    if command == "validate":
        run_validate()
        return 0
    if command == "version":
        run_version()
        return 0

    print("Not yet implemented.")
    return 0
