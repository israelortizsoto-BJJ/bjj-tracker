"""Mission domain objects and Mission Registry."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from ods.event_types import (
    DECISION_PROMOTED,
    EVENT_SCHEMA_VERSION,
    EVENT_TYPES,
    MISSION_BEGIN,
    MISSION_CLOSE,
    OPERATIONAL_POSTURES,
    SESSION_CLOSED,
    WORK_PROGRESS,
    WORK_STARTED,
)

REGISTRY_SCHEMA_VERSION = "0.1"


class MissionRegistryError(Exception):
    """Mission registry failure."""


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _event_label(event: dict) -> str:
    if event.get("summary"):
        return str(event["summary"])
    if event.get("objective"):
        return str(event["objective"])
    return event["eventType"]


def _derive_operational_posture(events: list[dict], status: str) -> str:
    if status == "Closed":
        return "Completed"

    for event in reversed(events):
        if event["eventType"] == MISSION_CLOSE:
            continue
        posture = event.get("operationalPosture") or event.get("operationalIntent")
        if posture in OPERATIONAL_POSTURES:
            return posture

    for event in reversed(events):
        if event["eventType"] == MISSION_CLOSE:
            continue
        if event["eventType"] in (WORK_STARTED, WORK_PROGRESS, SESSION_CLOSED, DECISION_PROMOTED, MISSION_BEGIN):
            return "Executing"

    return "Executing"


@dataclass
class MissionState:
    mission_id: str
    label: str
    status: str
    current_objective: str
    operational_intent: str
    latest_event: str
    last_updated: str
    latest_eos: str | None = None
    latest_eos_path: str | None = None

    def to_dict(self) -> dict:
        return {
            "missionId": self.mission_id,
            "label": self.label,
            "status": self.status,
            "currentObjective": self.current_objective,
            "operationalIntent": self.operational_intent,
            "latestEvent": self.latest_event,
            "lastUpdated": self.last_updated,
            "latestEos": self.latest_eos,
            "latestEosPath": self.latest_eos_path,
        }

    def registry_row(self) -> dict:
        """One projection view of this mission for external registries."""
        return {
            "missionId": self.mission_id,
            "label": self.label,
            "status": self.status,
            "currentObjective": self.current_objective,
            "operationalIntent": self.operational_intent,
            "latestEvent": self.latest_event,
            "latestEos": self.latest_eos or "",
            "lastUpdated": self.last_updated,
        }


@dataclass
class Mission:
    mission_id: str
    label: str
    date: str
    repository: str | None = None
    events: list[dict] = field(default_factory=list)
    state: MissionState | None = None
    eos_text: str | None = None
    eos_path: str | None = None

    def replay(self) -> list[dict]:
        """Ordered event history for projections (Timeline, EOS, Analytics, Debugging)."""
        return list(self.events)

    def to_dict(self) -> dict:
        payload = {
            "missionId": self.mission_id,
            "label": self.label,
            "date": self.date,
            "repository": self.repository,
            "events": self.events,
        }
        if self.state:
            payload["state"] = self.state.to_dict()
        if self.eos_text:
            payload["latestEos"] = self.eos_text
        if self.eos_path:
            payload["latestEosPath"] = self.eos_path
        return payload


@dataclass
class MissionRegistry:
    missions: dict[str, Mission] = field(default_factory=dict)
    schema_version: str = REGISTRY_SCHEMA_VERSION
    updated_at: str = field(default_factory=_utc_now)

    @classmethod
    def from_dataset_paths(cls, paths: list[Path]) -> MissionRegistry:
        registry = cls()
        for path in paths:
            mission = load_mission_dataset(path)
            registry.add_mission(mission)
        return registry

    def add_mission(self, mission: Mission) -> None:
        if mission.mission_id in self.missions:
            raise MissionRegistryError(f"Duplicate mission_id: {mission.mission_id}")
        self.missions[mission.mission_id] = mission

    def all_events(self) -> list[dict]:
        events: list[dict] = []
        for mission in self.missions.values():
            events.extend(mission.events)
        return sorted(events, key=lambda item: (item["at"], item["id"]))

    def registry_rows(self) -> list[dict]:
        return [mission.state.registry_row() for mission in self.missions.values() if mission.state]

    def project(self, eos_dir: Path) -> None:
        eos_dir.mkdir(parents=True, exist_ok=True)
        for mission in self.missions.values():
            mission.state = compute_mission_state(mission)
            mission.eos_text = generate_eos(mission)
            mission.eos_path = str(eos_dir / f"{mission.mission_id}.md")
            Path(mission.eos_path).write_text(mission.eos_text, encoding="utf-8")
            mission.state.latest_eos = mission.eos_text.split("\n## Outcome", 1)[0].strip()
            mission.state.latest_eos_path = mission.eos_path
        self.updated_at = _utc_now()

    def to_events_doc(self) -> dict:
        return {
            "schemaVersion": self.schema_version,
            "updatedAt": self.updated_at,
            "events": self.all_events(),
        }

    def to_state_doc(self) -> dict:
        return {
            "schemaVersion": self.schema_version,
            "updatedAt": self.updated_at,
            "missions": [mission.to_dict() for mission in self.missions.values()],
        }

    def save(self, store_dir: Path) -> dict[str, str]:
        store_dir.mkdir(parents=True, exist_ok=True)
        events_path = store_dir / "events.json"
        state_path = store_dir / "mission-registry.json"

        events_path.write_text(json.dumps(self.to_events_doc(), indent=2) + "\n", encoding="utf-8")
        state_path.write_text(json.dumps(self.to_state_doc(), indent=2) + "\n", encoding="utf-8")

        return {
            "eventsPath": str(events_path),
            "statePath": str(state_path),
            "eosDir": str(store_dir / "eos"),
        }


def load_mission_dataset(path: Path) -> Mission:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise MissionRegistryError(f"Cannot load mission dataset {path}: {exc}") from exc

    mission_id = data.get("missionId") or data.get("id")
    label = data.get("label") or data.get("name")
    date = data.get("date")
    entries = data.get("entries")

    if not mission_id or not label or not date:
        raise MissionRegistryError(
            f"Mission dataset {path} requires missionId, label, and date."
        )
    if not isinstance(entries, list) or not entries:
        raise MissionRegistryError(f"Mission dataset {path} must include at least one entry.")

    events = mission_entries_to_events(mission_id, date, entries)
    return Mission(
        mission_id=mission_id,
        label=label,
        date=date,
        repository=data.get("repository"),
        events=events,
    )


def mission_entries_to_events(mission_id: str, date: str, entries: list[dict]) -> list[dict]:
    events: list[dict] = []
    for index, entry in enumerate(entries, start=1):
        event_type = entry.get("eventType") or entry.get("kind")
        if "at" not in entry or not event_type:
            raise MissionRegistryError(
                f"Mission {mission_id} entry {index} requires at and eventType."
            )
        if event_type not in EVENT_TYPES:
            raise MissionRegistryError(
                f"Mission {mission_id} entry {index} uses unknown eventType: {event_type}"
            )

        event = {
            "id": f"evt-{date.replace('-', '')}-{index:03d}",
            "schemaVersion": EVENT_SCHEMA_VERSION,
            "missionId": mission_id,
            "at": entry["at"],
            "eventType": event_type,
            "actor": entry.get("actor", "founder"),
        }
        for key, value in entry.items():
            if key not in ("at", "kind", "eventType", "actor"):
                event[key] = value
        events.append(event)

    events.sort(key=lambda item: item["at"])
    return events


def compute_mission_state(mission: Mission) -> MissionState:
    events = mission.replay()
    objective = ""
    status = "Active"
    last_updated = events[-1]["at"]

    for event in events:
        if event["eventType"] == MISSION_BEGIN and event.get("objective"):
            objective = event["objective"]
        if event["eventType"] == MISSION_CLOSE:
            status = "Closed"

    latest_event = _event_label(events[-1])
    for event in reversed(events):
        if event["eventType"] != MISSION_CLOSE:
            latest_event = _event_label(event)
            break

    operational_intent = _derive_operational_posture(events, status)

    return MissionState(
        mission_id=mission.mission_id,
        label=mission.label,
        status=status,
        current_objective=objective,
        operational_intent=operational_intent,
        latest_event=latest_event,
        last_updated=last_updated,
    )


def generate_eos(mission: Mission) -> str:
    state = mission.state
    if state is None:
        raise MissionRegistryError(f"Mission {mission.mission_id} has no projected state.")

    lines = [
        f"# EOS — {mission.label}",
        "",
        f"**Mission ID:** `{mission.mission_id}`",
        f"**Date:** {mission.date}",
        f"**Status:** {state.status}",
        "",
        "## Objective",
        "",
        state.current_objective or "(none recorded)",
        "",
        "## What Happened",
        "",
    ]

    for event in mission.replay():
        label = _event_label(event)
        lines.append(f"- `{event['at']}` **{event['eventType']}** — {label}")

    lines.extend(
        [
            "",
            "## Outcome",
            "",
            state.latest_event,
            "",
            "## Operational Posture",
            "",
            state.operational_intent,
            "",
        ]
    )

    return "\n".join(lines) + "\n"
