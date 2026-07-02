#!/usr/bin/env python3
"""
Certified deployment for timeline-builder/google-sheets-live.

Validate Repository → Deploy → Verify Deployment → Produce Certification Report
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from deployment_lib import (
    DEFAULT_MANIFEST,
    DeploymentReport,
    clasp_push,
    compute_certification,
    ensure_clasp_ready,
    format_deployment_report,
    format_validation_output,
    git_revision,
    load_clasp_config,
    report_relative_path,
    validate_repository,
    verify_deployment,
    write_report_artifact,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Certified deployment for Live Timeline Planner Apps Script",
    )
    parser.add_argument(
        "manifest",
        nargs="?",
        default=str(DEFAULT_MANIFEST),
        help="Path to deployment.manifest.json",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Run repository validation only (no clasp)",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Verify remote Apps Script matches repository (no push)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate repository and print report without deploying",
    )
    return parser.parse_args()


def certify(manifest_path: Path, *, validate_only: bool, verify_only: bool, dry_run: bool) -> int:
    started_at = datetime.now()
    errors: list[str] = []
    validation = validate_repository(manifest_path)
    manifest_version = int(validation.manifest.get("version", 0))

    print(format_validation_output(validation))
    print()

    if validate_only:
        return 0 if validation.ready else 1

    script_id = ""
    deploy_succeeded = False
    verification = None

    if validation.ready and not dry_run:
        clasp_ok, clasp_error = ensure_clasp_ready()
        if not clasp_ok:
            errors.append(clasp_error)
        else:
            script_id = load_clasp_config().get("scriptId", "")

            if verify_only:
                verification = verify_deployment(manifest_path, script_id=script_id)
            else:
                push_ok, push_detail = clasp_push()
                deploy_succeeded = push_ok
                if not push_ok:
                    errors.append(push_detail)
                else:
                    verification = verify_deployment(manifest_path, script_id=script_id)

            if verification and not verification.ok:
                if verification.missing_on_remote:
                    errors.append(
                        "Missing on Apps Script: "
                        + ", ".join(sorted(verification.missing_on_remote))
                    )
                if verification.extra_on_remote:
                    errors.append(
                        "Extra on Apps Script: "
                        + ", ".join(sorted(verification.extra_on_remote))
                    )
                for message in verification.errors:
                    errors.append(message)
    elif dry_run:
        errors.append("Dry run — deployment skipped")

    if not validation.ready:
        errors.append("Repository validation failed")

    finished_at = datetime.now()
    certification_label = compute_certification(
        validation=validation,
        verification=verification,
        deploy_succeeded=deploy_succeeded,
        verify_only=verify_only,
        dry_run=dry_run,
    )

    report = DeploymentReport(
        repository_revision=git_revision(),
        manifest_version=manifest_version,
        started_at=started_at,
        finished_at=finished_at,
        apps_script_project_id=script_id,
        validation=validation,
        verification=verification,
        deploy_succeeded=deploy_succeeded,
        errors=errors,
        certification_label=certification_label,
    )

    print(format_deployment_report(report))
    artifact = write_report_artifact(report)
    print()
    print(f"Report saved: {report_relative_path(artifact)}")

    return 0 if certification_label == "PASS" else 1


def main() -> None:
    args = parse_args()
    manifest_path = Path(args.manifest)
    raise SystemExit(
        certify(
            manifest_path,
            validate_only=args.validate_only,
            verify_only=args.verify_only,
            dry_run=args.dry_run,
        )
    )


if __name__ == "__main__":
    main()
