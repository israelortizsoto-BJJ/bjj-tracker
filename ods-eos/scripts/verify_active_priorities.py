#!/usr/bin/env python3
"""Verify Priority Portfolio v0.2 Active Priorities."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.setup_operating_surface import load_env, notion

REQUIRED_PROMPTS = [
    "What is this?",
    "Current State:",
    "Why It Matters:",
    "Recommended Next Action:",
    "Business Impact:",
    "Health:",
]


def plain(block: dict) -> str:
    block_type = block.get("type")
    if not block_type:
        return ""
    data = block.get(block_type, {})
    return "".join(item.get("plain_text", "") for item in data.get("rich_text", []))


def main() -> int:
    env = load_env()
    token = env.get("NOTION_API_KEY", "")
    homepage_id = env.get("NOTION_PARENT_PAGE_ID", "")
    registry_id = env.get("NOTION_MISSION_REGISTRY_DATABASE_ID", "")
    if not token or not homepage_id or not registry_id:
        print("Missing NOTION_API_KEY, NOTION_PARENT_PAGE_ID, or NOTION_MISSION_REGISTRY_DATABASE_ID.", file=sys.stderr)
        return 2

    blocks = notion("GET", f"/blocks/{homepage_id}/children?page_size=100", token).get("results", [])
    h2 = [plain(block) for block in blocks if block.get("type") == "heading_2"]

    start = next(
        (idx for idx, block in enumerate(blocks) if block.get("type") == "heading_2" and plain(block) == "Active Priorities"),
        None,
    )
    end = len(blocks)
    if start is not None:
        for idx in range(start + 1, len(blocks)):
            if blocks[idx].get("type") == "heading_2":
                end = idx
                break
    section_blocks = blocks[start:end] if start is not None else []
    cards = [plain(block) for block in section_blocks if block.get("type") == "callout"]

    active_query = notion(
        "POST",
        f"/databases/{registry_id}/query",
        token,
        {"filter": {"property": "Status", "select": {"equals": "Active"}}, "page_size": 100},
        version="2022-06-28",
    )
    active_titles = [
        "".join(item.get("plain_text", "") for item in page.get("properties", {}).get("Mission", {}).get("title", []))
        for page in active_query.get("results", [])
    ]

    result = {
        "homepage_id": homepage_id,
        "h2_order": h2,
        "active_priorities_present": start is not None,
        "active_priorities_before_execution_context": _index(h2, "Active Priorities") < _index(h2, "Execution Context"),
        "top_priorities_removed": "Top Priorities" not in h2,
        "project_catalog_removed": "Projects" not in h2,
        "active_mission_titles": active_titles,
        "card_count": len(cards),
        "cards": cards,
        "all_active_priorities_visible": all(any(title in card for card in cards) for title in active_titles),
        "recommended_card_count": len([card for card in cards if card.startswith("Recommended")]),
        "cards_answer_six_questions": all(all(prompt in card for prompt in REQUIRED_PROMPTS) for card in cards),
        "old_five_question_copy_removed": all("What state is it in?" not in card and "What should happen next?" not in card for card in cards),
        "no_project_counts": all("active projects" not in card.lower() and "project count" not in card.lower() for card in cards),
    }
    result["qa_passed"] = all(
        [
            result["active_priorities_present"],
            result["active_priorities_before_execution_context"],
            result["top_priorities_removed"],
            result["project_catalog_removed"],
            result["card_count"] == len(active_titles),
            result["all_active_priorities_visible"],
            result["recommended_card_count"] <= 1,
            result["cards_answer_six_questions"],
            result["old_five_question_copy_removed"],
            result["no_project_counts"],
        ]
    )
    print(json.dumps(result, indent=2))
    return 0 if result["qa_passed"] else 1


def _index(items: list[str], value: str) -> int:
    try:
        return items.index(value)
    except ValueError:
        return -1


if __name__ == "__main__":
    raise SystemExit(main())
