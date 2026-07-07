"""Deterministic promoted doctrine storage."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


class DoctrineError(Exception):
    """Doctrine promotion failure."""


DOCS_DIR = Path("docs/doctrine")

SECTION_TITLES = {
    "always-read": "Always Read",
    "engineering-doctrine": "Engineering Doctrine",
    "founder-doctrine": "Founder Doctrine",
    "communication-doctrine": "Communication Doctrine",
    "python-doctrine": "Python Doctrine",
    "product-doctrine": "Product Doctrine",
    "decision-register": "Decision Register",
    "parking-lot": "Parking Lot",
}

ALLOWED_SECTIONS = frozenset(SECTION_TITLES)


@dataclass(frozen=True)
class PromotionResult:
    section: str
    text: str
    timestamp: str
    doctrine_path: Path
    decision_register_path: Path
    doctrine_updated: bool
    decision_register_updated: bool


def promote_knowledge(section: str, text: str, *, now: str | None = None) -> PromotionResult:
    section = _normalize_section(section)
    text = _normalize_text(text)
    timestamp = now or _utc_now()
    doctrine_path = section_path(section)
    decision_path = section_path("decision-register")

    doctrine_updated = append_section_entry(doctrine_path, section, text, timestamp)
    decision_updated = append_decision_register(decision_path, section, text, timestamp)

    return PromotionResult(
        section=section,
        text=text,
        timestamp=timestamp,
        doctrine_path=doctrine_path,
        decision_register_path=decision_path,
        doctrine_updated=doctrine_updated,
        decision_register_updated=decision_updated,
    )


def section_path(section: str) -> Path:
    section = _normalize_section(section)
    return DOCS_DIR / f"{section}.md"


def load_section_entries(section: str) -> list[str]:
    path = section_path(section)
    if not path.exists():
        return []
    entries = []
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped.startswith("- "):
            continue
        entries.append(_entry_text(stripped[2:]))
    return [entry for entry in entries if entry]


def load_decision_entries() -> list[dict[str, str]]:
    path = section_path("decision-register")
    if not path.exists():
        return []
    entries = []
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped.startswith("- "):
            continue
        parts = [part.strip() for part in stripped[2:].split("|", 2)]
        if len(parts) != 3:
            continue
        entries.append({"timestamp": parts[0], "section": parts[1], "text": parts[2]})
    return entries


def append_section_entry(path: Path, section: str, text: str, timestamp: str) -> bool:
    ensure_section_file(path, section)
    existing = {_canonical(entry) for entry in load_section_entries(section)}
    if _canonical(text) in existing:
        return False
    with path.open("a", encoding="utf-8") as handle:
        handle.write(f"- {text} _(promoted: {timestamp})_\n")
    return True


def append_decision_register(path: Path, section: str, text: str, timestamp: str) -> bool:
    ensure_section_file(path, "decision-register")
    existing = {
        (_canonical(entry["section"]), _canonical(entry["text"]))
        for entry in load_decision_entries()
    }
    key = (_canonical(section), _canonical(text))
    if key in existing:
        return False
    with path.open("a", encoding="utf-8") as handle:
        handle.write(f"- {timestamp} | {section} | {text}\n")
    return True


def remove_section_entry(section: str, text: str) -> None:
    path = section_path(section)
    if not path.exists():
        return
    target = _canonical(text)
    lines = path.read_text(encoding="utf-8").splitlines()
    kept = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("- ") and _canonical(_entry_text(stripped[2:])) == target:
            continue
        kept.append(line)
    path.write_text("\n".join(kept).rstrip() + "\n", encoding="utf-8")


def remove_decision_entry(section: str, text: str) -> None:
    path = section_path("decision-register")
    if not path.exists():
        return
    target = (_canonical(section), _canonical(text))
    lines = path.read_text(encoding="utf-8").splitlines()
    kept = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("- "):
            parts = [part.strip() for part in stripped[2:].split("|", 2)]
            if len(parts) == 3 and (_canonical(parts[1]), _canonical(parts[2])) == target:
                continue
        kept.append(line)
    path.write_text("\n".join(kept).rstrip() + "\n", encoding="utf-8")


def ensure_section_file(path: Path, section: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return
    title = SECTION_TITLES[_normalize_section(section)]
    path.write_text(f"# {title}\n\n", encoding="utf-8")


def _normalize_section(section: str) -> str:
    normalized = (section or "").strip().lower()
    if normalized not in ALLOWED_SECTIONS:
        allowed = ", ".join(sorted(ALLOWED_SECTIONS))
        raise DoctrineError(f"Unsupported section: {section!r}. Allowed sections: {allowed}")
    return normalized


def _normalize_text(text: str) -> str:
    normalized = " ".join((text or "").split())
    if not normalized:
        raise DoctrineError("Promotion text is required.")
    return normalized


def _entry_text(value: str) -> str:
    marker = " _(promoted:"
    if marker in value:
        return value.split(marker, 1)[0].strip()
    return value.strip()


def _canonical(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
