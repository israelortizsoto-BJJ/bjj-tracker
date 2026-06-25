"""Input validation and ValidationReport generation for Timeline Builder."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from pathlib import Path
from typing import Any

import pandas as pd

from models import REQUIRED_COLUMNS, TaskRow, parse_date

REPORT_FILENAME = "ValidationReport.json"
SCHEMA_VERSION = "1.0"


class IssueKind(str, Enum):
    ERROR = "error"
    WARNING = "warning"


@dataclass
class RowIssue:
    row_number: int
    kind: IssueKind
    reason: str
    values: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "row_number": self.row_number,
            "kind": self.kind.value,
            "reason": self.reason,
            "values": self.values,
        }


@dataclass
class ValidationReport:
    schema_version: str = SCHEMA_VERSION
    source_file: str = ""
    total_rows: int = 0
    valid_rows: int = 0
    skipped_rows: int = 0
    warning_count: int = 0
    error_count: int = 0
    issues: list[RowIssue] = field(default_factory=list)
    strict_mode: bool = False
    timeline_generated: bool = False

    @property
    def skipped(self) -> list[RowIssue]:
        return [issue for issue in self.issues if issue.kind == IssueKind.ERROR]

    @property
    def warnings(self) -> list[RowIssue]:
        return [issue for issue in self.issues if issue.kind == IssueKind.WARNING]

    def add_error(
        self,
        row_number: int,
        reason: str,
        values: dict[str, Any],
    ) -> None:
        self.issues.append(
            RowIssue(row_number, IssueKind.ERROR, reason, values)
        )
        self.error_count += 1
        self.skipped_rows += 1

    def add_warning(
        self,
        row_number: int,
        reason: str,
        values: dict[str, Any],
    ) -> None:
        self.issues.append(
            RowIssue(row_number, IssueKind.WARNING, reason, values)
        )
        self.warning_count += 1

    def finalize_counts(self) -> None:
        self.skipped_rows = self.error_count
        self.valid_rows = self.total_rows - self.skipped_rows

    def has_errors(self) -> bool:
        return self.error_count > 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "source_file": self.source_file,
            "total_rows": self.total_rows,
            "valid_rows": self.valid_rows,
            "skipped_rows": self.skipped_rows,
            "warning_count": self.warning_count,
            "error_count": self.error_count,
            "strict_mode": self.strict_mode,
            "timeline_generated": self.timeline_generated,
            "skipped": [issue.to_dict() for issue in self.skipped],
            "warnings": [issue.to_dict() for issue in self.warnings],
        }

    def save(self, path: Path) -> Path:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as handle:
            json.dump(self.to_dict(), handle, indent=2, default=_json_default)
            handle.write("\n")
        return path


def _json_default(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value)!r} is not JSON serializable")


def _is_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and pd.isna(value):
        return True
    if isinstance(value, pd.Timestamp) and pd.isna(value):
        return True
    if isinstance(value, str) and not value.strip():
        return True
    return False


def _serialize_value(value: Any) -> Any:
    if _is_missing(value):
        return None
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, pd.Timestamp):
        return None if pd.isna(value) else value.date().isoformat()
    if isinstance(value, float) and pd.isna(value):
        return None
    return str(value).strip()


def _row_values(row: pd.Series) -> dict[str, Any]:
    return {column: _serialize_value(row[column]) for column in REQUIRED_COLUMNS}


def _normalize_text(value: Any) -> str | None:
    if _is_missing(value):
        return None
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return None
    return text


def validate_and_normalize(
    frame: pd.DataFrame,
    *,
    source_file: str = "",
) -> tuple[list[TaskRow], ValidationReport]:
    report = ValidationReport(source_file=source_file, total_rows=len(frame))
    tasks: list[TaskRow] = []

    for index, row in frame.iterrows():
        row_number = int(index) + 2  # 1-based with header row
        values = _row_values(row)

        project = _normalize_text(row["Project"])
        if project is None:
            report.add_error(row_number, "missing_project", values)
            continue

        task_name = _normalize_text(row["Task Name"])
        if task_name is None:
            report.add_error(row_number, "missing_task_name", values)
            continue

        start_raw = row["Start Date"]
        finish_raw = row["Finish Date"]
        if _is_missing(start_raw):
            report.add_error(row_number, "missing_start_date", values)
            continue
        if _is_missing(finish_raw):
            report.add_error(row_number, "missing_finish_date", values)
            continue

        start_date = parse_date(start_raw)
        if start_date is None:
            report.add_error(row_number, "invalid_start_date", values)
            continue

        finish_date = parse_date(finish_raw)
        if finish_date is None:
            report.add_error(row_number, "invalid_finish_date", values)
            continue

        if finish_date < start_date:
            report.add_warning(
                row_number,
                "finish_before_start",
                {
                    **values,
                    "corrected_start_date": finish_date.isoformat(),
                    "corrected_finish_date": start_date.isoformat(),
                },
            )
            start_date, finish_date = finish_date, start_date

        critical_raw = row["Critical Date"]
        critical_date: date | None = None
        if not _is_missing(critical_raw):
            critical_date = parse_date(critical_raw)
            if critical_date is None:
                report.add_warning(row_number, "invalid_critical_date", values)

        tasks.append(
            TaskRow(
                project=project,
                task_name=task_name,
                start_date=start_date,
                finish_date=finish_date,
                critical_date=critical_date,
            )
        )

    report.finalize_counts()
    return tasks, report
