"""
Shared deployment utilities for timeline-builder/google-sheets-live.

Repository validation, clasp execution, remote verification, and report formatting.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Literal

REPO_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = REPO_ROOT / "timeline-builder" / "google-sheets-live"
MANIFEST_PATH = PROJECT_ROOT / "deployment.manifest.json"
DEFAULT_MANIFEST = MANIFEST_PATH
CLASP_CONFIG_PATH = PROJECT_ROOT / ".clasp.json"
CLASP_EXAMPLE_PATH = PROJECT_ROOT / "clasp.json.example"
REPORTS_DIR = PROJECT_ROOT / "deployment-reports"

PASS = "\u2713"
FAIL = "\u2717"


@dataclass
class FileCheck:
    name: str
    ok: bool
    detail: str = ""


@dataclass
class ValidationResult:
    ready: bool
    checks: list[FileCheck] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    manifest: dict = field(default_factory=dict)
    file_count: int = 0


@dataclass
class VerificationResult:
    ok: bool
    repository_files: int
    apps_script_files: int
    repository_names: set[str] = field(default_factory=set)
    apps_script_names: set[str] = field(default_factory=set)
    missing_on_remote: set[str] = field(default_factory=set)
    extra_on_remote: set[str] = field(default_factory=set)
    errors: list[str] = field(default_factory=list)

    @property
    def match_label(self) -> Literal["MATCH", "MISMATCH"]:
        return "MATCH" if self.ok else "MISMATCH"


@dataclass
class DeploymentReport:
    repository_revision: str
    manifest_version: int
    started_at: datetime
    finished_at: datetime | None = None
    apps_script_project_id: str = ""
    validation: ValidationResult | None = None
    verification: VerificationResult | None = None
    deploy_succeeded: bool = False
    errors: list[str] = field(default_factory=list)
    certification_label: Literal["PASS", "FAIL"] = "FAIL"

    @property
    def certification(self) -> Literal["PASS", "FAIL"]:
        return self.certification_label


def load_manifest(manifest_path: Path = MANIFEST_PATH) -> dict:
    if not manifest_path.is_file():
        raise FileNotFoundError(f"Manifest not found: {manifest_path}")
    with manifest_path.open(encoding="utf-8") as handle:
        return json.load(handle)


def ordered_required_files(manifest: dict) -> list[str]:
    required = manifest.get("requiredFiles", [])
    order = manifest.get("deploymentOrder", [])
    manifest_files = manifest.get("manifestFiles", [])

    names: list[str] = []
    for name in order:
        if name in required and name not in names:
            names.append(name)
    for name in manifest_files:
        if name in required and name not in names:
            names.append(name)
    for name in required:
        if name not in names:
            names.append(name)
    return names


def validate_appsscript(project_root: Path, verification: dict) -> tuple[bool, str]:
    appsscript_cfg = verification.get("appsscript", {})
    rel_path = appsscript_cfg.get("path", "src/appsscript.json")
    manifest_path = project_root / rel_path

    if not manifest_path.is_file():
        return False, f"Missing {rel_path}"

    try:
        with manifest_path.open(encoding="utf-8") as handle:
            payload = json.load(handle)
    except json.JSONDecodeError as exc:
        return False, f"Invalid JSON in {rel_path}: {exc}"

    for key in appsscript_cfg.get("requiredKeys", []):
        if key not in payload:
            return False, f"{rel_path} missing required key: {key}"

    expected_runtime = appsscript_cfg.get("runtimeVersion")
    if expected_runtime and payload.get("runtimeVersion") != expected_runtime:
        actual = payload.get("runtimeVersion", "<unset>")
        return False, (
            f"{rel_path} runtimeVersion is {actual!r}, expected {expected_runtime!r}"
        )

    return True, ""


def check_duplicate_filenames(source_dir: Path) -> list[str]:
    if not source_dir.is_dir():
        return [f"Source directory not found: {source_dir}"]

    seen: dict[str, list[str]] = {}
    for path in source_dir.rglob("*"):
        if path.is_file():
            seen.setdefault(path.name, []).append(str(path.relative_to(source_dir)))

    return [
        f"Duplicate filename {name}: {', '.join(locations)}"
        for name, locations in sorted(seen.items())
        if len(locations) > 1
    ]


def check_deployment_order(required_files: list[str], deployment_order: list[str]) -> list[str]:
    errors: list[str] = []
    script_files = [name for name in required_files if name.endswith(".gs")]

    missing_from_order = sorted(set(script_files) - set(deployment_order))
    if missing_from_order:
        errors.append(
            "deploymentOrder missing script files: " + ", ".join(missing_from_order)
        )

    extra_in_order = sorted(set(deployment_order) - set(script_files))
    if extra_in_order:
        errors.append(
            "deploymentOrder lists files not in requiredFiles: "
            + ", ".join(extra_in_order)
        )

    return errors


def validate_repository(manifest_path: Path = MANIFEST_PATH) -> ValidationResult:
    project_root = manifest_path.parent
    checks: list[FileCheck] = []
    errors: list[str] = []

    try:
        manifest = load_manifest(manifest_path)
    except FileNotFoundError as exc:
        return ValidationResult(ready=False, errors=[str(exc)])

    source_dir = project_root / manifest.get("source", "src")
    required_files = manifest.get("requiredFiles", [])
    deployment_order = manifest.get("deploymentOrder", [])
    verification = manifest.get("verification", {})

    if not required_files:
        errors.append("Manifest requiredFiles is empty")
    if not deployment_order:
        errors.append("Manifest deploymentOrder is empty")

    errors.extend(check_deployment_order(required_files, deployment_order))
    errors.extend(check_duplicate_filenames(source_dir))

    ready = True
    for name in ordered_required_files(manifest):
        path = source_dir / name
        if not path.is_file():
            checks.append(FileCheck(name=name, ok=False, detail=f"Missing {name}"))
            ready = False
            continue

        if name == "appsscript.json":
            ok, detail = validate_appsscript(project_root, verification)
            checks.append(FileCheck(name=name, ok=ok, detail=detail))
            if not ok:
                ready = False
            continue

        checks.append(FileCheck(name=name, ok=True))

    if errors:
        ready = False

    return ValidationResult(
        ready=ready and not errors,
        checks=checks,
        errors=errors,
        manifest=manifest,
        file_count=len(required_files),
    )


def format_validation_output(result: ValidationResult) -> str:
    lines = ["Deployment Validation", ""]
    for check in result.checks:
        if check.ok:
            lines.append(f"{PASS} {check.name}")
        else:
            lines.append(f"{FAIL} {check.detail or f'Missing {check.name}'}")

    for message in result.errors:
        lines.append(f"{FAIL} {message}")

    lines.extend(["", "Status:"])
    lines.append("READY FOR DEPLOYMENT" if result.ready else "NOT READY")
    return "\n".join(lines)


def git_revision() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=REPO_ROOT,
            text=True,
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown"


def load_clasp_config(config_path: Path = CLASP_CONFIG_PATH) -> dict:
    if not config_path.is_file():
        raise FileNotFoundError(
            f"Missing {config_path.relative_to(REPO_ROOT)}. "
            f"Copy {CLASP_EXAMPLE_PATH.name} to .clasp.json and set scriptId."
        )
    with config_path.open(encoding="utf-8") as handle:
        return json.load(handle)


def clasp_executable() -> list[str]:
    local_bin = PROJECT_ROOT / "node_modules" / ".bin" / "clasp"
    if local_bin.is_file():
        return [str(local_bin)]
    return ["npx", "--yes", "@google/clasp"]


def run_clasp(args: list[str], cwd: Path = PROJECT_ROOT) -> subprocess.CompletedProcess[str]:
    command = [*clasp_executable(), *args]
    return subprocess.run(
        command,
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
    )


def ensure_clasp_ready() -> tuple[bool, str]:
    if not CLASP_CONFIG_PATH.is_file():
        return False, (
            f"Missing .clasp.json in {PROJECT_ROOT.relative_to(REPO_ROOT)}. "
            "Copy clasp.json.example and set scriptId."
        )

    config = load_clasp_config()
    if not config.get("scriptId"):
        return False, ".clasp.json is missing scriptId"

    local_bin = PROJECT_ROOT / "node_modules" / ".bin" / "clasp"
    if not local_bin.is_file():
        return False, (
            "clasp is not installed. Run: "
            f"npm install --prefix {PROJECT_ROOT.relative_to(REPO_ROOT)}"
        )

    status = run_clasp(["login", "--status"])
    if status.returncode != 0:
        detail = (status.stderr or status.stdout or "").strip()
        return False, (
            "clasp is not authenticated. Run: "
            f"npm install --prefix {PROJECT_ROOT.relative_to(REPO_ROOT)} && "
            f"npm exec --prefix {PROJECT_ROOT.relative_to(REPO_ROOT)} -- clasp login"
            + (f" ({detail})" if detail else "")
        )

    return True, ""


def clasp_push() -> tuple[bool, str]:
    result = run_clasp(["push", "--force"])
    output = "\n".join(part.strip() for part in [result.stdout, result.stderr] if part.strip())
    if result.returncode != 0:
        return False, output or "clasp push failed"
    return True, output or "clasp push succeeded"


def remote_deployable_names(script_id: str) -> tuple[set[str], list[str]]:
    errors: list[str] = []
    with tempfile.TemporaryDirectory(prefix="clasp-verify-") as tmp:
        tmp_path = Path(tmp)
        clasp_config = {"scriptId": script_id, "rootDir": "."}
        (tmp_path / ".clasp.json").write_text(json.dumps(clasp_config), encoding="utf-8")

        result = run_clasp(["pull", "--force"], cwd=tmp_path)
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "").strip()
            errors.append(detail or "clasp pull failed")
            return set(), errors

        names = {
            path.name
            for path in tmp_path.iterdir()
            if path.is_file() and path.suffix in {".gs", ".json"}
        }
        return names, errors


def verify_deployment(
    manifest_path: Path = MANIFEST_PATH,
    script_id: str | None = None,
) -> VerificationResult:
    manifest = load_manifest(manifest_path)
    required_names = set(manifest.get("requiredFiles", []))

    if script_id is None:
        clasp_config = load_clasp_config()
        script_id = clasp_config.get("scriptId", "")

    if not script_id:
        return VerificationResult(
            ok=False,
            repository_files=len(required_names),
            apps_script_files=0,
            repository_names=required_names,
            errors=["Missing Apps Script project id in .clasp.json"],
        )

    remote_names, pull_errors = remote_deployable_names(script_id)
    if pull_errors:
        return VerificationResult(
            ok=False,
            repository_files=len(required_names),
            apps_script_files=len(remote_names),
            repository_names=required_names,
            apps_script_names=remote_names,
            errors=pull_errors,
        )

    missing_on_remote = required_names - remote_names
    extra_on_remote = remote_names - required_names
    ok = (
        not missing_on_remote
        and not extra_on_remote
        and len(required_names) == len(remote_names)
    )

    return VerificationResult(
        ok=ok,
        repository_files=len(required_names),
        apps_script_files=len(remote_names),
        repository_names=required_names,
        apps_script_names=remote_names,
        missing_on_remote=missing_on_remote,
        extra_on_remote=extra_on_remote,
    )


def format_verification_output(result: VerificationResult) -> str:
    lines = [
        "Deployment Verification",
        "",
        f"Repository Files    {result.repository_files}",
        f"Apps Script Files   {result.apps_script_files}",
        f"Result              {result.match_label}",
        "",
    ]

    if result.missing_on_remote:
        lines.append("Missing on Apps Script:")
        for name in sorted(result.missing_on_remote):
            lines.append(f"  {FAIL} {name}")
        lines.append("")

    if result.extra_on_remote:
        lines.append("Extra on Apps Script:")
        for name in sorted(result.extra_on_remote):
            lines.append(f"  {FAIL} {name}")
        lines.append("")

    for message in result.errors:
        lines.append(f"{FAIL} {message}")

    lines.extend(["Status:", "VERIFIED" if result.ok else "NOT VERIFIED"])
    return "\n".join(lines)


def format_deployment_report(report: DeploymentReport) -> str:
    finished = report.finished_at or datetime.now()
    verification = report.verification
    validation = report.validation
    match_label = verification.match_label if verification else "SKIPPED"
    repo_count = (
        verification.repository_files
        if verification
        else (validation.file_count if validation else 0)
    )
    remote_count = verification.apps_script_files if verification else 0

    lines = [
        "Deployment Report",
        "",
        "Repository Revision",
        report.repository_revision,
        "",
        "Manifest Version",
        str(report.manifest_version),
        "",
        "Deployment Started",
        "",
        report.started_at.strftime("%H:%M:%S"),
        "",
        "Deployment Finished",
        "",
        finished.strftime("%H:%M:%S"),
        "",
        "Apps Script Project",
        "",
        report.apps_script_project_id or "<unknown>",
        "",
        "Verification",
        "",
        "Repository Files",
        "",
        str(repo_count),
        "",
        "Apps Script Files",
        "",
        str(remote_count),
        "",
        "Result",
        "",
        match_label,
        "",
        "Certification",
        "",
        report.certification,
    ]

    if report.errors:
        lines.extend(["", "Errors:"])
        lines.extend(f"  {FAIL} {error}" for error in report.errors)

    return "\n".join(lines)


def compute_certification(
    *,
    validation: ValidationResult,
    verification: VerificationResult | None,
    deploy_succeeded: bool,
    verify_only: bool = False,
    dry_run: bool = False,
) -> Literal["PASS", "FAIL"]:
    if not validation.ready:
        return "FAIL"
    if dry_run:
        return "FAIL"
    if verify_only:
        return "PASS" if verification and verification.ok else "FAIL"
    if not deploy_succeeded:
        return "FAIL"
    if not verification or not verification.ok:
        return "FAIL"
    return "PASS"


def write_report_artifact(report: DeploymentReport) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    finished = report.finished_at or datetime.now()
    stamp = finished.strftime("%Y%m%d-%H%M%S")
    artifact_path = REPORTS_DIR / f"deployment-{stamp}.txt"
    artifact_path.write_text(format_deployment_report(report) + "\n", encoding="utf-8")
    return artifact_path


def report_relative_path(artifact_path: Path) -> str:
    try:
        return str(artifact_path.relative_to(REPO_ROOT))
    except ValueError:
        return str(artifact_path)
