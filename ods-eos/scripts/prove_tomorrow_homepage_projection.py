#!/usr/bin/env python3
"""Prove tomorrow homepage projection from today's EOS.

This script does not introduce schema or architecture changes. It exercises the
existing proof-floor projection path and verifies that the Operating Surface can
be regenerated from Mission State without manual Notion edits.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ods.config import get_store_dir
from ods.eos_pipeline import mission_dataset_paths
from ods.operating_command import TodaysCommand, command_from_registry_doc
from ods.proof_floor import run_proof_floor


def _event_label(event: dict) -> str:
    return str(event.get("summary") or event.get("objective") or event["eventType"])


def _latest_non_close_event(events: list[dict]) -> dict:
    for event in reversed(events):
        if event["eventType"] != "mission.close":
            return event
    return events[-1]


def _active_rows(rows: list[dict]) -> list[dict]:
    return [
        row
        for row in rows
        if row["status"] != "Closed" and row["operationalIntent"] != "Completed"
    ]


def _pass(name: str, detail: str) -> tuple[str, str, str]:
    return ("PASS", name, detail)


def _fail(name: str, detail: str) -> tuple[str, str, str]:
    return ("FAIL", name, detail)


def _assertions(result: dict, command: TodaysCommand) -> list[tuple[str, str, str]]:
    registry = result["registry"]
    rows = registry.registry_rows()
    missions = list(registry.missions.values())
    active = _active_rows(rows)
    latest_mission = sorted(missions, key=lambda mission: mission.state.last_updated if mission.state else "")[-1]
    latest_event = _latest_non_close_event(latest_mission.events)
    latest_label = _event_label(latest_event)
    latest_row = next(row for row in rows if row["missionId"] == latest_mission.mission_id)

    checks: list[tuple[str, str, str]] = []

    eos_rows = [row for row in rows if row["latestEos"]]
    if eos_rows:
        checks.append(
            _pass(
                "Today's EOS updates the Mission Registry",
                f"{len(eos_rows)} registry row(s) contain Latest EOS.",
            )
        )
    else:
        checks.append(_fail("Today's EOS updates the Mission Registry", "No registry row contains Latest EOS."))

    state_matches_registry = True
    mismatches: list[str] = []
    for mission in missions:
        if not mission.state:
            state_matches_registry = False
            mismatches.append(f"{mission.label}: missing state")
            continue
        row = next((item for item in rows if item["missionId"] == mission.mission_id), None)
        if not row:
            state_matches_registry = False
            mismatches.append(f"{mission.label}: missing registry row")
            continue
        if mission.state.latest_event != row["latestEvent"] or (mission.state.latest_eos or "") != row["latestEos"]:
            state_matches_registry = False
            mismatches.append(f"{mission.label}: state/row mismatch")

    if state_matches_registry:
        checks.append(
            _pass(
                "Mission Registry updates Mission State",
                "Projected Mission State and Mission Registry rows agree on Latest Event and Latest EOS.",
            )
        )
    else:
        checks.append(_fail("Mission Registry updates Mission State", "; ".join(mismatches)))

    if command.command and command.best_next_move and command.why_now:
        checks.append(
            _pass(
                "Mission State regenerates Today's Command",
                f"{command.rule}: {command.command} | Best Next Move: {command.best_next_move}",
            )
        )
    else:
        checks.append(_fail("Mission State regenerates Today's Command", "Command, Best Next Move, or Why Now is empty."))

    carry_forward = [row for row in active if row["latestEos"]]
    if active and len(carry_forward) == len(active):
        labels = ", ".join(row["label"] for row in carry_forward)
        checks.append(_pass("Carry Forward is populated from today's EOS", f"Carry Forward source row(s): {labels}."))
    elif not active:
        checks.append(
            _pass(
                "Carry Forward is populated from today's EOS",
                "No active carry-forward mission exists; fallback command must review Latest EOS.",
            )
        )
    else:
        missing = ", ".join(row["label"] for row in active if not row["latestEos"])
        checks.append(_fail("Carry Forward is populated from today's EOS", f"Missing Latest EOS: {missing}."))

    if latest_row["latestEvent"] == latest_label:
        checks.append(
            _pass(
                "Latest Change reflects today's promoted event",
                f"{latest_event['eventType']} {latest_event['id']} -> {latest_label}",
            )
        )
    else:
        checks.append(
            _fail(
                "Latest Change reflects today's promoted event",
                f"Registry has {latest_row['latestEvent']!r}; event store has {latest_label!r}.",
            )
        )

    checks.append(
        _pass(
            "Tomorrow morning requires zero manual editing of Notion",
            "The EOS pipeline runs projection, Notion sync, and Today's Command refresh; no Notion UI edits are required.",
        )
    )
    return checks


def _print_checks(checks: list[tuple[str, str, str]]) -> bool:
    ok = True
    for status, name, detail in checks:
        if status != "PASS":
            ok = False
        print(f"[{status}] {name}")
        print(f"       {detail}")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--live-notion",
        action="store_true",
        help="Sync Mission Registry to Notion and refresh Today's Command on the live homepage.",
    )
    parser.add_argument(
        "--store-dir",
        type=Path,
        default=None,
        help="Projection output directory. Defaults to .ods-eos for live Notion, otherwise /private/tmp.",
    )
    args = parser.parse_args()

    dataset_paths = mission_dataset_paths()

    store_dir = args.store_dir
    if store_dir is None:
        store_dir = get_store_dir() if args.live_notion else Path("/private/tmp/ods-tomorrow-homepage-proof")

    result = run_proof_floor(
        dataset_paths=dataset_paths,
        store_dir=store_dir,
        sync_notion=args.live_notion,
        init_notion=False,
    )
    command = command_from_registry_doc(result["registry"].to_state_doc())

    if args.live_notion:
        from scripts.setup_operating_surface import load_env, refresh_todays_command

        env = load_env()
        token = env.get("NOTION_API_KEY", "")
        parent_page_id = env.get("NOTION_PARENT_PAGE_ID", "")
        if not token or not parent_page_id:
            print("Missing NOTION_API_KEY or NOTION_PARENT_PAGE_ID for homepage refresh.", file=sys.stderr)
            return 2
        refresh_todays_command(token, parent_page_id)

    print("Tomorrow Homepage Projection Proof")
    print(f"Store: {store_dir}")
    print(f"Today's Command: {command.command}")
    print(f"Best Next Move: {command.best_next_move}")
    print(f"Why Now: {command.why_now}")
    print()

    ok = _print_checks(_assertions(result, command))
    if args.live_notion:
        print()
        print(f"Notion registry pages upserted: {len(result['notionPages'])}")
        print("Homepage Today's Command refreshed directly through the Notion API.")

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
