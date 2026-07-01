"""Deterministic Today's Command projection from Mission State."""

from __future__ import annotations

from dataclasses import dataclass


INTERVENTION_POSTURES = {
    "Blocked": 0,
    "Paused": 1,
}


@dataclass(frozen=True)
class MissionCommandInput:
    mission_id: str
    label: str
    status: str
    objective: str
    posture: str
    latest_event: str
    latest_eos: str
    last_updated: str


@dataclass(frozen=True)
class TodaysCommand:
    rule: str
    state: str
    command: str
    mission: str
    best_next_move: str
    why_now: str
    current_reality: str
    yesterday: str


def command_from_registry_doc(doc: dict) -> TodaysCommand:
    missions = []
    for item in doc.get("missions", []):
        state = item.get("state", {})
        missions.append(
            MissionCommandInput(
                mission_id=state.get("missionId") or item.get("missionId", ""),
                label=state.get("label") or item.get("label", ""),
                status=state.get("status", ""),
                objective=state.get("currentObjective", ""),
                posture=state.get("operationalIntent", ""),
                latest_event=state.get("latestEvent", ""),
                latest_eos=state.get("latestEos", ""),
                last_updated=state.get("lastUpdated", ""),
            )
        )
    return recommend_todays_command(missions)


def recommend_todays_command(missions: list[MissionCommandInput]) -> TodaysCommand:
    if not missions:
        return TodaysCommand(
            rule="Rule 4",
            state="No Mission State",
            command="Review latest EOS and begin next mission",
            mission="No missions projected",
            best_next_move="Review the latest available closure and define the next mission.",
            why_now="Mission State does not contain an active, resumable, or closed mission.",
            current_reality="No projected missions are available.",
            yesterday="No EOS is available.",
        )

    interventions = [m for m in missions if m.posture in INTERVENTION_POSTURES]
    if interventions:
        mission = sorted(
            interventions,
            key=lambda m: (INTERVENTION_POSTURES[m.posture], _reverse_time(m.last_updated), m.label),
        )[0]
        return TodaysCommand(
            rule="Rule 1",
            state="Founder Intervention Required",
            command=f"Resolve {mission.label}",
            mission=mission.label,
            best_next_move=_resolve_next_move(mission),
            why_now=_intervention_why(mission),
            current_reality=_current_reality(mission, intervention=True),
            yesterday=_latest_eos_summary(missions),
        )

    active_executing = [m for m in missions if m.status == "Active" and m.posture == "Executing"]
    if active_executing:
        mission = _latest(active_executing)
        count = len(active_executing)
        return TodaysCommand(
            rule="Rule 2",
            state="Clear to Execute",
            command=f"Continue {mission.label}",
            mission=mission.label,
            best_next_move=_continue_next_move(mission),
            why_now=_active_why(mission, count),
            current_reality=_current_reality(mission, intervention=False),
            yesterday=_latest_eos_summary(missions),
        )

    ready = [m for m in missions if m.posture == "Ready to Resume"]
    if ready:
        mission = _latest(ready)
        return TodaysCommand(
            rule="Rule 3",
            state="Ready to Resume",
            command=f"Resume {mission.label}",
            mission=mission.label,
            best_next_move=_resume_next_move(mission),
            why_now=_resume_why(mission),
            current_reality=_current_reality(mission, intervention=False),
            yesterday=_latest_eos_summary(missions),
        )

    closed = [m for m in missions if m.latest_eos or m.status == "Closed" or m.posture == "Completed"]
    mission = _latest(closed or missions)
    return TodaysCommand(
        rule="Rule 4",
        state="Review and Begin",
        command="Review latest EOS and begin next mission",
        mission=mission.label,
        best_next_move=_review_next_move(mission),
        why_now=_review_why(missions, mission),
        current_reality="No mission is currently active, executing, blocked, paused, or ready to resume.",
        yesterday=_eos_summary_for(mission),
    )


def _latest(missions: list[MissionCommandInput]) -> MissionCommandInput:
    return sorted(missions, key=lambda m: (m.last_updated, m.label), reverse=True)[0]


def _reverse_time(value: str) -> str:
    return "".join(chr(255 - ord(char)) for char in value)


def _continue_next_move(mission: MissionCommandInput) -> str:
    if mission.objective:
        return f"Continue execution against: {mission.objective}"
    return f"Continue execution on {mission.label}."


def _resolve_next_move(mission: MissionCommandInput) -> str:
    signal = mission.latest_event or mission.objective
    if signal:
        return f"Resolve the {mission.posture.lower()} condition: {signal}"
    return f"Resolve the {mission.posture.lower()} condition on {mission.label}."


def _resume_next_move(mission: MissionCommandInput) -> str:
    signal = mission.latest_event or mission.objective
    if signal:
        return f"Resume from the latest signal: {signal}"
    return f"Resume {mission.label}."


def _review_next_move(mission: MissionCommandInput) -> str:
    if mission.latest_eos:
        return f"Review the latest EOS from {mission.label}, then begin the next mission."
    return f"Review {mission.label}, then begin the next mission."


def _intervention_why(mission: MissionCommandInput) -> str:
    signal = mission.latest_event or mission.objective or "No latest event is projected."
    return (
        f"{mission.label} is {mission.status or 'unknown status'} with operational posture "
        f"{mission.posture}. Latest signal: {signal}"
    )


def _active_why(mission: MissionCommandInput, count: int) -> str:
    qualifier = "the only active executing mission" if count == 1 else "the most recently updated active executing mission"
    signal = mission.latest_event or mission.objective or "No latest event is projected."
    return f"{mission.label} is {qualifier}, and no higher-priority intervention exists. Latest signal: {signal}"


def _resume_why(mission: MissionCommandInput) -> str:
    signal = mission.latest_event or mission.objective or "No latest event is projected."
    return f"{mission.label} is ready to resume, with no blocked or paused mission ahead of it. Latest signal: {signal}"


def _review_why(missions: list[MissionCommandInput], mission: MissionCommandInput) -> str:
    active_count = len([m for m in missions if m.status == "Active"])
    if mission.latest_eos:
        return f"No active executing or resumable mission exists. The latest EOS is available from {mission.label}."
    return f"No active executing or resumable mission exists. Active mission count: {active_count}."


def _current_reality(mission: MissionCommandInput, *, intervention: bool) -> str:
    suffix = "Founder intervention required." if intervention else "No founder intervention required."
    return f"{mission.status or 'Unknown'} / {mission.posture or 'Unknown'}. {suffix}"


def _latest_eos_summary(missions: list[MissionCommandInput]) -> str:
    closed = [m for m in missions if m.status == "Closed" or m.posture == "Completed"]
    if not closed:
        return "No EOS is available."
    return _eos_summary_for(_latest(closed))


def _eos_summary_for(mission: MissionCommandInput) -> str:
    signal = mission.latest_event or "EOS available."
    return f"{mission.label}: {signal}"
