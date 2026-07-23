#!/usr/bin/env python3
"""Deterministic formatter and verifier for certified architecture documents.

Codex/GPT owns architecture reasoning and document content. This DOCOPS writer
only normalizes formatting and verifies repository-owned structural invariants.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CERT_DIR = REPO_ROOT / "docs" / "architecture" / "certification"

OWNED_FILES = (
    "CertifiedArchitectureRegister-v1.md",
    "CERTIFICATION_HISTORY.md",
    "protected-systems-register.md",
    "active-investigation-register.md",
    "SharedMatchMedia-ArchitectureDecision-v1.md",
    "SharedMatchMedia-CertifiedBoundaries-v1.md",
    "SharedMatchMedia-ServiceContracts-v1.md",
    "SharedMatchMedia-ProductionVerificationService-Contract-v1.md",
)

REQUIRED_TEXT = {
    "CertifiedArchitectureRegister-v1.md": (
        "Shared Match Media Architecture",
        "CERTIFIED — architecture and contracts only",
        "PlaybackCoordinator",
        "FilmRoomSessionCoordinator",
        "SharedMatchMedia-ServiceContracts-v1.md",
        "SharedMatchMedia-ProductionVerificationService-Contract-v1.md",
        "DESIGN CERTIFIED — RUNTIME NOT IMPLEMENTED",
    ),
    "CERTIFICATION_HISTORY.md": (
        "Shared Match Media Architecture v1 — Architecture and Contracts",
        "upload/resolve proof of concept remains future work",
        "Production Verification Service — Contract and State-Machine Design v1",
        "DESIGN CERTIFIED — RUNTIME NOT IMPLEMENTED",
    ),
    "protected-systems-register.md": (
        "Parent Competition Match Media Attachment Authority",
        "Shared Match Media Binary Authority",
        "Match Media Resolution Boundary",
        "PlaybackCoordinator Authority",
        "FilmRoomSessionCoordinator Authority",
        "Shared Match Media Service Ownership",
        "Shared Match Media Production Verification Design",
        "DESIGN CERTIFIED — RUNTIME NOT IMPLEMENTED",
    ),
    "active-investigation-register.md": (
        "Shared Match Media Production Corridor",
        "FUTURE PROOF — NOT IMPLEMENTED",
        "SharedMatchMedia-ServiceContracts-v1.md",
        "SharedMatchMedia-ProductionVerificationService-Contract-v1.md",
        "DESIGN CERTIFIED — RUNTIME NOT IMPLEMENTED",
    ),
    "SharedMatchMedia-ArchitectureDecision-v1.md": (
        "CERTIFIED — Shared Match Media Architecture v1",
        "## Required Proof",
        "Parent Competition authority controls the canonical Match attachment.",
        "Neither `file://` URIs nor short-lived resolved URLs enter synchronized domain artifacts.",
        "PlaybackCoordinator and Session ownership do not change.",
        "SharedMatchMedia-ProductionVerificationService-Contract-v1.md",
        "upload_complete",
    ),
    "SharedMatchMedia-CertifiedBoundaries-v1.md": (
        "Film Room is not a media ownership system.",
        "Only an authorized, resolved playable URI crosses",
        "PlaybackCoordinator",
        "Session",
        "## 9. Change-control rule",
    ),
    "SharedMatchMedia-ServiceContracts-v1.md": (
        "CERTIFIED — service ownership and backend contracts only",
        "## 12. Failure ownership",
        "Each failure has one recovery owner.",
        "## 13. Operational architecture metrics",
        "No Shared Match Media service may:",
        "PlaybackCoordinator",
        "FilmRoomSessionCoordinator",
        "Implementation readiness | CONDITIONAL PASS",
        "SharedMatchMedia-ProductionVerificationService-Contract-v1.md",
        "upload_complete → verifying → verified | rejected | failed",
    ),
    "SharedMatchMedia-ProductionVerificationService-Contract-v1.md": (
        "DESIGN CERTIFIED — RUNTIME NOT IMPLEMENTED",
        "upload_complete → verifying → verified | rejected | failed",
        "SHARED_MATCH_MEDIA_VERIFICATION_ENABLED",
        "publicationEligible",
        "Required Proof #5",
        "isolated",
        "NOT IMPLEMENTED",
        "Never owns",
    ),
}


class ValidationError(Exception):
    pass


def normalize(content: str) -> str:
    lines = [line.rstrip() for line in content.replace("\r\n", "\n").split("\n")]
    while lines and not lines[-1]:
        lines.pop()
    return "\n".join(lines) + "\n"


def verify_history_newest_first(content: str) -> None:
    dates = re.findall(r"^## (\d{4}-\d{2}-\d{2})$", content, re.MULTILINE)
    if dates != sorted(dates, reverse=True):
        raise ValidationError("CERTIFICATION_HISTORY.md is not newest-first.")


def verify_shared_media_contract(content: str) -> None:
    prohibited = re.findall(r"(?<!`)\bfile://[^\s`]*", content)
    if prohibited:
        raise ValidationError(
            "Certified contract contains a synchronized/local file path value."
        )
    if "PlaybackCoordinator changes." not in content:
        raise ValidationError("PlaybackCoordinator protection is missing.")
    if "Session changes." not in content:
        raise ValidationError("Session protection is missing.")


def verify_file(name: str, content: str) -> None:
    if content != normalize(content):
        raise ValidationError(f"{name} is not deterministically formatted.")
    for token in REQUIRED_TEXT[name]:
        if token not in content:
            raise ValidationError(f"{name} is missing required text: {token}")
    if name == "CERTIFICATION_HISTORY.md":
        verify_history_newest_first(content)
    if name == "SharedMatchMedia-ArchitectureDecision-v1.md":
        verify_shared_media_contract(content)
    if name == "SharedMatchMedia-ServiceContracts-v1.md":
        verify_service_contract(content)


def verify_service_contract(content: str) -> None:
    services = (
        "Upload Service",
        "Verification Service",
        "Publication Service",
        "Resolution Service",
        "Storage Service",
        "Projection Service",
    )
    for service in services:
        if service not in content:
            raise ValidationError(f"Service contract is missing {service}.")
    if "No service in this sequence starts, pauses, replays, synchronizes, or seeks media." not in content:
        raise ValidationError("Service contract does not protect runtime authority.")


def load_owned() -> dict[str, str]:
    documents: dict[str, str] = {}
    for name in OWNED_FILES:
        path = CERT_DIR / name
        if not path.is_file():
            raise ValidationError(f"Missing owned document: {path}")
        documents[name] = path.read_text(encoding="utf-8")
    return documents


def write_documents(documents: dict[str, str]) -> None:
    for name, content in documents.items():
        path = CERT_DIR / name
        path.write_text(normalize(content), encoding="utf-8")
        print(f"wrote {path}")


def verify_documents(documents: dict[str, str]) -> None:
    for name, content in documents.items():
        verify_file(name, content)
        print(f"verified {CERT_DIR / name}")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Format and verify MatMind architecture certification documents."
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verify without writing.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        documents = load_owned()
        if not args.verify:
            write_documents(documents)
            documents = load_owned()
        verify_documents(documents)
        return 0
    except ValidationError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
