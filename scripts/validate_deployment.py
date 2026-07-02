#!/usr/bin/env python3
"""
Validate timeline-builder/google-sheets-live deployment readiness.

Repository-only checks — no Google APIs, no clasp, no Apps Script runtime.
"""

from __future__ import annotations

import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from deployment_lib import DEFAULT_MANIFEST, format_validation_output, validate_repository


def main() -> None:
    manifest_arg = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_MANIFEST
    result = validate_repository(manifest_arg)
    print(format_validation_output(result))
    raise SystemExit(0 if result.ready else 1)


if __name__ == "__main__":
    main()
