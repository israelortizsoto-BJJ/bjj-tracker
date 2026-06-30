"""Shared knowledge store record builders for capture and ingest."""

from ods.commands.prompts import EVIDENCE_KINDS, next_record_id, utc_now, utc_today


def build_decision_record(
    store: dict,
    *,
    description: str,
    supporting_evidence: list[dict],
    date: str | None = None,
) -> dict:
    now = utc_now()
    return {
        "id": next_record_id(store, "decisions", "dec"),
        "createdAt": now,
        "updatedAt": now,
        "date": date or utc_today(),
        "description": description,
        "supportingEvidence": supporting_evidence,
    }


def build_investigation_record(
    store: dict,
    *,
    title: str,
    objective: str,
) -> dict:
    now = utc_now()
    return {
        "id": next_record_id(store, "investigations", "inv"),
        "createdAt": now,
        "updatedAt": now,
        "title": title,
        "status": "open",
        "objective": objective,
        "evidence": [],
    }


def build_parking_record(
    store: dict,
    *,
    title: str,
    reason_deferred: str,
) -> dict:
    now = utc_now()
    return {
        "id": next_record_id(store, "parkingLot", "park"),
        "createdAt": now,
        "updatedAt": now,
        "title": title,
        "reasonDeferred": reason_deferred,
        "status": "open",
    }


def build_risk_record(
    store: dict,
    *,
    description: str,
) -> dict:
    now = utc_now()
    return {
        "id": next_record_id(store, "risks", "risk"),
        "createdAt": now,
        "updatedAt": now,
        "description": description,
        "status": "open",
    }


def validate_evidence_reference(value: object, *, path: str) -> list[str]:
    errors: list[str] = []
    if not isinstance(value, dict):
        return [f"{path} must be an object."]

    ref = value.get("ref")
    if not isinstance(ref, str) or not ref.strip():
        errors.append(f"{path}.ref is required and must be a non-empty string.")

    kind = value.get("kind")
    if kind not in EVIDENCE_KINDS:
        errors.append(
            f"{path}.kind must be one of: {', '.join(sorted(EVIDENCE_KINDS))}."
        )

    if "summary" in value and value["summary"] is not None:
        if not isinstance(value["summary"], str):
            errors.append(f"{path}.summary must be a string when present.")

    extra = set(value) - {"ref", "kind", "summary"}
    if extra:
        errors.append(f"{path} contains unsupported keys: {', '.join(sorted(extra))}.")

    return errors
