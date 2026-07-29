#!/usr/bin/env python3
"""Engineering Closeout Pipeline — Version 1.

Proven surface only:
  - preview / apply
  - Checkpoint writer integration
  - Engineering Daily writer integration
  - Dev Handoff ordering integration
  - Architecture certification verification (no cert writes)

GPT supplies structured content. Python validates, writes, and verifies.
Push is prohibited.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import write_architecture_certification as arch_writer
import write_engineering_checkpoint as checkpoint_writer
import write_engineering_daily as daily_writer
from dev_handoff_ordering import update_handoff, verify_newest_first

REPO_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_VERSION = "engineering-closeout.v1"

CANONICAL_MARKERS = (
    "docs/ENGINEERING_OS.md",
    "docs/documentation-governance.md",
    "docs/engineering-checkpoint.md",
    "docs/engineering-daily.md",
    "docs/dev-handoff.md",
)

DEFAULT_PROTECTED_PATH_PREFIXES = (
    "timeline-builder/",
    "debug-logs/",
    "ods-eos/",
)

# Version 1: only triggers already proven by fixture + tests.
TRIGGER_TO_PATH = {
    "engineering_checkpoint": "docs/engineering-checkpoint.md",
    "engineering_daily": "docs/engineering-daily.md",
    "dev_handoff": "docs/dev-handoff.md",
}

ALL_TRIGGERS = tuple(TRIGGER_TO_PATH.keys())

ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class CloseoutError(Exception):
    """Fail-closed closeout error."""


@dataclass
class ProposedChange:
    trigger: str
    path: str
    before: str
    after: str

    @property
    def changed(self) -> bool:
        return self.before != self.after


@dataclass
class CloseoutPlan:
    input_model: dict[str, Any]
    triggers: dict[str, Any]
    proposed: list[ProposedChange] = field(default_factory=list)
    skipped_triggers: list[str] = field(default_factory=list)


def run_git(args: list[str], *, cwd: Path = REPO_ROOT) -> str:
    return subprocess.check_output(
        ["git", *args],
        cwd=cwd,
        text=True,
    ).rstrip("\n")


def require_repo_root(root: Path) -> None:
    for marker in CANONICAL_MARKERS:
        path = root / marker
        if not path.is_file():
            raise CloseoutError(
                f"Repository root is wrong or incomplete; missing {marker}"
            )


def validate_iso_date(value: str, field: str) -> str:
    if not isinstance(value, str) or not ISO_DATE_RE.match(value):
        raise CloseoutError(f"Field '{field}' must be ISO YYYY-MM-DD.")
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise CloseoutError(f"Field '{field}' is not a valid calendar date.") from exc
    return value


def _require_nonempty_string(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise CloseoutError(f"Field '{field}' must be a non-empty string.")
    return value.strip()


def _require_string_list(value: Any, field: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise CloseoutError(f"Field '{field}' must be a list of strings.")
    items: list[str] = []
    for index, item in enumerate(value):
        if not isinstance(item, str) or not item.strip():
            raise CloseoutError(f"Field '{field}[{index}]' must be a non-empty string.")
        items.append(item.strip())
    return items


def _require_object(value: Any, field: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise CloseoutError(f"Field '{field}' must be an object.")
    return value


def load_input(path: str) -> Any:
    if path == "-":
        return json.load(sys.stdin)
    input_path = Path(path)
    if not input_path.is_file():
        raise CloseoutError(f"Input file not found: {path}")
    return json.loads(input_path.read_text(encoding="utf-8"))


def validate_trigger_payload(
    name: str, obj: dict[str, Any], *, closeout_date: str
) -> dict[str, Any]:
    if name == "engineering_checkpoint":
        model = obj.get("model")
        if model is None:
            raise CloseoutError("engineering_checkpoint requires 'model'.")
        validated = checkpoint_writer.validate_model(model)
        if validated["date"] != closeout_date:
            raise CloseoutError(
                "engineering_checkpoint.model.date must match closeout_date."
            )
        snapshot = obj.get("repository_snapshot")
        if snapshot is not None:
            snap_obj = _require_object(
                snapshot, "engineering_checkpoint.repository_snapshot"
            )
            snapshot = {
                "status_sb": _require_nonempty_string(
                    snap_obj.get("status_sb"),
                    "engineering_checkpoint.repository_snapshot.status_sb",
                ),
                "log": _require_nonempty_string(
                    snap_obj.get("log"),
                    "engineering_checkpoint.repository_snapshot.log",
                ),
                "diff_stat": _require_nonempty_string(
                    snap_obj.get("diff_stat"),
                    "engineering_checkpoint.repository_snapshot.diff_stat",
                ),
            }
        return {"enabled": True, "model": validated, "repository_snapshot": snapshot}

    if name == "engineering_daily":
        model = obj.get("model")
        if model is None:
            raise CloseoutError("engineering_daily requires 'model'.")
        validated = daily_writer.validate_model(model)
        if validated["date"] != closeout_date:
            raise CloseoutError(
                "engineering_daily.model.date must match closeout_date."
            )
        return {"enabled": True, "model": validated}

    if name == "dev_handoff":
        session_markdown = _require_nonempty_string(
            obj.get("session_markdown"), "dev_handoff.session_markdown"
        )
        session_date = obj.get("session_date", closeout_date)
        session_date = validate_iso_date(str(session_date), "dev_handoff.session_date")
        if not session_markdown.lstrip().startswith("# DEV HANDOFF"):
            raise CloseoutError(
                "dev_handoff.session_markdown must start with '# DEV HANDOFF'."
            )
        return {
            "enabled": True,
            "session_markdown": session_markdown.rstrip() + "\n",
            "session_date": session_date,
        }

    raise CloseoutError(f"Unsupported trigger: {name}")


def validate_closeout_input(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise CloseoutError("Closeout input must be a JSON object.")

    schema = raw.get("schema_version")
    if schema != SCHEMA_VERSION:
        raise CloseoutError(
            f"schema_version must be '{SCHEMA_VERSION}' (got {schema!r})."
        )

    # Version 1 contract: only fields consumed by the pipeline.
    allowed_top = {
        "schema_version",
        "closeout_date",
        "expected_branch",
        "expected_head",
        "documentation_triggers",
        "architecture_verification",
        "protected_excluded_paths",
        "commit_authorization",
        "push_authorization",
    }
    unknown = sorted(set(raw.keys()) - allowed_top)
    if unknown:
        raise CloseoutError(f"Unknown or removed fields: {', '.join(unknown)}")

    required = (
        "closeout_date",
        "documentation_triggers",
        "architecture_verification",
        "protected_excluded_paths",
        "commit_authorization",
        "push_authorization",
    )
    missing = [field for field in required if field not in raw]
    if missing:
        raise CloseoutError(f"Missing required fields: {', '.join(missing)}")

    closeout_date = validate_iso_date(raw["closeout_date"], "closeout_date")

    if not isinstance(raw["commit_authorization"], bool):
        raise CloseoutError("Field 'commit_authorization' must be a boolean.")
    if not isinstance(raw["push_authorization"], bool):
        raise CloseoutError("Field 'push_authorization' must be a boolean.")
    if raw["push_authorization"] is True:
        raise CloseoutError("Push is prohibited in this Engineering Closeout pipeline.")
    if not isinstance(raw["architecture_verification"], bool):
        raise CloseoutError("Field 'architecture_verification' must be a boolean.")

    triggers_raw = _require_object(raw["documentation_triggers"], "documentation_triggers")
    unknown_triggers = sorted(set(triggers_raw.keys()) - set(ALL_TRIGGERS))
    if unknown_triggers:
        raise CloseoutError(
            f"Unknown documentation_triggers: {', '.join(unknown_triggers)}"
        )

    triggers: dict[str, Any] = {}
    for name in ALL_TRIGGERS:
        value = triggers_raw.get(name, {"enabled": False})
        if value is False or value is None:
            triggers[name] = {"enabled": False}
            continue
        if value is True:
            raise CloseoutError(
                f"documentation_triggers.{name}=true requires a payload object "
                "with enabled=true and writer fields."
            )
        obj = _require_object(value, f"documentation_triggers.{name}")
        enabled = obj.get("enabled", False)
        if not isinstance(enabled, bool):
            raise CloseoutError(
                f"documentation_triggers.{name}.enabled must be a boolean."
            )
        if not enabled:
            triggers[name] = {"enabled": False}
            continue
        triggers[name] = validate_trigger_payload(name, obj, closeout_date=closeout_date)

    expected_branch = raw.get("expected_branch")
    if expected_branch is not None:
        expected_branch = _require_nonempty_string(expected_branch, "expected_branch")
    expected_head = raw.get("expected_head")
    if expected_head is not None:
        expected_head = _require_nonempty_string(expected_head, "expected_head")

    return {
        "schema_version": SCHEMA_VERSION,
        "closeout_date": closeout_date,
        "expected_branch": expected_branch,
        "expected_head": expected_head,
        "documentation_triggers": triggers,
        "architecture_verification": raw["architecture_verification"],
        "protected_excluded_paths": _require_string_list(
            raw["protected_excluded_paths"], "protected_excluded_paths"
        ),
        "commit_authorization": raw["commit_authorization"],
        "push_authorization": False,
    }


def enforce_git_expectations(model: dict[str, Any], *, cwd: Path = REPO_ROOT) -> None:
    if model.get("expected_branch"):
        branch = run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=cwd)
        if branch != model["expected_branch"]:
            raise CloseoutError(
                f"Branch mismatch: expected {model['expected_branch']}, got {branch}"
            )
    if model.get("expected_head"):
        head = run_git(["rev-parse", "HEAD"], cwd=cwd)
        if head != model["expected_head"]:
            raise CloseoutError(
                f"HEAD mismatch: expected {model['expected_head']}, got {head}"
            )


def protected_prefixes(model: dict[str, Any]) -> tuple[str, ...]:
    extras = tuple(model.get("protected_excluded_paths") or [])
    return tuple(dict.fromkeys((*DEFAULT_PROTECTED_PATH_PREFIXES, *extras)))


def path_is_protected(rel_path: str, prefixes: tuple[str, ...]) -> bool:
    normalized = rel_path.replace("\\", "/").lstrip("./")
    for prefix in prefixes:
        clean = prefix.replace("\\", "/").lstrip("./")
        if not clean:
            continue
        if normalized == clean.rstrip("/") or normalized.startswith(clean):
            return True
    return False


def read_text(path: Path) -> str:
    if not path.is_file():
        raise CloseoutError(f"Required canonical file is missing: {path}")
    return path.read_text(encoding="utf-8")


def propose_checkpoint(
    model: dict[str, Any],
    existing: str,
    *,
    repository_snapshot: dict[str, str] | None = None,
) -> str:
    if repository_snapshot is not None:
        snapshot = repository_snapshot
    else:
        try:
            snapshot = checkpoint_writer.capture_repo_snapshot()
        except Exception:
            snapshot = {
                "status_sb": "(unavailable)",
                "log": "(unavailable)",
                "diff_stat": "(unavailable)",
            }
    updated = checkpoint_writer.build_document(existing, model, snapshot)
    checkpoint_writer.verify_document(updated)
    return updated


def propose_daily(model: dict[str, Any], existing: str) -> str:
    return daily_writer.proposed_document(model, existing=existing)


def propose_dev_handoff(
    session_markdown: str, session_date: str, existing: str
) -> str:
    updated = update_handoff(existing, session_markdown, session_date=session_date)
    if not verify_newest_first(updated):
        raise CloseoutError("Dev Handoff ordering verification failed.")
    return updated if updated.endswith("\n") else updated + "\n"


def build_plan(model: dict[str, Any], *, root: Path = REPO_ROOT) -> CloseoutPlan:
    require_repo_root(root)
    triggers = model["documentation_triggers"]
    plan = CloseoutPlan(input_model=model, triggers=triggers)

    for name in ALL_TRIGGERS:
        payload = triggers.get(name) or {"enabled": False}
        if not payload.get("enabled"):
            plan.skipped_triggers.append(name)
            continue

        rel = TRIGGER_TO_PATH[name]
        path = root / rel
        before = read_text(path)

        try:
            if name == "engineering_checkpoint":
                after = propose_checkpoint(
                    payload["model"],
                    before,
                    repository_snapshot=payload.get("repository_snapshot"),
                )
            elif name == "engineering_daily":
                after = propose_daily(payload["model"], before)
            elif name == "dev_handoff":
                after = propose_dev_handoff(
                    payload["session_markdown"],
                    payload["session_date"],
                    before,
                )
            else:
                raise CloseoutError(f"Unsupported trigger: {name}")
        except (checkpoint_writer.ValidationError, daily_writer.ValidationError) as exc:
            raise CloseoutError(f"Writer failed for {name}: {exc}") from exc

        plan.proposed.append(
            ProposedChange(trigger=name, path=rel, before=before, after=after)
        )

    return plan


def assert_no_protected_writes(
    plan: CloseoutPlan, model: dict[str, Any]
) -> None:
    prefixes = protected_prefixes(model)
    for change in plan.proposed:
        if not change.changed:
            continue
        if path_is_protected(change.path, prefixes):
            raise CloseoutError(
                f"Unauthorized path would change under protected scope: {change.path}"
            )


def run_architecture_verification(root: Path) -> None:
    original_cert_dir = arch_writer.CERT_DIR
    try:
        arch_writer.CERT_DIR = root / "docs" / "architecture" / "certification"
        documents = arch_writer.load_owned()
        arch_writer.verify_documents(documents)
    finally:
        arch_writer.CERT_DIR = original_cert_dir


def git_diff_check(paths: list[str], *, cwd: Path) -> None:
    if not paths:
        return
    try:
        subprocess.check_call(
            ["git", "diff", "--check", "--", *paths],
            cwd=cwd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
    except subprocess.CalledProcessError as exc:
        detail = ""
        if exc.stderr:
            detail = exc.stderr.decode("utf-8", errors="replace")
        raise CloseoutError(f"git diff --check failed.\n{detail}") from exc


def dirty_protected_paths(model: dict[str, Any], *, cwd: Path) -> list[str]:
    prefixes = protected_prefixes(model)
    status = run_git(["status", "--porcelain"], cwd=cwd)
    dirty: list[str] = []
    for line in status.splitlines():
        if not line.strip():
            continue
        path_part = line[3:]
        if " -> " in path_part:
            path_part = path_part.split(" -> ", 1)[1]
        path_part = path_part.strip().strip('"')
        if path_is_protected(path_part, prefixes):
            dirty.append(path_part)
    return dirty


def apply_plan(plan: CloseoutPlan, *, root: Path) -> list[str]:
    written: list[str] = []
    for change in plan.proposed:
        if not change.changed:
            continue
        target = root / change.path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(change.after, encoding="utf-8")
        written.append(change.path)

    for change in plan.proposed:
        if not change.changed:
            continue
        content = (root / change.path).read_text(encoding="utf-8")
        if change.trigger == "engineering_checkpoint":
            checkpoint_writer.verify_document(content)
        elif change.trigger == "engineering_daily":
            daily_writer.verify_document(content)
        elif change.trigger == "dev_handoff":
            if not verify_newest_first(content):
                raise CloseoutError(
                    "Dev Handoff newest-first verification failed after write."
                )

    if plan.input_model.get("architecture_verification"):
        try:
            run_architecture_verification(root)
        except arch_writer.ValidationError as exc:
            raise CloseoutError(f"Architecture verification failed: {exc}") from exc

    return written


def stage_and_maybe_commit(
    model: dict[str, Any],
    written: list[str],
    *,
    cwd: Path,
) -> None:
    if not model["commit_authorization"]:
        return
    if not written:
        return

    dirty_protected = dirty_protected_paths(model, cwd=cwd)
    if dirty_protected:
        raise CloseoutError(
            "Protected dirty work would be staged: " + ", ".join(dirty_protected)
        )

    subprocess.check_call(["git", "add", "--", *written], cwd=cwd)

    staged = run_git(["diff", "--cached", "--name-only"], cwd=cwd)
    staged_paths = [line for line in staged.splitlines() if line.strip()]
    if sorted(staged_paths) != sorted(written):
        subprocess.check_call(["git", "reset", "HEAD", "--", *staged_paths], cwd=cwd)
        raise CloseoutError(
            "Staging aborted: staged paths did not match owned closeout writes."
        )

    message = f"Record {model['closeout_date']} Engineering OS closeout."
    subprocess.check_call(["git", "commit", "-m", message], cwd=cwd)


def render_preview_report(plan: CloseoutPlan) -> str:
    lines = [
        "Engineering Closeout PREVIEW (v1)",
        f"schema_version: {plan.input_model['schema_version']}",
        f"closeout_date: {plan.input_model['closeout_date']}",
        f"architecture_verification: {plan.input_model['architecture_verification']}",
        f"enabled_triggers: {', '.join(c.trigger for c in plan.proposed) or '(none)'}",
        f"skipped_triggers: {', '.join(plan.skipped_triggers) or '(none)'}",
        "",
        "Proposed changed files:",
    ]
    changed = [c for c in plan.proposed if c.changed]
    if not changed:
        lines.append("  (none — no-op)")
    else:
        for change in changed:
            lines.append(f"  - {change.path} ({change.trigger})")
    lines.append("")
    lines.append("No writes, staging, commit, or push performed.")
    return "\n".join(lines)


def render_apply_report(plan: CloseoutPlan, written: list[str]) -> str:
    lines = [
        "Engineering Closeout APPLY (v1)",
        f"schema_version: {plan.input_model['schema_version']}",
        f"closeout_date: {plan.input_model['closeout_date']}",
        f"architecture_verification: {plan.input_model['architecture_verification']}",
        "",
        "Changed files:",
    ]
    if not written:
        lines.append("  (none — idempotent no-op)")
    else:
        for path in written:
            lines.append(f"  - {path}")
    lines.append("")
    if plan.input_model["commit_authorization"]:
        lines.append("Commit: authorized and attempted for owned files only.")
    else:
        lines.append("Commit: not authorized (writes only).")
    lines.append("Push: prohibited.")
    return "\n".join(lines)


def run_closeout(
    *,
    mode: str,
    input_model: dict[str, Any],
    root: Path = REPO_ROOT,
    enforce_git: bool = True,
    allow_commit: bool = True,
) -> tuple[CloseoutPlan, list[str]]:
    require_repo_root(root)
    model = validate_closeout_input(input_model)

    if enforce_git:
        enforce_git_expectations(model, cwd=root)

    plan = build_plan(model, root=root)
    assert_no_protected_writes(plan, model)

    if mode == "preview":
        return plan, []

    if mode != "apply":
        raise CloseoutError(f"Unknown mode: {mode}")

    written = apply_plan(plan, root=root)
    git_diff_check(written, cwd=root)

    if allow_commit and model["commit_authorization"]:
        stage_and_maybe_commit(model, written, cwd=root)
    elif model["commit_authorization"] and not allow_commit:
        raise CloseoutError("Commit authorization set but commit execution is disabled.")

    if model.get("push_authorization"):
        raise CloseoutError("Push is prohibited.")

    return plan, written


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Execute MatMind Engineering Closeout Version 1 (preview|apply)."
    )
    parser.add_argument(
        "--mode",
        choices=("preview", "apply"),
        required=True,
        help="preview validates and reports; apply writes verified files.",
    )
    parser.add_argument(
        "--input",
        dest="input_path",
        required=True,
        help="Path to GPT-authored closeout JSON, or '-' for stdin.",
    )
    parser.add_argument(
        "--repo-root",
        dest="repo_root",
        default=str(REPO_ROOT),
        help="Repository root (default: detected from script location).",
    )
    parser.add_argument(
        "--skip-git-expectations",
        action="store_true",
        help="Skip expected_branch/expected_head checks (test fixtures only).",
    )
    parser.add_argument(
        "--disable-commit",
        action="store_true",
        help="Refuse commit even if input authorizes it.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        root = Path(args.repo_root).resolve()
        raw = load_input(args.input_path)
        plan, written = run_closeout(
            mode=args.mode,
            input_model=raw,
            root=root,
            enforce_git=not args.skip_git_expectations,
            allow_commit=not args.disable_commit,
        )
        if args.mode == "preview":
            print(render_preview_report(plan))
            for change in plan.proposed:
                if change.changed:
                    print(f"WOULD_CHANGE\t{change.path}")
        else:
            print(render_apply_report(plan, written))
            for path in written:
                print(f"CHANGED\t{path}")
        return 0
    except (
        CloseoutError,
        checkpoint_writer.ValidationError,
        daily_writer.ValidationError,
        arch_writer.ValidationError,
        json.JSONDecodeError,
        subprocess.CalledProcessError,
        OSError,
    ) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
