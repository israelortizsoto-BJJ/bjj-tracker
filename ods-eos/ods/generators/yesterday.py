"""Deterministic daily operational recap — structured replay, not summarization."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from ods.capture_queue import load_queue
from ods.doctrine import load_decision_entries
from ods.event_types import DECISION_PROMOTED, WORK_PROGRESS, WORK_STARTED
from ods.operating_command import TodaysCommand
from ods.resolve import closed_sessions_sorted, open_records

COMPLETED_EVENT_TYPES = frozenset(
    {
        WORK_STARTED,
        WORK_PROGRESS,
        "session.closed",
        "mission.close",
    }
)

DOCTRINE_SECTIONS = frozenset(
    {
        "always-read",
        "engineering-doctrine",
        "founder-doctrine",
        "communication-doctrine",
        "python-doctrine",
        "product-doctrine",
    }
)

ARCHITECTURE_SECTIONS = frozenset({"engineering-doctrine"})

SECTION_ORDER = (
    "Completed",
    "Decisions Made",
    "Architecture Changes",
    "Doctrine Promoted",
    "QA Completed",
    "Commits",
    "Open Items",
    "Today's Starting Point",
)

EMPTY_LINE = "None recorded."


class YesterdayError(Exception):
    """Yesterday recap generation failure."""


def report_date_from_eod(eod_path: Path | None) -> str:
    if eod_path is not None and eod_path.stem:
        return eod_path.stem
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def render_yesterday(
    *,
    registry_doc: dict,
    store: dict | None,
    command: TodaysCommand,
    report_date: str,
    events_path: Path | None = None,
) -> str:
    events = _load_events(registry_doc, events_path)
    decisions = load_decision_entries()
    captures = load_queue()

    sections = {
        "Completed": _completed_items(events, report_date),
        "Decisions Made": _decisions_made(events, decisions, captures, report_date, store),
        "Architecture Changes": _architecture_changes(decisions, captures, report_date),
        "Doctrine Promoted": _doctrine_promoted(decisions, captures, report_date),
        "QA Completed": _qa_completed(store, events, report_date),
        "Commits": _commits(events, report_date),
        "Open Items": _open_items(store, captures),
        "Today's Starting Point": _todays_starting_point(command, store),
    }

    parts = ["Yesterday", ""]
    for index, title in enumerate(SECTION_ORDER):
        parts.append(title)
        parts.append("")
        parts.extend(_format_section(title, sections[title]))
        parts.append("")
        if index < len(SECTION_ORDER) - 1:
            parts.append("-----------------------------------")
            parts.append("")
    return "\n".join(parts).rstrip() + "\n"


def write_yesterday(
    *,
    registry_doc: dict,
    store: dict | None,
    command: TodaysCommand,
    output_dir: Path,
    report_date: str | None = None,
    eod_path: Path | None = None,
    events_path: Path | None = None,
) -> Path:
    resolved_date = report_date or report_date_from_eod(eod_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "yesterday.md"
    content = render_yesterday(
        registry_doc=registry_doc,
        store=store,
        command=command,
        report_date=resolved_date,
        events_path=events_path,
    )
    output_path.write_text(content, encoding="utf-8")
    return output_path


def load_yesterday_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8").strip()


def _load_events(registry_doc: dict, events_path: Path | None) -> list[dict]:
    if events_path and events_path.exists():
        try:
            payload = json.loads(events_path.read_text(encoding="utf-8"))
            events = payload.get("events", [])
            if isinstance(events, list) and events:
                return sorted(events, key=lambda event: (event.get("at", ""), event.get("id", "")))
        except (OSError, json.JSONDecodeError):
            pass

    events: list[dict] = []
    for mission in registry_doc.get("missions", []):
        for event in mission.get("events", []):
            if isinstance(event, dict):
                events.append(event)
    return sorted(events, key=lambda event: (event.get("at", ""), event.get("id", "")))


def _on_report_date(timestamp: str, report_date: str) -> bool:
    return bool(timestamp) and timestamp.startswith(report_date)


def _completed_items(events: list[dict], report_date: str) -> list[str]:
    items: list[str] = []
    seen: set[str] = set()
    for event in events:
        if not _on_report_date(event.get("at", ""), report_date):
            continue
        if event.get("eventType") not in COMPLETED_EVENT_TYPES:
            continue
        summary = _event_summary(event)
        if not summary:
            continue
        key = _canonical(summary)
        if key in seen:
            continue
        seen.add(key)
        items.append(summary)
    return items


def _decisions_made(
    events: list[dict],
    decisions: list[dict[str, str]],
    captures: list[dict],
    report_date: str,
    store: dict | None,
) -> list[str]:
    items = _unique_texts(
        _decision_register_texts(decisions, report_date, sections={"decision-register"})
        + _capture_texts(captures, report_date, types={"decision"}, statuses={"promoted"})
        + _event_texts(events, report_date, event_types={DECISION_PROMOTED})
        + _store_decision_texts(store, report_date)
    )
    return items


def _architecture_changes(
    decisions: list[dict[str, str]],
    captures: list[dict],
    report_date: str,
) -> list[str]:
    return _unique_texts(
        _decision_register_texts(decisions, report_date, sections=ARCHITECTURE_SECTIONS)
        + _capture_texts(captures, report_date, types={"freeze"}, statuses={"promoted"})
    )


def _doctrine_promoted(
    decisions: list[dict[str, str]],
    captures: list[dict],
    report_date: str,
) -> list[str]:
    return _unique_texts(
        _decision_register_texts(decisions, report_date, sections=DOCTRINE_SECTIONS)
        + _capture_texts(captures, report_date, types={"promote"}, statuses={"promoted"})
    )


def _qa_completed(store: dict | None, events: list[dict], report_date: str) -> list[str]:
    items: list[str] = []
    if store:
        for record in store.get("qaRuns", []):
            if not isinstance(record, dict):
                continue
            record_date = record.get("date") or (record.get("createdAt") or "")[:10]
            if record_date != report_date:
                continue
            objective = (record.get("objective") or "").strip()
            result = (record.get("result") or "").strip()
            if objective and result:
                items.append(f"{objective} ({result}).")
            elif objective:
                items.append(f"{objective}.")
    for event in events:
        if not _on_report_date(event.get("at", ""), report_date):
            continue
        if event.get("eventType") != "qa.completed":
            continue
        summary = _event_summary(event)
        if summary:
            items.append(summary)
    return _unique_texts(items)


def _commits(events: list[dict], report_date: str) -> list[str]:
    return _event_texts(events, report_date, event_types={"git.commit"})


def _open_items(store: dict | None, captures: list[dict]) -> list[str]:
    items: list[str] = []
    for entry in captures:
        if entry.get("status") != "pending":
            continue
        text = (entry.get("text") or "").strip()
        if text:
            items.append(text)
    if store:
        for collection, field in (
            ("parkingLot", "title"),
            ("investigations", "title"),
            ("risks", "title"),
        ):
            for record in open_records(store, collection):
                text = (record.get(field) or record.get("description") or "").strip()
                if text:
                    items.append(text)
    return _unique_texts(items)


def _todays_starting_point(command: TodaysCommand, store: dict | None) -> list[str]:
    sessions = closed_sessions_sorted(store or {"sessions": []})
    if sessions:
        planning = (sessions[0].get("planningIntent") or "").strip()
        if planning:
            return [planning]
    return [command.command]


def _decision_register_texts(
    decisions: list[dict[str, str]],
    report_date: str,
    *,
    sections: set[str],
) -> list[str]:
    items: list[str] = []
    for entry in decisions:
        if not _on_report_date(entry.get("timestamp", ""), report_date):
            continue
        if entry.get("section") not in sections:
            continue
        text = (entry.get("text") or "").strip()
        if text:
            items.append(text)
    return items


def _capture_texts(
    captures: list[dict],
    report_date: str,
    *,
    types: set[str],
    statuses: set[str],
) -> list[str]:
    items: list[str] = []
    for entry in captures:
        if entry.get("type") not in types:
            continue
        if entry.get("status") not in statuses:
            continue
        if not _on_report_date(entry.get("timestamp", ""), report_date):
            continue
        text = (entry.get("text") or "").strip()
        if text:
            items.append(text)
    return items


def _event_texts(events: list[dict], report_date: str, *, event_types: set[str]) -> list[str]:
    items: list[str] = []
    for event in events:
        if not _on_report_date(event.get("at", ""), report_date):
            continue
        if event.get("eventType") not in event_types:
            continue
        summary = _event_summary(event)
        if summary:
            items.append(summary)
    return items


def _store_decision_texts(store: dict | None, report_date: str) -> list[str]:
    if not store:
        return []
    items: list[str] = []
    for record in store.get("decisions", []):
        if not isinstance(record, dict):
            continue
        record_date = record.get("date") or (record.get("createdAt") or "")[:10]
        if record_date != report_date:
            continue
        text = (record.get("description") or record.get("title") or "").strip()
        if text:
            items.append(text)
    return items


def _format_section(title: str, items: list[str]) -> list[str]:
    if not items:
        return [EMPTY_LINE]

    if title == "Completed":
        return [f"✓ {item}" for item in items]
    if title in {"Decisions Made", "Architecture Changes", "Doctrine Promoted"}:
        return [f"• {item}" for item in items]
    if title == "Today's Starting Point":
        return items
    return items


def _event_summary(event: dict) -> str:
    for key in ("summary", "objective"):
        value = (event.get(key) or "").strip()
        if value:
            return value
    return ""


def _unique_texts(items: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for item in items:
        key = _canonical(item)
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def _canonical(value: str) -> str:
    return " ".join(value.strip().lower().split())
