#!/usr/bin/env python3
"""Deterministic Engineering Checkpoint writer (DOCOPS v2).

GPT supplies the structured engineering model.
Python validates, formats, writes, and verifies only.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
TARGET_DOC = REPO_ROOT / "docs" / "engineering-checkpoint.md"

PERMANENT_HEADER = """# MatMind Engineering Checkpoint Register

> Purpose:
>
> Short recoverable checkpoints for active engineering investigations.
> This is not an EOD document and not an architecture certification register.
>
> ChatGPT supplies the engineering model.
> Python writes and verifies this document.
"""

ALLOWED_STATUS = frozenset({"ACTIVE", "PAUSED", "COMPLETE"})
REQUIRED_FIELDS = (
    "date",
    "investigation",
    "status",
    "hypothesis",
    "latest_runtime_behavior",
    "next_experiment",
)
OPTIONAL_LIST_FIELDS = ("do_not", "notes")
ALLOWED_KEYS = frozenset(REQUIRED_FIELDS + OPTIONAL_LIST_FIELDS)

ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ENTRY_START_RE = re.compile(
    r"^# ENGINEERING CHECKPOINT — (\d{4}-\d{2}-\d{2})\s*$",
    re.MULTILINE,
)

REQUIRED_SECTION_ORDER = (
    "## Investigation",
    "## Status",
    "## Hypothesis",
    "## Latest Runtime Behavior",
    "## Next Experiment",
    "## Do Not",
    "## Notes",
    "## Repository State",
)


class ValidationError(Exception):
    """Input or document validation failed."""


def run_git(args: list[str]) -> str:
    return subprocess.check_output(
        ["git", *args],
        cwd=REPO_ROOT,
        text=True,
    ).rstrip("\n")


def capture_repo_snapshot() -> dict[str, str]:
    return {
        "status_sb": run_git(["status", "-sb"]),
        "log": run_git(["log", "--oneline", "--decorate", "-8"]),
        "diff_stat": run_git(["diff", "--stat"]),
    }


def _require_nonempty_string(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"Field '{field}' must be a non-empty string.")
    return value.strip()


def _require_string_list(value: Any, field: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValidationError(f"Field '{field}' must be a list of strings.")
    items: list[str] = []
    for index, item in enumerate(value):
        if not isinstance(item, str) or not item.strip():
            raise ValidationError(
                f"Field '{field}[{index}]' must be a non-empty string."
            )
        items.append(item.strip())
    return items


def validate_iso_date(value: str, field: str = "date") -> str:
    if not ISO_DATE_RE.match(value):
        raise ValidationError(f"Field '{field}' must be ISO YYYY-MM-DD.")
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise ValidationError(f"Field '{field}' is not a valid calendar date.") from exc
    return value


def validate_model(raw: Any, *, date_override: str | None = None) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValidationError("Input must be a JSON object.")

    unknown = sorted(set(raw.keys()) - ALLOWED_KEYS)
    if unknown:
        raise ValidationError(f"Unknown keys present: {', '.join(unknown)}")

    missing = [field for field in REQUIRED_FIELDS if field not in raw]
    if missing:
        raise ValidationError(f"Missing required fields: {', '.join(missing)}")

    date_value = date_override if date_override is not None else raw["date"]
    if not isinstance(date_value, str):
        raise ValidationError("Field 'date' must be a string.")
    date_value = validate_iso_date(date_value.strip())

    status = _require_nonempty_string(raw["status"], "status")
    if status not in ALLOWED_STATUS:
        raise ValidationError(
            "Field 'status' must be exactly one of ACTIVE, PAUSED, COMPLETE."
        )

    model = {
        "date": date_value,
        "investigation": _require_nonempty_string(raw["investigation"], "investigation"),
        "status": status,
        "hypothesis": _require_nonempty_string(raw["hypothesis"], "hypothesis"),
        "latest_runtime_behavior": _require_nonempty_string(
            raw["latest_runtime_behavior"], "latest_runtime_behavior"
        ),
        "next_experiment": _require_nonempty_string(
            raw["next_experiment"], "next_experiment"
        ),
        "do_not": _require_string_list(raw.get("do_not"), "do_not"),
        "notes": _require_string_list(raw.get("notes"), "notes"),
    }
    return model


def render_bullet_section(items: list[str]) -> str:
    if not items:
        return "None"
    return "\n".join(f"- {item}" for item in items)


def render_entry(model: dict[str, Any], snapshot: dict[str, str]) -> str:
    return (
        f"# ENGINEERING CHECKPOINT — {model['date']}\n"
        "\n"
        "## Investigation\n"
        "\n"
        f"{model['investigation']}\n"
        "\n"
        "## Status\n"
        "\n"
        f"{model['status']}\n"
        "\n"
        "## Hypothesis\n"
        "\n"
        f"{model['hypothesis']}\n"
        "\n"
        "## Latest Runtime Behavior\n"
        "\n"
        f"{model['latest_runtime_behavior']}\n"
        "\n"
        "## Next Experiment\n"
        "\n"
        f"{model['next_experiment']}\n"
        "\n"
        "## Do Not\n"
        "\n"
        f"{render_bullet_section(model['do_not'])}\n"
        "\n"
        "## Notes\n"
        "\n"
        f"{render_bullet_section(model['notes'])}\n"
        "\n"
        "## Repository State\n"
        "\n"
        "### git status -sb\n"
        "\n"
        "```text\n"
        f"{snapshot['status_sb']}\n"
        "```\n"
        "\n"
        "### git log --oneline --decorate -8\n"
        "\n"
        "```text\n"
        f"{snapshot['log']}\n"
        "```\n"
        "\n"
        "### git diff --stat\n"
        "\n"
        "```text\n"
        f"{snapshot['diff_stat']}\n"
        "```\n"
    )


def split_document(text: str) -> tuple[str, list[str]]:
    matches = list(ENTRY_START_RE.finditer(text))
    if not matches:
        return text.rstrip(), []

    header = text[: matches[0].start()].rstrip()
    entries: list[str] = []
    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        entries.append(text[start:end].rstrip())
    return header, entries


def entry_date(entry: str) -> str:
    match = ENTRY_START_RE.search(entry)
    if not match:
        raise ValidationError("Entry is missing an ENGINEERING CHECKPOINT date header.")
    return validate_iso_date(match.group(1), field="entry date")


def sort_entries_newest_first(entries: list[str]) -> list[str]:
    indexed = list(enumerate(entries))
    indexed.sort(
        key=lambda item: (entry_date(item[1]), -item[0]),
        reverse=True,
    )
    return [entry for _, entry in indexed]


def upsert_entry(entries: list[str], new_entry: str, *, date_value: str) -> list[str]:
    kept = [entry for entry in entries if entry_date(entry) != date_value]
    return [new_entry.rstrip(), *kept]


def assemble_document(header: str, entries: list[str]) -> str:
    parts: list[str] = []
    if header.strip():
        parts.append(header.rstrip())
    parts.extend(entry.rstrip() for entry in entries if entry.strip())
    return "\n\n".join(parts) + "\n"


def build_document(existing: str, model: dict[str, Any], snapshot: dict[str, str]) -> str:
    header, entries = split_document(existing) if existing.strip() else ("", [])
    if not header.strip():
        header = PERMANENT_HEADER.rstrip()
    elif header.rstrip() != PERMANENT_HEADER.rstrip():
        raise ValidationError(
            "Permanent header is present but does not match the required constant."
        )

    new_entry = render_entry(model, snapshot).rstrip()
    entries = upsert_entry(entries, new_entry, date_value=model["date"])
    entries = sort_entries_newest_first(entries)
    return assemble_document(header, entries)


def _section_body(entry: str, heading: str, next_heading: str | None) -> str:
    start = entry.find(heading)
    if start < 0:
        raise ValidationError(f"Missing section '{heading}'.")
    content_start = start + len(heading)
    if next_heading is None:
        return entry[content_start:].strip()
    end = entry.find(next_heading, content_start)
    if end < 0:
        raise ValidationError(f"Missing section '{next_heading}'.")
    return entry[content_start:end].strip()


def verify_entry(entry: str) -> str:
    date_value = entry_date(entry)
    expected_title = f"# ENGINEERING CHECKPOINT — {date_value}"
    if not entry.startswith(expected_title):
        raise ValidationError(f"Entry for {date_value} has an invalid title line.")

    positions: list[int] = []
    for heading in REQUIRED_SECTION_ORDER:
        pos = entry.find(heading)
        if pos < 0:
            raise ValidationError(
                f"Entry {date_value} is missing required section '{heading}'."
            )
        positions.append(pos)
    if positions != sorted(positions):
        raise ValidationError(
            f"Entry {date_value} does not have required sections in order."
        )

    for index, heading in enumerate(REQUIRED_SECTION_ORDER):
        next_heading = (
            REQUIRED_SECTION_ORDER[index + 1]
            if index + 1 < len(REQUIRED_SECTION_ORDER)
            else None
        )
        body = _section_body(entry, heading, next_heading)
        if heading in {
            "## Investigation",
            "## Status",
            "## Hypothesis",
            "## Latest Runtime Behavior",
            "## Next Experiment",
        }:
            if not body:
                raise ValidationError(
                    f"Entry {date_value} has empty section '{heading}'."
                )
        if heading == "## Status" and body not in ALLOWED_STATUS:
            raise ValidationError(
                f"Entry {date_value} has invalid status '{body}'."
            )
        if heading == "## Repository State":
            for sub in (
                "### git status -sb",
                "### git log --oneline --decorate -8",
                "### git diff --stat",
            ):
                if sub not in body:
                    raise ValidationError(
                        f"Entry {date_value} is missing repository subsection '{sub}'."
                    )
            if body.count("```text") != 3 or body.count("```") < 6:
                raise ValidationError(
                    f"Entry {date_value} has malformed repository text fences."
                )
    return date_value


def verify_document(content: str) -> None:
    if not content:
        raise ValidationError("Owned document is empty or missing.")
    if not content.endswith("\n"):
        raise ValidationError("Document must end with a trailing newline.")
    if content.endswith("\n\n"):
        raise ValidationError("Document must end with exactly one trailing newline.")

    header, entries = split_document(content)
    if header.rstrip() != PERMANENT_HEADER.rstrip():
        raise ValidationError("Permanent header is missing or has been altered.")

    if not entries:
        return

    dates: list[str] = []
    for entry in entries:
        dates.append(verify_entry(entry))

    if len(dates) != len(set(dates)):
        raise ValidationError("Document contains more than one entry for the same date.")

    if dates != sorted(dates, reverse=True):
        raise ValidationError("Entries are not ordered newest-first by date.")


def load_input(path: str) -> Any:
    if path == "-":
        return json.load(sys.stdin)
    input_path = Path(path)
    if not input_path.is_file():
        raise ValidationError(f"Input file not found: {path}")
    return json.loads(input_path.read_text(encoding="utf-8"))


def write_checkpoint(model: dict[str, Any]) -> None:
    existing = TARGET_DOC.read_text(encoding="utf-8") if TARGET_DOC.exists() else ""
    snapshot = capture_repo_snapshot()
    updated = build_document(existing, model, snapshot)
    verify_document(updated)
    TARGET_DOC.parent.mkdir(parents=True, exist_ok=True)
    TARGET_DOC.write_text(updated, encoding="utf-8")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Validate a GPT engineering model and write docs/engineering-checkpoint.md."
        )
    )
    parser.add_argument(
        "--input",
        dest="input_path",
        help="JSON model path, or '-' for stdin. Required for write.",
    )
    parser.add_argument(
        "--date",
        dest="date_override",
        help="Override model date (YYYY-MM-DD).",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Validate owned document; with --input, write then verify.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    try:
        if args.date_override is not None:
            validate_iso_date(args.date_override.strip(), field="--date")

        if args.input_path is None and not args.verify:
            raise ValidationError("Provide --input for write, or --verify alone.")

        if args.input_path is not None:
            raw = load_input(args.input_path)
            model = validate_model(raw, date_override=args.date_override)
            write_checkpoint(model)
            print(f"wrote {TARGET_DOC}")

        if args.verify:
            if not TARGET_DOC.exists():
                raise ValidationError(f"Owned document does not exist: {TARGET_DOC}")
            content = TARGET_DOC.read_text(encoding="utf-8")
            verify_document(content)
            print(f"verified {TARGET_DOC}")

        return 0
    except (ValidationError, json.JSONDecodeError, subprocess.CalledProcessError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
