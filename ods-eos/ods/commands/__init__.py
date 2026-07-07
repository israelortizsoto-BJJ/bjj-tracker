from pathlib import Path

from ods import __version__
from ods.commands.add import run_add
from ods.commands.capture import run_capture
from ods.commands.founder_capture import FounderCaptureError, run_promote_pending, run_review_captures
from ods.commands.session_capture import run_session_capture
from ods.commands.ingest import run_ingest
from ods.commands.promote import run_promote, run_verify_promotions
from ods.commands.proposal import run_proposal
from ods.commands.proof import run_proof
from ods.commands.today import run_today
from ods.commands.work import run_work
from ods.config import get_bootstrap_dir, get_eod_dir, get_morning_dir, get_store_dir, get_store_path
from ods.eos_pipeline import print_eos_pipeline_summary, run_eos_pipeline
from ods.generators.active_slice import ActiveSliceError, write_active_slice
from ods.generators.bootstrap import BootstrapError, load_registry_doc, write_operator_bootstrap
from ods.generators.eod import EodError, write_eod
from ods.generators.morning import write_morning
from ods.commands.prompts import utc_today
from ods.knowledge_store import empty_store, load_store, save_store
from ods.resolve import closed_sessions_sorted

COMMAND_HELP = {
    "init": "Initialize the knowledge store.",
    "work": "Run a linked founder capture work session.",
    "capture": "Queue a founder capture for later promotion.",
    "review-captures": "Review pending founder captures.",
    "promote-pending": "Walk through pending captures and promote approved items.",
    "session-capture": "Run an interactive session capture.",
    "add": "Add an atomic record (decision, investigation, parking, risk).",
    "ingest": "Ingest a canonical promotion payload JSON file.",
    "promote": "Promote operating doctrine into generated ODS knowledge.",
    "verify-promotions": "Verify promoted knowledge exists across generated surfaces.",
    "proposal": "Build a canonical promotion payload from structured operator input.",
    "morning": "Generate morning brief.",
    "today": "Show founder command center for today.",
    "eod": "Generate end-of-day report.",
    "bootstrap": "Generate operator bootstrap for fresh execution threads.",
    "active-slice": "Generate active implementation slice for fresh execution threads.",
    "proof": "Run Founder Proof Floor: missions → events → state → EOS → Notion.",
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


def run_eod(path: Path | None = None) -> None:
    store = load_store(path or get_store_path())
    sessions = closed_sessions_sorted(store)
    if not sessions:
        raise EodError("No closed sessions are available for EOS generation.")

    eod_path = write_eod(store, sessions[0], get_eod_dir())
    print(f"EOD report: {eod_path}")
    print_eos_pipeline_summary(run_eos_pipeline(eod_path=eod_path))


def run_bootstrap(path: Path | None = None) -> None:
    store = load_store(path or get_store_path())
    registry_doc = load_registry_doc(get_store_dir() / "mission-registry.json")
    output_path = write_operator_bootstrap(
        registry_doc=registry_doc,
        output_dir=get_bootstrap_dir(),
        store=store,
    )
    print(f"Operator bootstrap: {output_path}")


def run_active_slice(path: Path | None = None) -> None:
    load_store(path or get_store_path())
    registry_doc = load_registry_doc(get_store_dir() / "mission-registry.json")
    output_path = write_active_slice(
        registry_doc=registry_doc,
        output_dir=get_bootstrap_dir(),
        cwd=Path.cwd(),
    )
    print(f"Active slice: {output_path}")


def run_version() -> None:
    print(f"ODS-EOS {__version__}")


def run_command(
    command: str,
    *,
    record_type: str | None = None,
    payload_path: Path | None = None,
    proposal_input_path: Path | None = None,
    promote_section: str | None = None,
    promote_text: str | None = None,
    capture_type: str | None = None,
    capture_text: str | None = None,
    capture_project: str | None = None,
    init_notion: bool = False,
    dry_run: bool = False,
) -> int:
    if command == "init":
        run_init()
        return 0
    if command == "work":
        run_work()
        return 0
    if command == "capture":
        if capture_type is None or capture_text is None:
            print('Error: type and text required. Use: capture --type decision --text "..."')
            return 1
        run_capture(capture_type, capture_text, project=capture_project)
        return 0
    if command == "review-captures":
        run_review_captures()
        return 0
    if command == "promote-pending":
        run_promote_pending()
        return 0
    if command == "session-capture":
        run_session_capture()
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
    if command == "promote":
        if promote_section is None or promote_text is None:
            print("Error: section and text required. Use: promote --section always-read --text \"...\"")
            return 1
        run_promote(promote_section, promote_text)
        return 0
    if command == "verify-promotions":
        run_verify_promotions()
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
    if command == "eod":
        run_eod()
        return 0
    if command == "bootstrap":
        run_bootstrap()
        return 0
    if command == "active-slice":
        run_active_slice()
        return 0
    if command == "proof":
        run_proof(init_notion=init_notion, dry_run=dry_run)
        return 0
    if command == "validate":
        run_validate()
        return 0
    if command == "version":
        run_version()
        return 0

    print("Not yet implemented.")
    return 0
