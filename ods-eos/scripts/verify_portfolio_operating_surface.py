#!/usr/bin/env python3
"""Verify Founder Proof Floor v0.6 Portfolio Operating Surface."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.setup_operating_surface import NOTION_VERSION_VIEWS, load_env, notion


def plain(block: dict) -> str:
    btype = block.get("type")
    if not btype:
        return ""
    data = block.get(btype, {})
    return "".join(item.get("plain_text", "") for item in data.get("rich_text", []))


def main() -> int:
    env = load_env()
    token = env.get("NOTION_API_KEY", "")
    homepage_id = env.get("NOTION_PARENT_PAGE_ID", "")
    registry_id = env.get("NOTION_MISSION_REGISTRY_DATABASE_ID", "")
    if not token or not homepage_id or not registry_id:
        print("Missing NOTION_API_KEY, NOTION_PARENT_PAGE_ID, or NOTION_MISSION_REGISTRY_DATABASE_ID.", file=sys.stderr)
        return 2

    children = notion("GET", f"/blocks/{homepage_id}/children?page_size=100", token).get("results", [])
    headings = [plain(block) for block in children if block.get("type") in ("heading_1", "heading_2")]
    linked_titles = [
        block.get("child_database", {}).get("title", "")
        for block in children
        if block.get("type") == "child_database"
    ]
    callouts = [plain(block) for block in children if block.get("type") == "callout"]

    top_idx = next(
        (idx for idx, block in enumerate(children) if block.get("type") == "heading_2" and plain(block) == "Top Priorities"),
        None,
    )
    top_section: list[dict] = []
    if top_idx is not None:
        for block in children[top_idx + 1 :]:
            if block.get("type") == "heading_2":
                break
            top_section.append(block)

    top_child = next((block for block in top_section if block.get("type") == "child_database"), None)
    recommended = next((plain(block) for block in top_section if block.get("type") == "callout" and "Recommended" in plain(block)), "")
    future_affordance = next((plain(block) for block in top_section if "+ New Priority" in plain(block)), "")

    view_names: list[str] = []
    if top_child:
        views = notion("GET", f"/views?database_id={top_child['id']}", token, version=NOTION_VERSION_VIEWS)
        for item in views.get("results", []):
            view = notion("GET", f"/views/{item['id']}", token, version=NOTION_VERSION_VIEWS)
            view_names.append(view.get("name", ""))

    active_query = notion(
        "POST",
        f"/databases/{registry_id}/query",
        token,
        {"filter": {"property": "Status", "select": {"equals": "Active"}}, "page_size": 100},
        version="2022-06-28",
    )
    active_count = len(active_query.get("results", []))

    result = {
        "homepage_id": homepage_id,
        "headings": headings,
        "linked_view_titles": linked_titles,
        "top_priorities_present": "Top Priorities" in headings,
        "next_execution_removed": "Next Execution" not in headings and "Next Execution" not in linked_titles,
        "top_priorities_linked_view_present": "Top Priorities" in linked_titles,
        "recommended_indicator_present": bool(recommended),
        "recommended_indicator_text": recommended,
        "future_affordance_present": bool(future_affordance),
        "top_priorities_view_names": view_names,
        "active_mission_count": active_count,
        "command_callout_count": len([text for text in callouts if "Best Next Move" in text]),
    }
    result["qa_passed"] = all(
        [
            result["top_priorities_present"],
            result["next_execution_removed"],
            result["top_priorities_linked_view_present"],
            result["recommended_indicator_present"],
            result["future_affordance_present"],
            result["command_callout_count"] == 1,
        ]
    )

    print(json.dumps(result, indent=2))
    return 0 if result["qa_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
