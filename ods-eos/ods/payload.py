"""Canonical promotion payload contract shared by proposal and ingest."""

from ods.records import validate_evidence_reference

PAYLOAD_TOP_LEVEL_KEYS = frozenset(
    {"project", "session", "decisions", "investigations", "parkingLot", "risks"}
)
PROJECT_KEYS = frozenset({"name"})
SESSION_KEYS = frozenset({"summary", "planningIntent"})
DECISION_KEYS = frozenset({"description", "supportingEvidence", "date"})
INVESTIGATION_KEYS = frozenset({"title", "objective"})
PARKING_KEYS = frozenset({"title", "reasonDeferred"})
RISK_KEYS = frozenset({"description"})

SUMMARY_FORBIDDEN_MARKERS = (
    "decision:",
    "parking lot:",
    "open investigation:",
    "risks:",
    "tomorrow begins:",
    "what happened today:",
)


class PayloadError(Exception):
    """Canonical payload validation failure."""


def validate_session_summary(summary: str, *, session_id: str | None = None) -> list[str]:
    errors: list[str] = []
    prefix = f"Session {session_id!r}: " if session_id else "Session: "

    if "\n" in summary:
        errors.append(
            f"{prefix}summary must be a one-line focus label; "
            "multi-line content belongs in atomic records."
        )

    lowered = summary.lower()
    for marker in SUMMARY_FORBIDDEN_MARKERS:
        if marker in lowered:
            errors.append(
                f"{prefix}summary must not embed atomic facts "
                f"(found forbidden marker {marker!r})."
            )
            break

    return errors


def _unsupported_keys(value: dict, allowed: frozenset[str], *, path: str) -> list[str]:
    extra = set(value) - allowed
    if not extra:
        return []
    return [f"{path} contains unsupported keys: {', '.join(sorted(extra))}."]


def _require_string(value: object, *, path: str) -> list[str]:
    if not isinstance(value, str) or not value.strip():
        return [f"{path} is required and must be a non-empty string."]
    return []


def validate_payload(payload: object, *, error_class: type[Exception] = PayloadError) -> None:
    errors: list[str] = []

    if not isinstance(payload, dict):
        raise error_class("Payload root must be a JSON object.")

    missing = PAYLOAD_TOP_LEVEL_KEYS - set(payload)
    if missing:
        errors.append(
            "Missing required top-level sections: "
            + ", ".join(sorted(missing))
            + "."
        )

    extra = set(payload) - PAYLOAD_TOP_LEVEL_KEYS
    if extra:
        errors.append(
            "Unsupported top-level keys: " + ", ".join(sorted(extra)) + "."
        )

    project = payload.get("project")
    if not isinstance(project, dict):
        errors.append("project must be an object.")
    else:
        errors.extend(_unsupported_keys(project, PROJECT_KEYS, path="project"))
        errors.extend(_require_string(project.get("name"), path="project.name"))

    session = payload.get("session")
    if not isinstance(session, dict):
        errors.append("session must be an object.")
    else:
        errors.extend(_unsupported_keys(session, SESSION_KEYS, path="session"))
        errors.extend(
            _require_string(session.get("planningIntent"), path="session.planningIntent")
        )
        summary = session.get("summary")
        if summary is not None:
            if not isinstance(summary, str):
                errors.append("session.summary must be a string when present.")
            elif summary.strip():
                errors.extend(validate_session_summary(summary.strip()))

    for key in ("decisions", "investigations", "parkingLot", "risks"):
        value = payload.get(key)
        if value is None:
            continue
        if not isinstance(value, list):
            errors.append(f"{key} must be an array.")
            continue

        if key == "decisions":
            for index, item in enumerate(value):
                path = f"decisions[{index}]"
                if not isinstance(item, dict):
                    errors.append(f"{path} must be an object.")
                    continue
                errors.extend(_unsupported_keys(item, DECISION_KEYS, path=path))
                errors.extend(
                    _require_string(item.get("description"), path=f"{path}.description")
                )
                evidence = item.get("supportingEvidence")
                if not isinstance(evidence, list) or not evidence:
                    errors.append(f"{path}.supportingEvidence must be a non-empty array.")
                else:
                    for ev_index, entry in enumerate(evidence):
                        errors.extend(
                            validate_evidence_reference(
                                entry, path=f"{path}.supportingEvidence[{ev_index}]"
                            )
                        )
                if "date" in item and not isinstance(item["date"], str):
                    errors.append(f"{path}.date must be a string when present.")

        elif key == "investigations":
            for index, item in enumerate(value):
                path = f"investigations[{index}]"
                if not isinstance(item, dict):
                    errors.append(f"{path} must be an object.")
                    continue
                errors.extend(_unsupported_keys(item, INVESTIGATION_KEYS, path=path))
                errors.extend(_require_string(item.get("title"), path=f"{path}.title"))
                errors.extend(
                    _require_string(item.get("objective"), path=f"{path}.objective")
                )

        elif key == "parkingLot":
            for index, item in enumerate(value):
                path = f"parkingLot[{index}]"
                if not isinstance(item, dict):
                    errors.append(f"{path} must be an object.")
                    continue
                errors.extend(_unsupported_keys(item, PARKING_KEYS, path=path))
                errors.extend(_require_string(item.get("title"), path=f"{path}.title"))
                errors.extend(
                    _require_string(
                        item.get("reasonDeferred"), path=f"{path}.reasonDeferred"
                    )
                )

        elif key == "risks":
            for index, item in enumerate(value):
                path = f"risks[{index}]"
                if not isinstance(item, dict):
                    errors.append(f"{path} must be an object.")
                    continue
                errors.extend(_unsupported_keys(item, RISK_KEYS, path=path))
                errors.extend(
                    _require_string(item.get("description"), path=f"{path}.description")
                )

    if errors:
        message = "Payload validation failed:\n  - " + "\n  - ".join(errors)
        raise error_class(message)


def build_canonical_payload(proposal: dict) -> dict:
    """Normalize validated proposal input into the canonical payload shape."""
    session = proposal["session"]
    payload: dict = {
        "project": {"name": proposal["project"]["name"].strip()},
        "session": {
            "planningIntent": session["planningIntent"].strip(),
        },
        "decisions": [],
        "investigations": [],
        "parkingLot": [],
        "risks": [],
    }

    summary = session.get("summary")
    if isinstance(summary, str) and summary.strip():
        payload["session"]["summary"] = summary.strip()

    for item in proposal["decisions"]:
        decision: dict = {
            "description": item["description"].strip(),
            "supportingEvidence": [
                _normalize_evidence(entry) for entry in item["supportingEvidence"]
            ],
        }
        if "date" in item:
            decision["date"] = item["date"].strip()
        payload["decisions"].append(decision)

    for item in proposal["investigations"]:
        payload["investigations"].append(
            {
                "title": item["title"].strip(),
                "objective": item["objective"].strip(),
            }
        )

    for item in proposal["parkingLot"]:
        payload["parkingLot"].append(
            {
                "title": item["title"].strip(),
                "reasonDeferred": item["reasonDeferred"].strip(),
            }
        )

    for item in proposal["risks"]:
        payload["risks"].append({"description": item["description"].strip()})

    return payload


def _normalize_evidence(entry: dict) -> dict:
    normalized: dict = {
        "ref": entry["ref"].strip(),
        "kind": entry["kind"].strip(),
    }
    summary = entry.get("summary")
    if isinstance(summary, str) and summary.strip():
        normalized["summary"] = summary.strip()
    return normalized
