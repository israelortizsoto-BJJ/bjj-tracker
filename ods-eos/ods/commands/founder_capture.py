"""Founder capture queue commands — deterministic inbox before promotion."""

from __future__ import annotations

import sys

from ods.capture_queue import (
    CaptureQueueError,
    append_capture,
    format_capture_label,
    format_review,
    pending_captures,
    promotion_section_for_type,
    update_capture_status,
)
from ods.commands.promote import PromoteError, run_promote


class FounderCaptureError(Exception):
    """Founder capture command failure."""


def run_founder_capture(capture_type: str, text: str, *, project: str | None = None) -> None:
    try:
        entry = append_capture(capture_type, text, project=project)
    except CaptureQueueError as exc:
        raise FounderCaptureError(str(exc)) from exc

    print("Capture queued.")
    print(f"  ID: {entry['id']}")
    print(f"  Type: {format_capture_label(entry['type'])}")
    print(f"  Text: {entry['text']}")
    if entry.get("project"):
        print(f"  Project: {entry['project']}")


def run_review_captures() -> None:
    entries = pending_captures()
    print(format_review(entries))


def run_promote_pending() -> None:
    entries = pending_captures()
    if not entries:
        print("No pending captures.")
        return

    for entry in entries:
        print()
        print(format_capture_label(entry["type"]))
        print()
        print(entry["text"])
        print()
        print("Approve?")
        print()
        print("[Y/N]")
        answer = _read_approval()
        if answer == "y":
            section = promotion_section_for_type(entry["type"])
            try:
                run_promote(section, entry["text"])
            except PromoteError as exc:
                raise FounderCaptureError(
                    f"Promotion failed for capture {entry['id']}: {exc}"
                ) from exc
            update_capture_status(entry["id"], "promoted")
            print(f"Capture {entry['id']} promoted.")
        else:
            update_capture_status(entry["id"], "rejected")
            print(f"Capture {entry['id']} rejected.")


def _read_approval() -> str:
    while True:
        try:
            answer = input("> ").strip().lower()
        except EOFError:
            print(file=sys.stderr)
            raise FounderCaptureError("Promotion review cancelled.") from None
        if answer in {"y", "yes"}:
            return "y"
        if answer in {"n", "no"}:
            return "n"
        print("Enter Y or N.")
