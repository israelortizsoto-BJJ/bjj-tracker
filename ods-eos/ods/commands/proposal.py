"""Promotion Proposal Builder — structured operator input to canonical payload."""

import json
from pathlib import Path

from ods.payload import (
    DECISION_KEYS,
    INVESTIGATION_KEYS,
    PARKING_KEYS,
    PAYLOAD_TOP_LEVEL_KEYS,
    PROJECT_KEYS,
    RISK_KEYS,
    SESSION_KEYS,
    build_canonical_payload,
    validate_payload,
)
from ods.records import validate_evidence_reference
from ods.yaml_io import StructuredInputError, load_structured_file

DEFAULT_OUTPUT = Path("proposal.json")

PROPOSAL_TOP_LEVEL_KEYS = PAYLOAD_TOP_LEVEL_KEYS


class ProposalError(Exception):
    """Promotion proposal validation or build failure."""


def _unsupported_keys(value: dict, allowed: frozenset[str], *, path: str) -> list[str]:
    extra = set(value) - allowed
    if not extra:
        return []
    return [f"{path} contains unsupported keys: {', '.join(sorted(extra))}."]


def _require_string(value: object, *, path: str) -> list[str]:
    if not isinstance(value, str) or not value.strip():
        return [f"{path} is required and must be a non-empty string."]
    return []


def validate_proposal_input(proposal: object) -> None:
    errors: list[str] = []

    if not isinstance(proposal, dict):
        raise ProposalError("Proposal root must be an object.")

    missing = PROPOSAL_TOP_LEVEL_KEYS - set(proposal)
    if missing:
        errors.append(
            "Missing required top-level sections: "
            + ", ".join(sorted(missing))
            + "."
        )

    extra = set(proposal) - PROPOSAL_TOP_LEVEL_KEYS
    if extra:
        errors.append(
            "Unsupported top-level keys: " + ", ".join(sorted(extra)) + "."
        )

    project = proposal.get("project")
    if not isinstance(project, dict):
        errors.append("project must be an object.")
    else:
        errors.extend(_unsupported_keys(project, PROJECT_KEYS, path="project"))
        errors.extend(_require_string(project.get("name"), path="project.name"))

    session = proposal.get("session")
    if not isinstance(session, dict):
        errors.append("session must be an object.")
    else:
        errors.extend(_unsupported_keys(session, SESSION_KEYS, path="session"))
        errors.extend(
            _require_string(session.get("planningIntent"), path="session.planningIntent")
        )
        summary = session.get("summary")
        if summary is not None and not isinstance(summary, str):
            errors.append("session.summary must be a string when present.")
        elif isinstance(summary, str) and not summary.strip():
            errors.append("session.summary must not be empty when present.")

    for key in ("decisions", "investigations", "parkingLot", "risks"):
        value = proposal.get(key)
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
        message = "Proposal validation failed:\n  - " + "\n  - ".join(errors)
        raise ProposalError(message)


def run_proposal(
    input_path: Path,
    *,
    output_path: Path | None = None,
) -> Path:
    try:
        proposal_input = load_structured_file(input_path)
    except StructuredInputError as exc:
        raise ProposalError(str(exc)) from exc

    validate_proposal_input(proposal_input)
    payload = build_canonical_payload(proposal_input)
    validate_payload(payload, error_class=ProposalError)

    destination = output_path or DEFAULT_OUTPUT
    destination.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    print("Proposal generated successfully.")
    print()
    print("Output:")
    print(destination)
    return destination
