"""Founder command center — daily console report."""

from pathlib import Path

from ods.config import get_eod_dir, get_store_path
from ods.generators.today import render_today
from ods.knowledge_store import load_store


def run_today(path: Path | None = None) -> None:
    store = load_store(path or get_store_path())
    print(render_today(store, eod_dir=get_eod_dir()), end="")
