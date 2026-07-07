#!/usr/bin/env python3
"""Verify Execution Context v0.2 homepage placement."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.setup_operating_surface import load_env, notion

EXPECTED_H3 = [
    "Always Read",
    "Sometimes Read",
    "Reference Only",
]

EXPECTED_TOGGLES = [
    "Operating Principles",
    "Engineering Doctrine",
    "Founder / Operator Doctrine",
    "Communication Doctrine",
    "Protected Systems",
    "Current Architecture Floors",
    "Decision Register",
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
    if not token or not homepage_id:
        print("Missing NOTION_API_KEY or NOTION_PARENT_PAGE_ID.", file=sys.stderr)
        return 2

    blocks = notion("GET", f"/blocks/{homepage_id}/children?page_size=100", token).get("results", [])
    h2 = [plain(block) for block in blocks if block.get("type") == "heading_2"]

    context_start = next(
        (idx for idx, block in enumerate(blocks) if block.get("type") == "heading_2" and plain(block) == "Execution Context"),
        None,
    )
    context_end = len(blocks)
    if context_start is not None:
        for idx in range(context_start + 1, len(blocks)):
            if blocks[idx].get("type") == "heading_2":
                context_end = idx
                break

    context_blocks = blocks[context_start:context_end] if context_start is not None else []
    context_h3 = [plain(block) for block in context_blocks if block.get("type") == "heading_3"]
    checklist_items = [plain(block) for block in context_blocks if block.get("type") == "to_do"]
    toggles = [plain(block) for block in context_blocks if block.get("type") == "toggle"]

    result = {
        "homepage_id": homepage_id,
        "h2_order": h2,
        "execution_context_present": context_start is not None,
        "active_priorities_before_execution_context": _index(h2, "Active Priorities") < _index(h2, "Execution Context"),
        "execution_context_before_projects": _index(h2, "Execution Context") < min(
            idx for idx in (_index(h2, "Carry Forward"), _index(h2, "Yesterday's Recap"), _index(h2, "Latest Change"), _index(h2, "Closed Loop")) if idx >= 0
        ),
        "expected_h3": EXPECTED_H3,
        "context_h3": context_h3,
        "expected_h3_order": context_h3[: len(EXPECTED_H3)] == EXPECTED_H3,
        "checklist_count": len(checklist_items),
        "checklist_items": checklist_items,
        "expected_toggles": EXPECTED_TOGGLES,
        "toggle_titles": toggles,
        "reference_material_collapsed": all(title in toggles for title in EXPECTED_TOGGLES),
        "visible_h3_count": len(context_h3),
    }
    result["qa_passed"] = all(
        [
            result["execution_context_present"],
            result["active_priorities_before_execution_context"],
            result["execution_context_before_projects"],
            result["expected_h3_order"],
            result["checklist_count"] == 5,
            result["reference_material_collapsed"],
            result["visible_h3_count"] == 3,
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
