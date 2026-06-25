#!/usr/bin/env python3
"""Generate realistic Smartsheet-style test datasets for Timeline Builder validation."""

from __future__ import annotations

import csv
import random
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "TEST_DATASETS"
COLUMNS = ["Project", "Task Name", "Start Date", "Finish Date", "Critical Date"]

PHASES = [
    ("Concepting", 5, 10),
    ("Pre Pro / Prep", 7, 14),
    ("Shoot", 3, 7),
    ("Edit / Post", 10, 21),
    ("VFX / Color", 7, 14),
    ("Client Review", 3, 5),
    ("Delivery", 2, 5),
    ("Air / Live", 1, 3),
    ("Planning", 5, 10),
    ("Approval", 2, 4),
]

PROJECT_PREFIXES = [
    "Brand Campaign",
    "Product Launch",
    "Social Content",
    "Documentary",
    "Retail Spot",
    "Internal Comms",
    "Event Coverage",
    "Training Series",
    "Partner Co-Marketing",
    "Seasonal Push",
]


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def _fmt(value: date | None) -> str:
    return value.isoformat() if value else ""


def _task_dates(
    rng: random.Random,
    cursor: date,
    phase: tuple[str, int, int],
) -> tuple[date, date, date | None]:
    name, min_days, max_days = phase
    duration = rng.randint(min_days, max_days)
    start = cursor
    finish = start + timedelta(days=duration - 1)
    critical: date | None = None
    if name in {"Client Review", "Delivery", "Air / Live", "Approval"}:
        critical = finish if rng.random() < 0.7 else None
    return start, finish, critical


def generate_project_tasks(
    rng: random.Random,
    project_name: str,
    task_count: int,
    start_anchor: date,
) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    cursor = start_anchor
    for index in range(task_count):
        phase = PHASES[index % len(PHASES)]
        start, finish, critical = _task_dates(rng, cursor, phase)
        rows.append(
            {
                "Project": project_name,
                "Task Name": f"{phase[0]} {index + 1}",
                "Start Date": _fmt(start),
                "Finish Date": _fmt(finish),
                "Critical Date": _fmt(critical),
            }
        )
        cursor = finish + timedelta(days=rng.randint(1, 4))
    return rows


def generate_small() -> None:
    rng = random.Random(42)
    rows: list[dict[str, str]] = []
    projects = ["Alpha Launch", "Beta Retail Spot", "Gamma Social Series"]
    for index, project in enumerate(projects):
        task_count = 7 if index < 2 else 6
        rows.extend(
            generate_project_tasks(
                rng,
                project,
                task_count,
                date(2026, 1, 6) + timedelta(days=index * 14),
            )
        )
    write_csv(OUT / "A_small_3projects_20tasks.csv", rows)


def generate_medium() -> None:
    rng = random.Random(99)
    rows: list[dict[str, str]] = []
    for index in range(10):
        project = f"{PROJECT_PREFIXES[index % len(PROJECT_PREFIXES)]} {2026 + index // 5}"
        rows.extend(
            generate_project_tasks(
                rng,
                project,
                10,
                date(2026, 1, 6) + timedelta(days=index * 10),
            )
        )
    write_csv(OUT / "B_medium_10projects_100tasks.csv", rows)


def generate_large() -> None:
    rng = random.Random(777)
    rows: list[dict[str, str]] = []
    for index in range(30):
        project = f"{PROJECT_PREFIXES[index % len(PROJECT_PREFIXES)]} Program {index + 1:02d}"
        task_count = 17 if index < 29 else 18
        rows.extend(
            generate_project_tasks(
                rng,
                project,
                task_count,
                date(2025, 6, 2) + timedelta(days=index * 7),
            )
        )
    write_csv(OUT / "C_large_30projects_515tasks.csv", rows)


def generate_edge_cases() -> None:
    rows: list[dict[str, str]] = [
        {
            "Project": "Edge Case Suite",
            "Task Name": "Valid baseline",
            "Start Date": "2026-01-06",
            "Finish Date": "2026-01-10",
            "Critical Date": "",
        },
        {
            "Project": "Edge Case Suite",
            "Task Name": "Missing start date",
            "Start Date": "",
            "Finish Date": "2026-01-15",
            "Critical Date": "",
        },
        {
            "Project": "Edge Case Suite",
            "Task Name": "Missing finish date",
            "Start Date": "2026-01-20",
            "Finish Date": "",
            "Critical Date": "",
        },
        {
            "Project": "Edge Case Suite",
            "Task Name": "Invalid date strings",
            "Start Date": "not-a-date",
            "Finish Date": "also-bad",
            "Critical Date": "???",
        },
        {
            "Project": "Edge Case Suite",
            "Task Name": "Duplicate task name",
            "Start Date": "2026-02-01",
            "Finish Date": "2026-02-05",
            "Critical Date": "",
        },
        {
            "Project": "Edge Case Suite",
            "Task Name": "Duplicate task name",
            "Start Date": "2026-02-10",
            "Finish Date": "2026-02-14",
            "Critical Date": "2026-02-14",
        },
        {
            "Project": "Duplicate Project Name",
            "Task Name": "First block task",
            "Start Date": "2026-03-01",
            "Finish Date": "2026-03-07",
            "Critical Date": "",
        },
        {
            "Project": "Other Program",
            "Task Name": "Spacer task",
            "Start Date": "2026-03-10",
            "Finish Date": "2026-03-14",
            "Critical Date": "",
        },
        {
            "Project": "Duplicate Project Name",
            "Task Name": "Second block task",
            "Start Date": "2026-03-20",
            "Finish Date": "2026-03-28",
            "Critical Date": "",
        },
        {
            "Project": "Multi Month Span",
            "Task Name": "Cross month edit",
            "Start Date": "2026-01-20",
            "Finish Date": "2026-03-15",
            "Critical Date": "",
        },
        {
            "Project": "Year Boundary",
            "Task Name": "Dec to Jan shoot",
            "Start Date": "2025-12-15",
            "Finish Date": "2026-01-10",
            "Critical Date": "2026-01-10",
        },
        {
            "Project": "Duration Edge Cases",
            "Task Name": "One day task",
            "Start Date": "2026-04-01",
            "Finish Date": "2026-04-01",
            "Critical Date": "",
        },
        {
            "Project": "Duration Edge Cases",
            "Task Name": "Zero duration same day",
            "Start Date": "2026-04-02",
            "Finish Date": "2026-04-02",
            "Critical Date": "2026-04-02",
        },
        {
            "Project": "Duration Edge Cases",
            "Task Name": "Inverted dates",
            "Start Date": "2026-04-20",
            "Finish Date": "2026-04-10",
            "Critical Date": "",
        },
        {
            "Project": "Critical Only Window",
            "Task Name": "Critical outside task range",
            "Start Date": "2026-05-01",
            "Finish Date": "2026-05-07",
            "Critical Date": "2026-06-01",
        },
        {
            "Project": "Critical Only Window",
            "Task Name": "Critical milestone only",
            "Start Date": "2026-05-10",
            "Finish Date": "2026-05-14",
            "Critical Date": "2026-05-12",
        },
        {
            "Project": "",
            "Task Name": "Blank project row",
            "Start Date": "2026-05-20",
            "Finish Date": "2026-05-24",
            "Critical Date": "",
        },
        {
            "Project": "Blank Task Row",
            "Task Name": "",
            "Start Date": "2026-05-25",
            "Finish Date": "2026-05-29",
            "Critical Date": "",
        },
        {
            "Project": "Whitespace Only",
            "Task Name": "   ",
            "Start Date": "2026-06-01",
            "Finish Date": "2026-06-05",
            "Critical Date": "",
        },
        {
            "Project": "Color Ambiguity",
            "Task Name": "Post shoot review",
            "Start Date": "2026-06-10",
            "Finish Date": "2026-06-14",
            "Critical Date": "",
        },
        {
            "Project": "Color Ambiguity",
            "Task Name": "Live editorial cut",
            "Start Date": "2026-06-15",
            "Finish Date": "2026-06-19",
            "Critical Date": "",
        },
    ]

    path = OUT / "D_edge_cases.csv"
    write_csv(path, rows)

    # Extra unexpected columns variant (written manually for read_schedule test)
    extra_path = OUT / "D_edge_cases_extra_columns.csv"
    with extra_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            COLUMNS + ["Assigned To", "Status", "Notes", "Smartsheet ID"]
        )
        for row in rows[:8]:
            writer.writerow(
                [
                    row["Project"],
                    row["Task Name"],
                    row["Start Date"],
                    row["Finish Date"],
                    row["Critical Date"],
                    "Owner",
                    "In Progress",
                    "Extra column data",
                    "SS-001",
                ]
            )


def main() -> None:
    generate_small()
    generate_medium()
    generate_large()
    generate_edge_cases()
    print(f"Wrote datasets to {OUT}")


if __name__ == "__main__":
    main()
