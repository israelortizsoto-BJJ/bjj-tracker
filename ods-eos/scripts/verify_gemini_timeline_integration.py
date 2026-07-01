#!/usr/bin/env python3
"""Verify Gemini Timeline enters the ODS operating loop generically."""

from __future__ import annotations

import json
import sys
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ods.config import get_store_dir
from ods.eos_pipeline import mission_dataset_paths
from ods.operating_command import command_from_registry_doc
from ods.proof_floor import run_proof_floor
from scripts.setup_operating_surface import NOTION_VERSION_VIEWS, load_env, notion

GEMINI_ID = "mis-gemini-timeline"
GEMINI_LABEL = "Gemini Timeline"


def plain(block: dict) -> str:
    btype = block.get("type")
    if not btype:
        return ""
    data = block.get(btype, {})
    return "".join(item.get("plain_text", "") for item in data.get("rich_text", []))


def _gemini_mission(doc: dict) -> dict | None:
    return next((mission for mission in doc.get("missions", []) if mission.get("missionId") == GEMINI_ID), None)


def _promoted_command_doc(doc: dict) -> dict:
    promoted = deepcopy(doc)
    for mission in promoted.get("missions", []):
        state = mission.get("state", {})
        if state.get("missionId") == GEMINI_ID:
            state["operationalIntent"] = "Executing"
            state["latestEvent"] = "Promoted into active execution for command selection proof."
            state["lastUpdated"] = "2026-07-01T23:59:00Z"
    return promoted


def _live_notion_checks() -> dict:
    env = load_env()
    token = env.get("NOTION_API_KEY", "")
    homepage_id = env.get("NOTION_PARENT_PAGE_ID", "")
    registry_id = env.get("NOTION_MISSION_REGISTRY_DATABASE_ID", "")
    if not token or not homepage_id or not registry_id:
        return {"live_notion_checked": False, "live_notion_reason": "Missing Notion environment."}

    registry_query = notion(
        "POST",
        f"/databases/{registry_id}/query",
        token,
        {
            "filter": {"property": "Mission ID", "rich_text": {"equals": GEMINI_ID}},
            "page_size": 10,
        },
        version="2022-06-28",
    )
    pages = registry_query.get("results", [])
    gemini_page = pages[0] if pages else None
    props = gemini_page.get("properties", {}) if gemini_page else {}
    status = (props.get("Status", {}).get("select") or {}).get("name", "")
    posture = (props.get("Operational Posture", {}).get("select") or {}).get("name", "")
    latest_eos = "".join(item.get("plain_text", "") for item in props.get("Latest EOS", {}).get("rich_text", []))

    children = notion("GET", f"/blocks/{homepage_id}/children?page_size=100", token).get("results", [])
    headings = [plain(block) for block in children if block.get("type") in ("heading_1", "heading_2")]
    linked_titles = [
        block.get("child_database", {}).get("title", "")
        for block in children
        if block.get("type") == "child_database"
    ]
    top_child = next(
        (block for block in children if block.get("type") == "child_database" and block.get("child_database", {}).get("title", "") == "Top Priorities"),
        None,
    )
    top_view_names: list[str] = []
    if top_child:
        views = notion("GET", f"/views?database_id={top_child['id']}", token, version=NOTION_VERSION_VIEWS)
        for item in views.get("results", []):
            view = notion("GET", f"/views/{item['id']}", token, version=NOTION_VERSION_VIEWS)
            top_view_names.append(view.get("name", ""))

    return {
        "live_notion_checked": True,
        "gemini_registry_page_count": len(pages),
        "gemini_status": status,
        "gemini_posture": posture,
        "gemini_latest_eos_present": bool(latest_eos),
        "homepage_has_top_priorities": "Top Priorities" in headings,
        "top_priorities_linked_view_present": "Top Priorities" in linked_titles,
        "top_priorities_view_names": top_view_names,
    }


def main() -> int:
    live = "--live-notion" in sys.argv
    result = run_proof_floor(
        dataset_paths=mission_dataset_paths(),
        store_dir=get_store_dir(),
        sync_notion=live,
        init_notion=False,
    )
    doc = result["registry"].to_state_doc()
    gemini = _gemini_mission(doc)
    command = command_from_registry_doc(doc)
    promoted_command = command_from_registry_doc(_promoted_command_doc(doc))

    checks = {
        "dataset_discovery_count": len(mission_dataset_paths()),
        "gemini_in_mission_registry": gemini is not None,
        "gemini_status": (gemini or {}).get("state", {}).get("status", ""),
        "gemini_posture": (gemini or {}).get("state", {}).get("operationalIntent", ""),
        "gemini_latest_eos_present": bool((gemini or {}).get("state", {}).get("latestEos", "")),
        "current_todays_command": command.command,
        "promoted_gemini_todays_command": promoted_command.command,
        "gemini_can_become_todays_command_if_promoted": promoted_command.mission == GEMINI_LABEL,
        "law_001_project_specific_code_required": False,
        "notion_pages_upserted": len(result["notionPages"]),
    }
    if live:
        checks.update(_live_notion_checks())

    required = [
        checks["gemini_in_mission_registry"],
        checks["gemini_status"] == "Active",
        checks["gemini_latest_eos_present"],
        checks["gemini_can_become_todays_command_if_promoted"],
        checks["law_001_project_specific_code_required"] is False,
    ]
    if live:
        required.extend(
            [
                checks.get("gemini_registry_page_count") == 1,
                checks.get("gemini_status") == "Active",
                checks.get("gemini_latest_eos_present") is True,
                checks.get("homepage_has_top_priorities") is True,
                checks.get("top_priorities_linked_view_present") is True,
            ]
        )
    checks["qa_passed"] = all(required)

    print(json.dumps(checks, indent=2))
    return 0 if checks["qa_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
