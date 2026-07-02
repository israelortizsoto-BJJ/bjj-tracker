"""Generated operator bootstrap for fresh execution sessions."""

from __future__ import annotations

import json
from pathlib import Path

from ods.operating_command import TodaysCommand, command_from_registry_doc


class BootstrapError(Exception):
    """Bootstrap generation failure."""


PROTECTED_SYSTEMS = (
    "Event Store",
    "Mission Engine",
    "Mission State",
    "Mission Registry",
    "Mission Registry schema",
    "Event schema",
    "EOS generation",
    "Law #001",
    "Projection architecture",
    "Notion schema",
    "Promotion Bridge",
    "Proof Floor",
)

ARCHITECTURE_FLOORS = (
    "Conversation -> Promotion -> Event Store -> Mission Engine -> Mission State -> Projection Engine -> Notion",
    "EOS is the single founder interaction; downstream projections run automatically.",
    "Event Store is canonical; projections are regenerable views.",
    "Mission State is live runtime state owned by the Mission Engine.",
    "Notion is presentation; it is not the source of truth.",
)

EXECUTION_RULES = (
    "Evidence before assumptions.",
    "Repository before implementation.",
    "Architecture before patches.",
    "Protect canonical systems.",
    "QA before promotion.",
    "The system recommends. The founder decides.",
)

ANALYTICS_ENGINE_DOCTRINE = (
    "Analytics are projections over events and Mission State.",
    "No dashboard metric becomes a source of truth.",
    "Computed signals must be explainable from existing state.",
    "Humans consume intelligence. Machines consume evidence.",
)


def load_registry_doc(path: Path) -> dict:
    if not path.exists():
        raise BootstrapError(f"Mission Registry projection not found: {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise BootstrapError(f"Cannot load Mission Registry projection: {exc}") from exc


def render_operator_bootstrap(*, registry_doc: dict, store: dict | None = None) -> str:
    command = command_from_registry_doc(registry_doc)
    active = _active_priorities(registry_doc)
    current = _current_sprint(active, command)
    next_slice = _next_slice(command)

    parts = [
        "# Operator Bootstrap",
        "",
        "Paste this into a fresh execution thread to restore operating context.",
        "",
        "## 1. Execution Mode",
        "",
        _execution_mode(command),
        "",
        "## 2. Current Sprint",
        "",
        f"- {current}",
        "",
        "## 3. Protected Systems",
        "",
        *_bullets(PROTECTED_SYSTEMS),
        "",
        "## 4. Architecture Floors",
        "",
        *_bullets(ARCHITECTURE_FLOORS),
        "",
        "## 5. Active Priorities",
        "",
        *(_priority_lines(active, command) or ["- No active priorities are projected."]),
        "",
        "## 6. Execution Rules",
        "",
        *_bullets(_active_rules(store)),
        "",
        "## 7. Analytics Engine Doctrine",
        "",
        *_bullets(ANALYTICS_ENGINE_DOCTRINE),
        "",
        "## 8. Session Goal",
        "",
        f"- {command.command}. {command.why_now}",
        "",
        "## 9. One Executable Next Slice",
        "",
        f"- {next_slice}",
        "",
    ]
    return "\n".join(parts)


def write_operator_bootstrap(
    *,
    registry_doc: dict,
    output_dir: Path,
    store: dict | None = None,
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "operator-bootstrap.md"
    output_path.write_text(render_operator_bootstrap(registry_doc=registry_doc, store=store), encoding="utf-8")
    return output_path


def _active_priorities(registry_doc: dict) -> list[dict]:
    missions = []
    for item in registry_doc.get("missions", []):
        state = item.get("state", {})
        if state.get("status") == "Active" and state.get("operationalIntent") != "Completed":
            missions.append(
                {
                    "label": state.get("label") or item.get("label", ""),
                    "status": state.get("status", ""),
                    "posture": state.get("operationalIntent", ""),
                    "objective": state.get("currentObjective", ""),
                    "latest_event": state.get("latestEvent", ""),
                    "last_updated": state.get("lastUpdated", ""),
                }
            )
    return sorted(missions, key=lambda mission: (mission["posture"] != "Executing", mission["label"]))


def _current_sprint(active: list[dict], command: TodaysCommand) -> str:
    recommended = next((mission for mission in active if mission["label"] == command.mission), None)
    if recommended:
        objective = _sentence(recommended.get("objective", ""))
        return f"{recommended['label']} - {recommended['posture'] or recommended['status']}. {objective}"
    return command.command


def _execution_mode(command: TodaysCommand) -> str:
    return (
        f"- {command.state}. Work from Today's Command, preserve protected systems, "
        "and make the smallest verifiable slice."
    )


def _priority_lines(active: list[dict], command: TodaysCommand) -> list[str]:
    lines = []
    for mission in active:
        marker = " [RECOMMENDED]" if mission["label"] == command.mission else ""
        latest = _sentence(mission.get("latest_event", ""))
        lines.append(
            f"- {mission['label']}{marker}: {mission['posture'] or mission['status']}. Latest signal: {latest}"
        )
    return lines


def _active_rules(store: dict | None) -> tuple[str, ...]:
    doctrine_records = []
    if store:
        for record in store.get("doctrines", []):
            text = record.get("description") or record.get("statement") or record.get("title")
            if text:
                doctrine_records.append(_sentence(str(text)))
    if doctrine_records:
        return tuple(dict.fromkeys([*EXECUTION_RULES, *doctrine_records]))
    return EXECUTION_RULES


def _next_slice(command: TodaysCommand) -> str:
    move = _sentence(command.best_next_move)
    if not move:
        return "Review the latest projected command and choose the next mission."
    return move


def _sentence(value: str) -> str:
    text = " ".join(str(value or "").split())
    if not text:
        return ""
    return text if text.endswith((".", "!", "?")) else f"{text}."


def _bullets(items: tuple[str, ...]) -> list[str]:
    return [f"- {item}" for item in items]
