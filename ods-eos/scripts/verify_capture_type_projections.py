#!/usr/bin/env python3
"""Verify every capture type completes the ODS-012 promotion projection pipeline."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ods.capture_queue import (  # noqa: E402
    CAPTURE_TYPES,
    append_capture,
    promotion_section_for_type,
    update_capture_status,
)
from ods.commands.promote import verify_promotion_surfaces  # noqa: E402
from ods.doctrine import (  # noqa: E402
    remove_decision_entry,
    remove_section_entry,
)
from ods.doctrine import promote_knowledge  # noqa: E402
from ods.commands.promote import (  # noqa: E402
    refresh_notion_homepage,
    regenerate_startup_artifacts,
)


def _promote_capture_type(capture_type: str) -> dict:
    text = f"ODS-013.1 projection test: {capture_type}."
    entry = append_capture(capture_type, text)
    section = promotion_section_for_type(capture_type)

    try:
        result = promote_knowledge(section, text)
        regenerate_startup_artifacts()
        refresh_notion_homepage()
        verification = verify_promotion_surfaces(section, text, require_notion=True)
        update_capture_status(entry["id"], "promoted")
        return {
            "type": capture_type,
            "queue": True,
            "doctrine": verification["doctrine"],
            "bootstrap": verification["bootstrap"],
            "active_slice": verification["execution_brief"],
            "notion": verification["notion"],
            "pass": verification["ok"],
            "missing": verification["missing"],
            "text": text,
            "section": section,
            "result": result,
        }
    except Exception as exc:
        return {
            "type": capture_type,
            "queue": True,
            "doctrine": False,
            "bootstrap": False,
            "active_slice": False,
            "notion": False,
            "pass": False,
            "missing": [str(exc)],
            "text": text,
            "section": section,
            "result": None,
        }


def _cleanup(result: dict) -> None:
    if result["result"] is None:
        return
    section = result["section"]
    text = result["text"]
    if result["result"].doctrine_updated:
        remove_section_entry(section, text)
    if result["result"].decision_register_updated:
        remove_decision_entry(section, text)
    regenerate_startup_artifacts()
    try:
        refresh_notion_homepage()
    except Exception:
        pass


def main() -> int:
    results = []
    failures = 0
    for capture_type in sorted(CAPTURE_TYPES):
        result = _promote_capture_type(capture_type)
        results.append(result)
        if not result["pass"]:
            failures += 1

    print("| Type | Queue | Doctrine | Bootstrap | Active Slice | Notion | PASS |")
    print("| ---- | :---: | :------: | :-------: | :----------: | :----: | :--: |")
    for result in results:
        mark = lambda ok: "✓" if ok else "✗"
        print(
            f"| {result['type']} "
            f"| {mark(result['queue'])} "
            f"| {mark(result['doctrine'])} "
            f"| {mark(result['bootstrap'])} "
            f"| {mark(result['active_slice'])} "
            f"| {mark(result['notion'])} "
            f"| {mark(result['pass'])} |"
        )

    if failures:
        print()
        print("Failures:")
        for result in results:
            if not result["pass"]:
                print(f"- {result['type']}: {', '.join(result['missing'])}")

    for result in results:
        _cleanup(result)

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
