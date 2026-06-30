"""Shared interactive prompt helpers for ODS-EOS commands."""

from datetime import datetime, timezone

EVIDENCE_KINDS = frozenset({"file", "commit", "log", "url", "record"})


def utc_now() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def utc_today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def read_required(prompt: str) -> str:
    while True:
        try:
            value = input(prompt).strip()
        except EOFError:
            value = ""
        if value:
            return value
        print("  (required — please enter a value)")


def read_optional(prompt: str) -> str | None:
    try:
        value = input(prompt).strip()
    except EOFError:
        return None
    return value or None


def read_yes_no(prompt: str) -> bool:
    while True:
        value = read_optional(prompt)
        if value is None:
            return False
        normalized = value.lower()
        if normalized in {"y", "yes"}:
            return True
        if normalized in {"n", "no"}:
            return False
        print("  (answer y/n)")


def read_multiline(prompt: str) -> str:
    print(prompt)
    print("  (Enter a blank line when finished.)")
    lines: list[str] = []
    while True:
        try:
            line = input()
        except EOFError:
            break
        if not line.strip():
            break
        lines.append(line.rstrip())
    return "\n".join(lines).strip()


def read_evidence_kind() -> str:
    while True:
        kind = read_required(
            "  Kind (file, commit, log, url, record): "
        ).lower()
        if kind in EVIDENCE_KINDS:
            return kind
        print(f"  (must be one of: {', '.join(sorted(EVIDENCE_KINDS))})")


def read_evidence_references(*, minimum: int = 1) -> list[dict]:
    print(f"Supporting evidence (at least {minimum} required)")
    evidence: list[dict] = []

    while len(evidence) < minimum:
        print(f"  Evidence {len(evidence) + 1}:")
        ref = read_required("  Ref (path, commit, log, URL, or record id): ")
        kind = read_evidence_kind()
        summary = read_optional("  Summary (optional): ")
        entry: dict = {"ref": ref, "kind": kind}
        if summary:
            entry["summary"] = summary
        evidence.append(entry)

    while True:
        more = read_optional("  Add another evidence reference? (y/n): ")
        if not more or more.lower() not in {"y", "yes"}:
            break
        print(f"  Evidence {len(evidence) + 1}:")
        ref = read_required("  Ref (path, commit, log, URL, or record id): ")
        kind = read_evidence_kind()
        summary = read_optional("  Summary (optional): ")
        entry = {"ref": ref, "kind": kind}
        if summary:
            entry["summary"] = summary
        evidence.append(entry)

    return evidence


def next_record_id(store: dict, collection: str, prefix: str) -> str:
    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    id_prefix = f"{prefix}-{day}-"
    existing = sum(
        1
        for record in store[collection]
        if isinstance(record, dict) and record.get("id", "").startswith(id_prefix)
    )
    return f"{id_prefix}{existing + 1:03d}"
