"""Tests for the validation layer and ValidationReport."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
DATASETS = ROOT / "TEST_DATASETS"

import sys

sys.path.insert(0, str(ROOT))

from timeline_builder import read_schedule  # noqa: E402
from validation import ValidationReport, validate_and_normalize  # noqa: E402


class TestValidationReport:
    def test_skips_blank_project(self):
        frame = read_schedule(DATASETS / "D_edge_cases.csv")
        tasks, report = validate_and_normalize(frame, source_file="edge.csv")
        assert not any(task.project == "nan" for task in tasks)
        assert not any(task.task_name == "Blank project row" for task in tasks)
        reasons = {issue.reason for issue in report.skipped}
        assert "missing_project" in reasons

    def test_skips_missing_dates(self):
        frame = read_schedule(DATASETS / "D_edge_cases.csv")
        _, report = validate_and_normalize(frame)
        reasons = {issue.reason for issue in report.skipped}
        assert "missing_start_date" in reasons
        assert "missing_finish_date" in reasons
        assert "invalid_start_date" in reasons

    def test_finish_before_start_is_warning(self):
        frame = read_schedule(DATASETS / "D_edge_cases.csv")
        tasks, report = validate_and_normalize(frame)
        inverted = next(t for t in tasks if t.task_name == "Inverted dates")
        assert inverted.start_date <= inverted.finish_date
        assert any(w.reason == "finish_before_start" for w in report.warnings)

    def test_report_json_schema_fields(self, tmp_path):
        frame = read_schedule(DATASETS / "A_small_3projects_20tasks.csv")
        _, report = validate_and_normalize(frame, source_file="small.csv")
        path = tmp_path / "ValidationReport.json"
        report.save(path)
        payload = json.loads(path.read_text(encoding="utf-8"))
        assert payload["schema_version"] == "1.0"
        assert payload["total_rows"] == 20
        assert payload["valid_rows"] == 20
        assert payload["error_count"] == 0
        assert "skipped" in payload
        assert "warnings" in payload

    def test_skipped_rows_include_row_number_and_values(self):
        frame = read_schedule(DATASETS / "D_edge_cases.csv")
        _, report = validate_and_normalize(frame)
        assert report.skipped
        issue = report.skipped[0]
        assert issue.row_number >= 2
        assert issue.reason
        assert "Project" in issue.values


class TestStrictMode:
    def test_strict_aborts_on_errors(self, tmp_path):
        from timeline_builder import build_timeline

        result = build_timeline(
            DATASETS / "D_edge_cases.csv",
            tmp_path / "Timeline.xlsx",
            ROOT / "colors.yaml",
            strict=True,
            report_path=tmp_path / "ValidationReport.json",
        )
        assert result.output_path is None
        assert result.report.has_errors()
        assert not (tmp_path / "Timeline.xlsx").exists()
        assert (tmp_path / "ValidationReport.json").exists()

    def test_non_strict_generates_with_skips(self, tmp_path):
        from timeline_builder import build_timeline

        result = build_timeline(
            DATASETS / "D_edge_cases.csv",
            tmp_path / "Timeline.xlsx",
            ROOT / "colors.yaml",
            strict=False,
            report_path=tmp_path / "ValidationReport.json",
        )
        assert result.output_path is not None
        assert result.report.has_errors()
        assert result.report.timeline_generated

    def test_strict_cli_exit_code(self, tmp_path):
        from timeline_builder import main

        code = main(
            [
                str(DATASETS / "D_edge_cases.csv"),
                "-o",
                str(tmp_path / "Timeline.xlsx"),
                "--report",
                str(tmp_path / "ValidationReport.json"),
                "--strict",
            ]
        )
        assert code == 3
