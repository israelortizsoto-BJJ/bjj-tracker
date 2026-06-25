#!/usr/bin/env python3
"""Performance benchmarks for Timeline Builder."""

from __future__ import annotations

import resource
import sys
import time
import tracemalloc
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from models import TaskRow  # noqa: E402
from timeline_builder import (  # noqa: E402
    build_timeline,
    build_week_columns,
    build_workbook,
    group_tasks_by_project,
    load_config,
    read_schedule,
)

CONFIG = ROOT / "colors.yaml"
DATASETS = ROOT / "TEST_DATASETS"
OUT = ROOT / "benchmark_output"


def _peak_memory_mb() -> float:
    if not tracemalloc.is_tracing():
        return 0.0
    current, peak = tracemalloc.get_traced_memory()
    return peak / (1024 * 1024)


def _rss_mb() -> float:
    usage = resource.getrusage(resource.RUSAGE_SELF)
    # macOS reports ru_maxrss in bytes; Linux in kilobytes.
    if sys.platform == "darwin":
        return usage.ru_maxrss / (1024 * 1024)
    return usage.ru_maxrss / 1024


def _synthetic_tasks(count: int, projects: int = 10) -> list[TaskRow]:
    tasks: list[TaskRow] = []
    cursor = date(2026, 1, 6)
    for index in range(count):
        project = f"Project {(index % projects) + 1:02d}"
        start = cursor + timedelta(days=index % 21)
        finish = start + timedelta(days=3 + (index % 10))
        tasks.append(
            TaskRow(
                project=project,
                task_name=f"Task phase {index % 8}",
                start_date=start,
                finish_date=finish,
                critical_date=finish if index % 5 == 0 else None,
            )
        )
    return tasks


def benchmark_build(tasks: list[TaskRow], label: str) -> dict[str, float | int | str]:
    categories, critical, default, theme = load_config(CONFIG)
    weeks = build_week_columns(tasks)
    grouped = group_tasks_by_project(tasks)

    tracemalloc.start()
    start = time.perf_counter()
    workbook = build_workbook(grouped, weeks, categories, critical, default, theme)
    OUT.mkdir(exist_ok=True)
    output = OUT / f"bench_{label}.xlsx"
    workbook.save(output)
    elapsed = time.perf_counter() - start
    peak = _peak_memory_mb()
    tracemalloc.stop()

    size_kb = output.stat().st_size / 1024
    return {
        "label": label,
        "tasks": len(tasks),
        "projects": len(grouped),
        "weeks": len(weeks),
        "runtime_sec": round(elapsed, 3),
        "workbook_kb": round(size_kb, 1),
        "peak_memory_mb": round(peak, 2),
        "rss_mb": round(_rss_mb(), 2),
        "output": str(output),
    }


def benchmark_file(path: Path) -> dict[str, float | int | str]:
    tracemalloc.start()
    start = time.perf_counter()
    output = OUT / f"bench_{path.stem}.xlsx"
    build_timeline(path, output, CONFIG)
    elapsed = time.perf_counter() - start
    peak = _peak_memory_mb()
    tracemalloc.stop()
    return {
        "label": path.stem,
        "tasks": "file",
        "runtime_sec": round(elapsed, 3),
        "workbook_kb": round(output.stat().st_size / 1024, 1),
        "peak_memory_mb": round(peak, 2),
        "rss_mb": round(_rss_mb(), 2),
        "output": str(output),
    }


def main() -> None:
    results: list[dict] = []
    for count in (20, 100, 500, 1000):
        results.append(benchmark_build(_synthetic_tasks(count), f"{count}_tasks"))

    for name in (
        "A_small_3projects_20tasks.csv",
        "B_medium_10projects_100tasks.csv",
        "C_large_30projects_515tasks.csv",
    ):
        path = DATASETS / name
        if path.exists():
            results.append(benchmark_file(path))

    print("label\ttasks\truntime_sec\tworkbook_kb\tpeak_memory_mb\trss_mb")
    for row in results:
        print(
            f"{row['label']}\t{row.get('tasks', '')}\t{row['runtime_sec']}\t"
            f"{row['workbook_kb']}\t{row['peak_memory_mb']}\t{row['rss_mb']}"
        )


if __name__ == "__main__":
    main()
