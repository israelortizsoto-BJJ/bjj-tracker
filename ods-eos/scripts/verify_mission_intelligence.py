#!/usr/bin/env python3
"""Verify Mission Intelligence v0.2 Notion rendering."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.setup_operating_surface import load_env, notion

EXPECTED_H2 = [
    "Mission Intelligence",
    "Mission Summary",
    "Current Status",
    "Executive Brief",
    "Recent Progress",
    "Key Decisions",
    "QA Evidence",
    "Immediate Next Action",
    "Risks",
    "Engineering Evidence",
]


def plain(block: dict) -> str:
    btype = block.get("type")
    if not btype:
        return ""
    data = block.get(btype, {})
    return "".join(item.get("plain_text", "") for item in data.get("rich_text", []))


def page_title(page: dict) -> str:
    prop = page.get("properties", {}).get("Mission", {})
    return "".join(item.get("plain_text", "") for item in prop.get("title", []))


def main() -> int:
    env = load_env()
    token = env.get("NOTION_API_KEY", "")
    registry_id = env.get("NOTION_MISSION_REGISTRY_DATABASE_ID", "")
    if not token or not registry_id:
        print("Missing NOTION_API_KEY or NOTION_MISSION_REGISTRY_DATABASE_ID.", file=sys.stderr)
        return 2

    query = notion(
        "POST",
        f"/databases/{registry_id}/query",
        token,
        {"page_size": 100},
        version="2022-06-28",
    )
    pages = []
    for page in query.get("results", []):
        children = notion("GET", f"/blocks/{page['id']}/children?page_size=100", token).get("results", [])
        h2 = [plain(block) for block in children if block.get("type") == "heading_2"]
        callouts = [plain(block) for block in children if block.get("type") == "callout"]
        toggles = [plain(block) for block in children if block.get("type") == "toggle"]
        pages.append(
            {
                "title": page_title(page),
                "page_id": page["id"],
                "h2": h2,
                "expected_order": h2[: len(EXPECTED_H2)] == EXPECTED_H2,
                "old_database_layout_removed": "Objective" not in h2 and "Latest Signal" not in h2,
                "immediate_next_action_present": any(text.strip() for text in callouts),
                "engineering_evidence_collapsed": "Engineering Evidence" in h2 and any(text.startswith("Latest EOS") for text in toggles),
                "system_details_available": "System Details" in toggles,
            }
        )

    result = {
        "mission_page_count": len(pages),
        "expected_h2_order": EXPECTED_H2,
        "pages": pages,
    }
    result["qa_passed"] = bool(pages) and all(
        page["expected_order"]
        and page["old_database_layout_removed"]
        and page["immediate_next_action_present"]
        and page["engineering_evidence_collapsed"]
        and page["system_details_available"]
        for page in pages
    )
    print(json.dumps(result, indent=2))
    return 0 if result["qa_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
