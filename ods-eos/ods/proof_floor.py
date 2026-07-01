"""Founder Proof Floor orchestration."""

from __future__ import annotations

import os
from pathlib import Path

from ods.mission_registry import MissionRegistry, MissionRegistryError
from ods.projections.notion_mission_registry import sync_registry_to_notion

ProofFloorError = MissionRegistryError


def _load_dotenv() -> None:
    env_path = Path(".env")
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def run_proof_floor(
    *,
    dataset_paths: list[Path],
    store_dir: Path,
    sync_notion: bool = True,
    init_notion: bool = False,
) -> dict:
    _load_dotenv()

    registry = MissionRegistry.from_dataset_paths(dataset_paths)
    registry.project(store_dir / "eos")
    paths = registry.save(store_dir)

    notion_pages: list[str] = []
    if sync_notion:
        notion_pages = sync_registry_to_notion(registry, init=init_notion)

    return {
        **paths,
        "registry": registry,
        "missions": [mission.to_dict() for mission in registry.missions.values()],
        "notionPages": notion_pages,
    }
