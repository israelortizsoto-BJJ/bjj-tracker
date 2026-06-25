"""Shared data models and parsing helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

import pandas as pd

REQUIRED_COLUMNS = (
    "Project",
    "Task Name",
    "Start Date",
    "Finish Date",
    "Critical Date",
)
INFO_COLUMNS = list(REQUIRED_COLUMNS)


@dataclass(frozen=True)
class ColorStyle:
    fill: str
    font: str


@dataclass(frozen=True)
class CategoryRule:
    name: str
    patterns: tuple[str, ...]
    style: ColorStyle


@dataclass(frozen=True)
class PresentationTheme:
    header_fill: str
    header_font: str
    project_header_fill: str
    project_header_font: str
    month_header_fill: str
    month_header_font: str
    week_header_fill: str
    week_header_font: str
    grid_color: str
    alt_row_fill: str


@dataclass(frozen=True)
class WeekColumn:
    index: int
    start: date
    end: date
    month_key: tuple[int, int]


@dataclass(frozen=True)
class TaskRow:
    project: str
    task_name: str
    start_date: date
    finish_date: date
    critical_date: date | None


def parse_date(value: Any) -> date | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, pd.Timestamp):
        if pd.isna(value):
            return None
        return value.date()
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        parsed = pd.to_datetime(stripped, errors="coerce")
        if pd.isna(parsed):
            return None
        return parsed.date()
    return None
