"""Generated active implementation slice for fresh execution sessions."""

from __future__ import annotations

import subprocess
from pathlib import Path

from ods.doctrine import load_decision_entries
from ods.operating_command import TodaysCommand, command_from_registry_doc


class ActiveSliceError(Exception):
    """Active slice generation failure."""


def render_active_slice(*, registry_doc: dict, cwd: Path | None = None) -> str:
    command = command_from_registry_doc(registry_doc)
    mission = _recommended_mission(registry_doc, command)
    repo = _repository(mission, cwd or Path.cwd())
    files = _current_files(repo)

    parts = [
        "# Active Slice",
        "",
        "## Project",
        "",
        f"- {mission['label']}",
        f"- State: {mission['status']} / {mission['posture']}",
        "",
        "## Current Slice",
        "",
        f"- {command.best_next_move}",
        f"- Latest promoted event: {_latest_promoted_event(mission)}",
        f"- Latest EOS signal: {_latest_eos_signal(mission)}",
        f"- Latest promoted knowledge: {_latest_promoted_knowledge()}",
        "",
        "## Promoted Knowledge",
        "",
        *(_promoted_knowledge_lines() or ["- No promoted knowledge is registered."]),
        "",
        "## Repository",
        "",
        f"- {repo}",
        "",
        "## Files Involved",
        "",
        *(_bullets(files) or ["- No modified files detected in the current repository path."]),
        "",
        "## Acceptance Criteria",
        "",
        f"- {command.command} remains aligned with Mission State.",
        "- Generated startup artifacts refresh through `python3 cli.py eod`.",
        "- No protected schema or architecture boundary changes are introduced.",
        "",
        "## Known Constraints",
        "",
        "- Do not modify Mission State, Mission Registry schema, Event Store, EOS, or Law #001.",
        "- Preserve generated-document boundaries; do not hand-author projected output.",
        "",
        "## QA Path",
        "",
        "- `PYTHONPYCACHEPREFIX=/private/tmp/ods-pycache python3 -m py_compile cli.py ods/config.py ods/commands/__init__.py ods/eos_pipeline.py ods/generators/active_slice.py`",
        "- `python3 cli.py active-slice`",
        "- `python3 cli.py eod`",
        "",
        "## Immediate Next Command",
        "",
        "- `git status --short -- .`",
        "",
    ]
    return "\n".join(parts)


def write_active_slice(
    *,
    registry_doc: dict,
    output_dir: Path,
    cwd: Path | None = None,
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "active-slice.md"
    output_path.write_text(render_active_slice(registry_doc=registry_doc, cwd=cwd), encoding="utf-8")
    return output_path


def _recommended_mission(registry_doc: dict, command: TodaysCommand) -> dict:
    fallback: dict | None = None
    for item in registry_doc.get("missions", []):
        state = item.get("state", {})
        mission = {
            "label": state.get("label") or item.get("label", ""),
            "status": state.get("status", ""),
            "posture": state.get("operationalIntent", ""),
            "objective": state.get("currentObjective", ""),
            "latest_event": state.get("latestEvent", ""),
            "latest_eos": state.get("latestEos", ""),
            "repository": item.get("repository", ""),
            "events": item.get("events", []),
        }
        if mission["label"] == command.mission:
            return mission
        if fallback is None:
            fallback = mission
    if fallback:
        return fallback
    raise ActiveSliceError("Mission Registry projection does not contain any missions.")


def _repository(mission: dict, cwd: Path) -> Path:
    value = mission.get("repository")
    if value:
        path = Path(value).expanduser()
        if path.exists():
            return path
    return cwd


def _current_files(repo: Path) -> list[str]:
    try:
        result = subprocess.run(
            ["git", "status", "--short", "--", "."],
            cwd=repo,
            text=True,
            capture_output=True,
            check=False,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return []
    if result.returncode != 0:
        return []
    files = []
    for line in result.stdout.splitlines():
        cleaned = line.strip()
        if "__pycache__" in cleaned or cleaned.endswith(".pyc"):
            continue
        if cleaned:
            files.append(cleaned)
    return files[:8]


def _latest_promoted_event(mission: dict) -> str:
    for event in reversed(mission.get("events", [])):
        if event.get("eventType") == "decision.promoted":
            return _sentence(event.get("summary") or event.get("objective") or "No promoted event summary.")
    return "No promoted event is projected."


def _latest_eos_signal(mission: dict) -> str:
    latest = mission.get("latest_event") or mission.get("objective")
    return _sentence(latest or "No latest EOS signal is projected.")


def _latest_promoted_knowledge() -> str:
    entries = load_decision_entries()
    if not entries:
        return "No promoted knowledge is registered."
    latest = entries[-1]
    return _sentence(f"{latest['text']} ({latest['section']})")


def _promoted_knowledge_lines() -> list[str]:
    return [f"- {entry['text']} ({entry['section']})" for entry in load_decision_entries()]


def _sentence(value: str) -> str:
    text = " ".join(str(value or "").split())
    if not text:
        return ""
    return text if text.endswith((".", "!", "?")) else f"{text}."


def _bullets(items: list[str]) -> list[str]:
    return [f"- `{item}`" for item in items]
