"""Founder capture queue command."""

from ods.commands.founder_capture import FounderCaptureError, run_founder_capture

__all__ = ["CaptureError", "run_capture"]

CaptureError = FounderCaptureError


def run_capture(capture_type: str, text: str, *, project: str | None = None) -> None:
    run_founder_capture(capture_type, text, project=project)
