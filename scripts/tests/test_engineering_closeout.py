#!/usr/bin/env python3
"""Bounded tests for Engineering Closeout Version 1."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
REPO_ROOT = SCRIPTS.parent
sys.path.insert(0, str(SCRIPTS))

import run_engineering_closeout as closeout
import write_engineering_daily as daily
import write_engineering_checkpoint as checkpoint


FIXTURE = SCRIPTS / "fixtures" / "engineering-closeout-os-v1.1.example.json"

CANONICAL_COPY = (
    "docs/ENGINEERING_OS.md",
    "docs/documentation-governance.md",
    "docs/engineering-checkpoint.md",
    "docs/engineering-daily.md",
    "docs/dev-handoff.md",
    "docs/architecture/certification/CERTIFICATION_HISTORY.md",
    "docs/architecture/certification/CertifiedArchitectureRegister-v1.md",
    "docs/architecture/certification/protected-systems-register.md",
    "docs/architecture/certification/active-investigation-register.md",
    "docs/architecture/certification/SharedMatchMedia-ArchitectureDecision-v1.md",
    "docs/architecture/certification/SharedMatchMedia-CertifiedBoundaries-v1.md",
    "docs/architecture/certification/SharedMatchMedia-ServiceContracts-v1.md",
    "docs/architecture/certification/SharedMatchMedia-ProductionVerificationService-Contract-v1.md",
)


def load_fixture() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def make_temp_repo() -> Path:
    tmp = Path(tempfile.mkdtemp(prefix="closeout-fixture-"))
    for rel in CANONICAL_COPY:
        src = REPO_ROOT / rel
        dest = tmp / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)

    dirty = tmp / "timeline-builder" / "google-sheets-live" / "src" / "Constants.gs"
    dirty.parent.mkdir(parents=True, exist_ok=True)
    dirty.write_text("// protected unrelated dirty\n", encoding="utf-8")
    debug = tmp / "debug-logs" / "corridor-qa" / "note.txt"
    debug.parent.mkdir(parents=True, exist_ok=True)
    debug.write_text("do not touch\n", encoding="utf-8")

    subprocess.check_call(["git", "init"], cwd=tmp, stdout=subprocess.DEVNULL)
    subprocess.check_call(
        ["git", "config", "user.email", "closeout-test@example.com"],
        cwd=tmp,
    )
    subprocess.check_call(
        ["git", "config", "user.name", "Closeout Test"],
        cwd=tmp,
    )
    subprocess.check_call(["git", "add", "docs"], cwd=tmp, stdout=subprocess.DEVNULL)
    subprocess.check_call(
        ["git", "commit", "-m", "seed"],
        cwd=tmp,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return tmp


class SchemaValidationTests(unittest.TestCase):
    def test_fixture_validates(self):
        model = closeout.validate_closeout_input(load_fixture())
        self.assertEqual(model["schema_version"], closeout.SCHEMA_VERSION)
        self.assertEqual(model["closeout_date"], "2026-07-29")
        self.assertTrue(model["architecture_verification"])

    def test_invalid_schema_version(self):
        raw = load_fixture()
        raw["schema_version"] = "nope"
        with self.assertRaises(closeout.CloseoutError):
            closeout.validate_closeout_input(raw)

    def test_push_authorization_rejected(self):
        raw = load_fixture()
        raw["push_authorization"] = True
        with self.assertRaises(closeout.CloseoutError):
            closeout.validate_closeout_input(raw)

    def test_true_trigger_without_payload_rejected(self):
        raw = load_fixture()
        raw["documentation_triggers"]["engineering_daily"] = True
        with self.assertRaises(closeout.CloseoutError):
            closeout.validate_closeout_input(raw)

    def test_removed_triggers_rejected(self):
        raw = load_fixture()
        raw["documentation_triggers"]["product_roadmap"] = {"enabled": False}
        with self.assertRaises(closeout.CloseoutError):
            closeout.validate_closeout_input(raw)

    def test_dead_fields_rejected(self):
        raw = load_fixture()
        raw["missions"] = [{"summary": "x", "owner": "Cursor"}]
        with self.assertRaises(closeout.CloseoutError):
            closeout.validate_closeout_input(raw)


class TriggerMappingTests(unittest.TestCase):
    def test_trigger_to_document_mapping(self):
        self.assertEqual(
            set(closeout.TRIGGER_TO_PATH),
            {
                "engineering_checkpoint",
                "engineering_daily",
                "dev_handoff",
            },
        )
        self.assertEqual(
            closeout.TRIGGER_TO_PATH["engineering_daily"],
            "docs/engineering-daily.md",
        )

    def test_no_trigger_no_write(self):
        raw = load_fixture()
        for name in closeout.ALL_TRIGGERS:
            raw["documentation_triggers"][name] = {"enabled": False}
        raw["architecture_verification"] = False
        tmp = make_temp_repo()
        try:
            before = {
                rel: (tmp / rel).read_text(encoding="utf-8")
                for rel in (
                    "docs/engineering-daily.md",
                    "docs/engineering-checkpoint.md",
                    "docs/dev-handoff.md",
                )
            }
            plan, written = closeout.run_closeout(
                mode="apply",
                input_model=raw,
                root=tmp,
                enforce_git=False,
            )
            self.assertEqual(written, [])
            self.assertEqual(plan.proposed, [])
            for rel, text in before.items():
                self.assertEqual((tmp / rel).read_text(encoding="utf-8"), text)
        finally:
            shutil.rmtree(tmp)


class DailyWriterTests(unittest.TestCase):
    def test_duplicate_date_protection(self):
        model = {
            "date": "2099-01-01",
            "primary_objective": "First",
            "repository_floor": ["floor"],
            "completed_outcomes": ["one"],
            "evidence_and_certification_movement": "none",
            "stops_and_remaining_unknowns": ["stop"],
            "protected_and_unrelated_scopes": ["none"],
            "next_authorized_mission": "next",
        }
        existing = daily.PERMANENT_HEADER + "\n" + daily.render_entry(model)
        differing = {**model, "primary_objective": "Changed"}
        with self.assertRaises(daily.ValidationError):
            daily.build_document(existing, differing)

    def test_newest_first_ordering(self):
        older = {
            "date": "2099-01-01",
            "primary_objective": "Older",
            "repository_floor": ["floor"],
            "completed_outcomes": ["one"],
            "evidence_and_certification_movement": "none",
            "stops_and_remaining_unknowns": ["stop"],
            "protected_and_unrelated_scopes": ["none"],
            "next_authorized_mission": "next",
        }
        newer = {**older, "date": "2099-01-02", "primary_objective": "Newer"}
        doc = daily.build_document(daily.PERMANENT_HEADER, older)
        doc = daily.build_document(doc, newer)
        daily.verify_document(doc)
        _, entries = daily.split_document(doc)
        self.assertEqual(daily.entry_date(entries[0]), "2099-01-02")
        self.assertEqual(daily.entry_date(entries[1]), "2099-01-01")

    def test_idempotent_identical_rewrite(self):
        model = {
            "date": "2099-02-01",
            "primary_objective": "Same",
            "repository_floor": ["floor"],
            "completed_outcomes": ["one"],
            "evidence_and_certification_movement": "none",
            "stops_and_remaining_unknowns": ["stop"],
            "protected_and_unrelated_scopes": ["none"],
            "next_authorized_mission": "next",
        }
        first = daily.build_document(daily.PERMANENT_HEADER, model)
        second = daily.build_document(first, model)
        self.assertEqual(first, second)


class PreviewApplyTests(unittest.TestCase):
    def test_preview_versus_apply(self):
        raw = load_fixture()
        raw.pop("expected_branch", None)
        raw.pop("expected_head", None)
        tmp = make_temp_repo()
        try:
            daily_before = (tmp / "docs/engineering-daily.md").read_text(encoding="utf-8")
            plan, written = closeout.run_closeout(
                mode="preview",
                input_model=raw,
                root=tmp,
                enforce_git=False,
            )
            self.assertEqual(written, [])
            self.assertTrue(any(c.changed for c in plan.proposed))
            self.assertEqual(
                (tmp / "docs/engineering-daily.md").read_text(encoding="utf-8"),
                daily_before,
            )

            _, written2 = closeout.run_closeout(
                mode="apply",
                input_model=raw,
                root=tmp,
                enforce_git=False,
            )
            self.assertIn("docs/engineering-daily.md", written2)
            self.assertIn("docs/engineering-checkpoint.md", written2)
            self.assertIn("docs/dev-handoff.md", written2)
            daily.verify_document(
                (tmp / "docs/engineering-daily.md").read_text(encoding="utf-8")
            )
            checkpoint.verify_document(
                (tmp / "docs/engineering-checkpoint.md").read_text(encoding="utf-8")
            )
            self.assertIn("## 2026-07-29", (tmp / "docs/engineering-daily.md").read_text())
        finally:
            shutil.rmtree(tmp)

    def test_idempotent_second_pass(self):
        raw = load_fixture()
        raw.pop("expected_branch", None)
        raw.pop("expected_head", None)
        tmp = make_temp_repo()
        try:
            closeout.run_closeout(
                mode="apply", input_model=raw, root=tmp, enforce_git=False
            )
            after_first = {
                rel: (tmp / rel).read_text(encoding="utf-8")
                for rel in (
                    "docs/engineering-daily.md",
                    "docs/engineering-checkpoint.md",
                    "docs/dev-handoff.md",
                )
            }
            plan, written = closeout.run_closeout(
                mode="apply", input_model=raw, root=tmp, enforce_git=False
            )
            self.assertEqual(written, [])
            for change in plan.proposed:
                self.assertFalse(change.changed, change.path)
            for rel, text in after_first.items():
                self.assertEqual((tmp / rel).read_text(encoding="utf-8"), text)
        finally:
            shutil.rmtree(tmp)

    def test_protected_paths_untouched(self):
        raw = load_fixture()
        raw.pop("expected_branch", None)
        raw.pop("expected_head", None)
        tmp = make_temp_repo()
        try:
            protected = tmp / "timeline-builder/google-sheets-live/src/Constants.gs"
            debug = tmp / "debug-logs/corridor-qa/note.txt"
            before_p = protected.read_text(encoding="utf-8")
            before_d = debug.read_text(encoding="utf-8")
            closeout.run_closeout(
                mode="apply", input_model=raw, root=tmp, enforce_git=False
            )
            self.assertEqual(protected.read_text(encoding="utf-8"), before_p)
            self.assertEqual(debug.read_text(encoding="utf-8"), before_d)
        finally:
            shutil.rmtree(tmp)

    def test_unauthorized_commit_prevention(self):
        raw = load_fixture()
        raw.pop("expected_branch", None)
        raw.pop("expected_head", None)
        raw["commit_authorization"] = False
        tmp = make_temp_repo()
        try:
            head_before = subprocess.check_output(
                ["git", "rev-parse", "HEAD"], cwd=tmp, text=True
            ).strip()
            closeout.run_closeout(
                mode="apply", input_model=raw, root=tmp, enforce_git=False
            )
            head_after = subprocess.check_output(
                ["git", "rev-parse", "HEAD"], cwd=tmp, text=True
            ).strip()
            self.assertEqual(head_before, head_after)
            staged = subprocess.check_output(
                ["git", "diff", "--cached", "--name-only"], cwd=tmp, text=True
            ).strip()
            self.assertEqual(staged, "")
        finally:
            shutil.rmtree(tmp)

    def test_failed_writer_stops(self):
        raw = load_fixture()
        raw.pop("expected_branch", None)
        raw.pop("expected_head", None)
        raw["documentation_triggers"]["engineering_daily"]["model"]["date"] = "2020-01-01"
        with self.assertRaises(closeout.CloseoutError):
            closeout.validate_closeout_input(raw)

    def test_branch_mismatch_fails_closed(self):
        raw = load_fixture()
        raw["expected_branch"] = "not-this-branch"
        with self.assertRaises(closeout.CloseoutError):
            closeout.run_closeout(
                mode="preview",
                input_model=raw,
                root=REPO_ROOT,
                enforce_git=True,
            )


class ProtectedPathExclusionTests(unittest.TestCase):
    def test_path_is_protected(self):
        prefixes = ("timeline-builder/", "debug-logs/")
        self.assertTrue(
            closeout.path_is_protected(
                "timeline-builder/google-sheets-live/src/Constants.gs", prefixes
            )
        )
        self.assertTrue(closeout.path_is_protected("debug-logs/x.txt", prefixes))
        self.assertFalse(
            closeout.path_is_protected("docs/engineering-daily.md", prefixes)
        )


class AcceptanceFixtureTests(unittest.TestCase):
    def test_acceptance_preview_apply_idempotence_no_push(self):
        raw = load_fixture()
        raw.pop("expected_branch", None)
        raw.pop("expected_head", None)
        tmp = make_temp_repo()
        try:
            plan, _ = closeout.run_closeout(
                mode="preview", input_model=raw, root=tmp, enforce_git=False
            )
            proposed = [c.path for c in plan.proposed if c.changed]
            self.assertEqual(
                proposed,
                [
                    "docs/engineering-checkpoint.md",
                    "docs/engineering-daily.md",
                    "docs/dev-handoff.md",
                ],
            )

            _, written1 = closeout.run_closeout(
                mode="apply", input_model=raw, root=tmp, enforce_git=False
            )
            self.assertEqual(set(written1), set(proposed))

            after = {
                path: (tmp / path).read_text(encoding="utf-8") for path in written1
            }
            _, written2 = closeout.run_closeout(
                mode="apply", input_model=raw, root=tmp, enforce_git=False
            )
            self.assertEqual(written2, [])
            for path, text in after.items():
                self.assertEqual((tmp / path).read_text(encoding="utf-8"), text)

            self.assertEqual(
                (tmp / "timeline-builder/google-sheets-live/src/Constants.gs").read_text(),
                "// protected unrelated dirty\n",
            )
            self.assertEqual(
                (tmp / "debug-logs/corridor-qa/note.txt").read_text(),
                "do not touch\n",
            )

            remotes = subprocess.check_output(
                ["git", "remote"], cwd=tmp, text=True
            ).strip()
            self.assertEqual(remotes, "")
        finally:
            shutil.rmtree(tmp)


if __name__ == "__main__":
    unittest.main()
