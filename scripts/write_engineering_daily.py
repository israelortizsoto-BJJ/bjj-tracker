#!/usr/bin/env python3
"""Deterministic Engineering Daily writer (DOCOPS).

GPT supplies the structured daily model.
Python validates, formats, writes, and verifies only.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
TARGET_DOC = REPO_ROOT / "docs" / "engineering-daily.md"

PERMANENT_HEADER = """# MatMind Engineering Daily

> Concise append-only index of engineering days.
>
> Engineering Daily records outcomes, evidence movement, stop boundaries, and the next authorized mission. Detailed evidence remains in Checkpoint, Dev Handoff, investigations, and certification documents.

## Entry Contract

Each date appears once and contains:

1. Primary Objective
2. Repository Floor
3. Completed Outcomes
4. Evidence and Certification Movement
5. Stops and Remaining Unknowns
6. Protected and Unrelated Scopes
7. Next Authorized Mission

Corrections are appended as labeled amendments. Existing entries are never silently rewritten.

---
"""

REQUIRED_FIELDS = (
    "date",
    "primary_objective",
    "repository_floor",
    "completed_outcomes",
    "evidence_and_certification_movement",
    "stops_and_remaining_unknowns",
    "protected_and_unrelated_scopes",
    "next_authorized_mission",
)
OPTIONAL_FIELDS = ("amendment",)
ALLOWED_KEYS = frozenset(REQUIRED_FIELDS + OPTIONAL_FIELDS)

REQUIRED_SECTION_ORDER = (
    "### Primary Objective",
    "### Repository Floor",
    "### Completed Outcomes",
    "### Evidence and Certification Movement",
    "### Stops and Remaining Unknowns",
    "### Protected and Unrelated Scopes",
    "### Next Authorized Mission",
)

ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ENTRY_START_RE = re.compile(r"^## (\d{4}-\d{2}-\d{2})\s*$", re.MULTILINE)
AMENDMENT_START_RE = re.compile(r"^### Amendment — (.+)\s*$", re.MULTILINE)


class ValidationError(Exception):
    """Input or document validation failed."""


def _require_nonempty_string(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"Field '{field}' must be a non-empty string.")
    return value.strip()


def _require_string_list(value: Any, field: str) -> list[str]:
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


def validate_amendment(raw: Any) -> dict[str, str] | None:
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise ValidationError("Field 'amendment' must be an object or null.")
    allowed = {"authorized", "title", "body_markdown"}
    unknown = sorted(set(raw.keys()) - allowed)
    if unknown:
        raise ValidationError(f"Unknown amendment keys: {', '.join(unknown)}")
    if raw.get("authorized") is not True:
        raise ValidationError(
            "Field 'amendment.authorized' must be true to append an amendment."
        )
    return {
        "authorized": "true",
        "title": _require_nonempty_string(raw.get("title"), "amendment.title"),
        "body_markdown": _require_nonempty_string(
            raw.get("body_markdown"), "amendment.body_markdown"
        ),
    }


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

    return {
        "date": date_value,
        "primary_objective": _require_nonempty_string(
            raw["primary_objective"], "primary_objective"
        ),
        "repository_floor": _require_string_list(
            raw["repository_floor"], "repository_floor"
        ),
        "completed_outcomes": _require_string_list(
            raw["completed_outcomes"], "completed_outcomes"
        ),
        "evidence_and_certification_movement": _require_nonempty_string(
            raw["evidence_and_certification_movement"],
            "evidence_and_certification_movement",
        ),
        "stops_and_remaining_unknowns": _require_string_list(
            raw["stops_and_remaining_unknowns"], "stops_and_remaining_unknowns"
        ),
        "protected_and_unrelated_scopes": _require_string_list(
            raw["protected_and_unrelated_scopes"], "protected_and_unrelated_scopes"
        ),
        "next_authorized_mission": _require_nonempty_string(
            raw["next_authorized_mission"], "next_authorized_mission"
        ),
        "amendment": validate_amendment(raw.get("amendment")),
    }


def render_bullet_section(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items)


def render_entry(model: dict[str, Any]) -> str:
    parts = [
        f"## {model['date']}",
        "",
        "### Primary Objective",
        "",
        model["primary_objective"],
        "",
        "### Repository Floor",
        "",
        render_bullet_section(model["repository_floor"]),
        "",
        "### Completed Outcomes",
        "",
        render_bullet_section(model["completed_outcomes"]),
        "",
        "### Evidence and Certification Movement",
        "",
        model["evidence_and_certification_movement"],
        "",
        "### Stops and Remaining Unknowns",
        "",
        render_bullet_section(model["stops_and_remaining_unknowns"]),
        "",
        "### Protected and Unrelated Scopes",
        "",
        render_bullet_section(model["protected_and_unrelated_scopes"]),
        "",
        "### Next Authorized Mission",
        "",
        model["next_authorized_mission"],
    ]
    amendment = model.get("amendment")
    if amendment:
        parts.extend(
            [
                "",
                f"### Amendment — {amendment['title']}",
                "",
                amendment["body_markdown"].rstrip(),
            ]
        )
    return "\n".join(parts).rstrip() + "\n"


def render_amendment_block(amendment: dict[str, str]) -> str:
    return (
        f"### Amendment — {amendment['title']}\n"
        "\n"
        f"{amendment['body_markdown'].rstrip()}\n"
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
        raise ValidationError("Entry is missing an Engineering Daily date header.")
    return validate_iso_date(match.group(1), field="entry date")


def sort_entries_newest_first(entries: list[str]) -> list[str]:
    indexed = list(enumerate(entries))
    indexed.sort(
        key=lambda item: (entry_date(item[1]), -item[0]),
        reverse=True,
    )
    return [entry for _, entry in indexed]


def assemble_document(header: str, entries: list[str]) -> str:
    parts: list[str] = []
    if header.strip():
        parts.append(header.rstrip())
    parts.extend(entry.rstrip() for entry in entries if entry.strip())
    return "\n\n".join(parts) + "\n"


def find_entry_for_date(entries: list[str], date_value: str) -> str | None:
    for entry in entries:
        if entry_date(entry) == date_value:
            return entry
    return None


def amendment_titles(entry: str) -> list[str]:
    return [match.group(1).strip() for match in AMENDMENT_START_RE.finditer(entry)]


def append_amendment(entry: str, amendment: dict[str, str]) -> str:
    block = render_amendment_block(amendment).rstrip()
    if block in entry:
        return entry.rstrip() + "\n"
    title = amendment["title"]
    if title in amendment_titles(entry):
        raise ValidationError(
            f"Amendment title already exists for this date: {title}"
        )
    return entry.rstrip() + "\n\n" + block + "\n"


def build_document(existing: str, model: dict[str, Any]) -> str:
    header, entries = split_document(existing) if existing.strip() else ("", [])
    if not header.strip():
        header = PERMANENT_HEADER.rstrip()

    date_value = model["date"]
    existing_entry = find_entry_for_date(entries, date_value)
    new_entry = render_entry({**model, "amendment": None}).rstrip()
    amendment = model.get("amendment")

    if existing_entry is None:
        if amendment:
            new_entry = append_amendment(new_entry, amendment).rstrip()
        entries = [new_entry, *entries]
    else:
        base_without_amendments = re.split(
            r"\n### Amendment — ", existing_entry, maxsplit=1
        )[0].rstrip()
        proposed_base = new_entry.rstrip()

        if amendment:
            if base_without_amendments != proposed_base:
                # Amendments attach to the existing entry; base fields must match
                # unless the caller is only appending an amendment to current text.
                pass
            updated = append_amendment(existing_entry, amendment)
            entries = [
                updated.rstrip() if entry_date(entry) == date_value else entry
                for entry in entries
            ]
        else:
            if existing_entry.rstrip() == new_entry.rstrip():
                # Idempotent same-day rewrite with identical content.
                entries = [
                    new_entry if entry_date(entry) == date_value else entry
                    for entry in entries
                ]
            else:
                raise ValidationError(
                    f"Duplicate Engineering Daily entry for {date_value} would "
                    "overwrite differing content. Authorize a labeled amendment."
                )

    entries = sort_entries_newest_first(entries)
    return assemble_document(header, entries)


def _section_body(entry: str, heading: str, next_heading: str | None) -> str:
    start = entry.find(heading)
    if start < 0:
        raise ValidationError(f"Missing section '{heading}'.")
    content_start = start + len(heading)
    if next_heading is None:
        # Stop before first amendment if present.
        amend = AMENDMENT_START_RE.search(entry, content_start)
        if amend:
            return entry[content_start : amend.start()].strip()
        return entry[content_start:].strip()
    end = entry.find(next_heading, content_start)
    if end < 0:
        raise ValidationError(f"Missing section '{next_heading}'.")
    return entry[content_start:end].strip()


def verify_entry(entry: str) -> str:
    date_value = entry_date(entry)
    expected_title = f"## {date_value}"
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
        if not body:
            raise ValidationError(f"Entry {date_value} has empty section '{heading}'.")
    return date_value


def verify_document(content: str) -> None:
    if not content:
        raise ValidationError("Owned document is empty or missing.")
    if not content.endswith("\n"):
        raise ValidationError("Document must end with a trailing newline.")
    if content.endswith("\n\n"):
        raise ValidationError("Document must end with exactly one trailing newline.")

    _, entries = split_document(content)
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


def proposed_document(model: dict[str, Any], *, existing: str | None = None) -> str:
    current = (
        existing
        if existing is not None
        else (TARGET_DOC.read_text(encoding="utf-8") if TARGET_DOC.exists() else "")
    )
    updated = build_document(current, model)
    verify_document(updated)
    return updated


def write_daily(model: dict[str, Any]) -> str:
    existing = TARGET_DOC.read_text(encoding="utf-8") if TARGET_DOC.exists() else ""
    updated = proposed_document(model, existing=existing)
    TARGET_DOC.parent.mkdir(parents=True, exist_ok=True)
    TARGET_DOC.write_text(updated, encoding="utf-8")
    return updated


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate a GPT daily model and write docs/engineering-daily.md."
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
        "--preview",
        action="store_true",
        help="Render and verify proposed document without writing.",
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
            raise ValidationError("Provide --input for write/preview, or --verify alone.")

        if args.input_path is not None:
            raw = load_input(args.input_path)
            model = validate_model(raw, date_override=args.date_override)
            if args.preview:
                updated = proposed_document(model)
                print(updated)
                print(f"preview ok for {TARGET_DOC}", file=sys.stderr)
            else:
                write_daily(model)
                print(f"wrote {TARGET_DOC}")

        if args.verify:
            if not TARGET_DOC.exists():
                raise ValidationError(f"Owned document does not exist: {TARGET_DOC}")
            content = TARGET_DOC.read_text(encoding="utf-8")
            verify_document(content)
            print(f"verified {TARGET_DOC}")

        return 0
    except (ValidationError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
