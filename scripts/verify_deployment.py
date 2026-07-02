#!/usr/bin/env python3
"""
Verify deployed Apps Script files match the repository manifest.

Requires clasp authentication and .clasp.json in timeline-builder/google-sheets-live/.
"""

from __future__ import annotations

import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from deployment_lib import (
    DEFAULT_MANIFEST,
    VerificationResult,
    ensure_clasp_ready,
    format_verification_output,
    validate_repository,
    verify_deployment,
)


def main() -> None:
    manifest_arg = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_MANIFEST

    validation = validate_repository(manifest_arg)
    if not validation.ready:
        print(format_verification_output(
            VerificationResult(
                ok=False,
                repository_files=validation.file_count,
                apps_script_files=0,
                errors=["Repository validation failed — run validate_deployment.py"],
            )
        ))
        raise SystemExit(1)

    clasp_ok, clasp_error = ensure_clasp_ready()
    if not clasp_ok:
        print(format_verification_output(
            VerificationResult(
                ok=False,
                repository_files=validation.file_count,
                apps_script_files=0,
                errors=[clasp_error],
            )
        ))
        raise SystemExit(1)

    result = verify_deployment(manifest_arg)
    print(format_verification_output(result))
    raise SystemExit(0 if result.ok else 1)


if __name__ == "__main__":
    main()
