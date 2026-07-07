"""Deterministic founder capture queue — append-only inbox for decisions."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ods.config import get_capture_queue_path

CAPTURE_TYPES = frozenset(
    {
        "decision",
        "promote",
        "parking-lot",
        "freeze",
        "blocked",
        "priority",
        "resume",
        "pause",
    }
)

CAPTURE_TYPE_LABELS = {
    "decision": "DECISION",
    "promote": "PROMOTE",
    "parking-lot": "PARKING LOT",
    "freeze": "FREEZE",
    "blocked": "BLOCKED",
    "priority": "PRIORITY",
    "resume": "RESUME",
    "pause": "PAUSE",
}

PROMOTION_SECTIONS = {
    "decision": "decision-register",
    "promote": "founder-doctrine",
    "parking-lot": "parking-lot",
    "freeze": "engineering-doctrine",
    "blocked": "founder-doctrine",
    "priority": "founder-doctrine",
    "resume": "founder-doctrine",
    "pause": "founder-doctrine",
}

STATUSES = frozenset({"pending", "approved", "rejected", "promoted"})


class CaptureQueueError(Exception):
    """Capture queue operation failure."""


def load_queue(path: Path | None = None) -> list[dict[str, Any]]:
    queue_path = path or get_capture_queue_path()
    if not queue_path.exists():
        return []
    try:
        data = json.loads(queue_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise CaptureQueueError(f"Invalid capture queue JSON: {queue_path}") from exc
    if not isinstance(data, list):
        raise CaptureQueueError(f"Capture queue must be a JSON array: {queue_path}")
    return data


def save_queue(entries: list[dict[str, Any]], path: Path | None = None) -> Path:
    queue_path = path or get_capture_queue_path()
    queue_path.parent.mkdir(parents=True, exist_ok=True)
    queue_path.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")
    return queue_path


def append_capture(
    capture_type: str,
    text: str,
    *,
    project: str | None = None,
    path: Path | None = None,
    now: str | None = None,
) -> dict[str, Any]:
    normalized_type = _normalize_type(capture_type)
    normalized_text = _normalize_text(text)
    normalized_project = _normalize_optional(project)

    entries = load_queue(path)
    entry = {
        "id": _next_id(entries),
        "timestamp": now or _utc_now(),
        "type": normalized_type,
        "text": normalized_text,
        "status": "pending",
    }
    if normalized_project:
        entry["project"] = normalized_project

    entries.append(entry)
    save_queue(entries, path)
    return entry


def pending_captures(path: Path | None = None) -> list[dict[str, Any]]:
    return [entry for entry in load_queue(path) if entry.get("status") == "pending"]


def update_capture_status(
    entry_id: int,
    status: str,
    *,
    path: Path | None = None,
) -> dict[str, Any]:
    if status not in STATUSES:
        raise CaptureQueueError(f"Unsupported status: {status!r}")

    entries = load_queue(path)
    for entry in entries:
        if entry.get("id") == entry_id:
            entry["status"] = status
            save_queue(entries, path)
            return entry
    raise CaptureQueueError(f"Capture not found: id={entry_id}")


def promotion_section_for_type(capture_type: str) -> str:
    normalized_type = _normalize_type(capture_type)
    return PROMOTION_SECTIONS[normalized_type]


def format_capture_label(capture_type: str) -> str:
    return CAPTURE_TYPE_LABELS[_normalize_type(capture_type)]


def format_review(entries: list[dict[str, Any]]) -> str:
    if not entries:
        return "No pending captures."

    lines = ["Pending Captures", ""]
    for index, entry in enumerate(entries, start=1):
        lines.append(f"{index}.")
        lines.append("")
        lines.append(format_capture_label(entry["type"]))
        lines.append("")
        lines.append(entry["text"])
        lines.append("")
    return "\n".join(lines).rstrip()


def _next_id(entries: list[dict[str, Any]]) -> int:
    ids = [int(entry["id"]) for entry in entries if isinstance(entry.get("id"), int)]
    return (max(ids) if ids else 0) + 1


def _normalize_type(capture_type: str) -> str:
    normalized = (capture_type or "").strip().lower()
    if normalized not in CAPTURE_TYPES:
        allowed = ", ".join(sorted(CAPTURE_TYPES))
        raise CaptureQueueError(f"Unsupported capture type: {capture_type!r}. Allowed types: {allowed}")
    return normalized


def _normalize_text(text: str) -> str:
    normalized = " ".join((text or "").split())
    if not normalized:
        raise CaptureQueueError("Capture text is required.")
    return normalized


def _normalize_optional(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = " ".join(value.split())
    return normalized or None


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
