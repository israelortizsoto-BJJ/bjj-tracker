"""ODS Law #001: EOS is the single founder interaction."""

from __future__ import annotations

from pathlib import Path

from ods.config import get_bootstrap_dir, get_datasets_dir, get_store_dir, get_store_path, get_yesterday_path
from ods.generators.active_slice import write_active_slice
from ods.generators.bootstrap import write_operator_bootstrap
from ods.generators.yesterday import write_yesterday
from ods.knowledge_store import load_store
from ods.operating_command import command_from_registry_doc
from ods.proof_floor import run_proof_floor


class EosPipelineError(Exception):
    """Post-EOS automation failed."""


def mission_dataset_paths() -> list[Path]:
    """Discover mission datasets without project-specific registration."""
    datasets_dir = get_datasets_dir()
    paths = sorted(path for path in datasets_dir.glob("*.json") if path.is_file())
    if not paths:
        raise EosPipelineError(f"No mission datasets found in {datasets_dir}.")
    return paths


def run_eos_pipeline(*, eod_path: Path | None = None, sync_notion: bool = True) -> dict:
    """Run every downstream projection after EOS.

    This is orchestration only. It does not modify the event model, Mission
    State, Notion schema, or projection architecture.
    """
    result = run_proof_floor(
        dataset_paths=mission_dataset_paths(),
        store_dir=get_store_dir(),
        sync_notion=sync_notion,
        init_notion=False,
    )
    registry_doc = result["registry"].to_state_doc()
    command = command_from_registry_doc(registry_doc)
    bootstrap_path = write_operator_bootstrap(
        registry_doc=registry_doc,
        output_dir=get_bootstrap_dir(),
        store=load_store(get_store_path()),
    )
    active_slice_path = write_active_slice(
        registry_doc=registry_doc,
        output_dir=get_bootstrap_dir(),
        cwd=Path.cwd(),
    )
    yesterday_path = write_yesterday(
        registry_doc=registry_doc,
        store=load_store(get_store_path()),
        command=command,
        output_dir=get_bootstrap_dir(),
        eod_path=eod_path,
        events_path=get_store_dir() / "events.json",
    )
    homepage_refreshed = False

    if sync_notion:
        command = refresh_homepage_command()
        homepage_refreshed = True

    return {
        "eodPath": str(eod_path) if eod_path else None,
        "eventsPath": result["eventsPath"],
        "statePath": result["statePath"],
        "eosDir": result["eosDir"],
        "notionPages": result["notionPages"],
        "homepageRefreshed": homepage_refreshed,
        "todaysCommand": command,
        "bootstrapPath": str(bootstrap_path),
        "activeSlicePath": str(active_slice_path),
        "yesterdayPath": str(yesterday_path),
    }


def refresh_homepage_command():
    try:
        from scripts.setup_operating_surface import load_env, refresh_todays_command

        env = load_env()
        token = env.get("NOTION_API_KEY", "")
        parent_page_id = env.get("NOTION_PARENT_PAGE_ID", "")
        if not token or not parent_page_id:
            raise EosPipelineError("Missing NOTION_API_KEY or NOTION_PARENT_PAGE_ID for homepage refresh.")
        return refresh_todays_command(token, parent_page_id)
    except EosPipelineError:
        raise
    except Exception as exc:  # pragma: no cover - external Notion boundary
        raise EosPipelineError(f"Could not refresh Today's Command: {exc}") from exc


def print_eos_pipeline_summary(summary: dict) -> None:
    command = summary["todaysCommand"]
    print()
    print("ODS Law #001 automation complete.")
    print(f"  Mission Registry: {summary['statePath']}")
    print(f"  Mission EOS: {summary['eosDir']}")
    print(f"  Operator Bootstrap: {summary['bootstrapPath']}")
    print(f"  Active Slice: {summary['activeSlicePath']}")
    print(f"  Yesterday Recap: {summary['yesterdayPath']}")
    if summary["notionPages"]:
        print(f"  Notion registry pages updated: {len(summary['notionPages'])}")
    if summary["homepageRefreshed"]:
        print("  Homepage refreshed: Today's Command")
    print(f"  Today's Command: {command.command}")
    print(f"  Best Next Move: {command.best_next_move}")
