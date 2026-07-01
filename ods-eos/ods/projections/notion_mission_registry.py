"""Notion projection for Mission Registry."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

from ods.mission_registry import MissionRegistry, MissionRegistryError

NOTION_VERSION = "2022-06-28"


def _notion_request(method: str, path: str, token: str, body: dict | None = None) -> dict:
    url = f"https://api.notion.com/v1{path}"
    payload = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(
        url,
        data=payload,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise MissionRegistryError(f"Notion API {method} {path} failed ({exc.code}): {detail}") from exc


def _rich_text(content: str) -> list[dict]:
    if not content:
        return []
    chunks: list[dict] = []
    text = content
    while text:
        chunk = text[:2000]
        text = text[2000:]
        chunks.append({"type": "text", "text": {"content": chunk}})
    return chunks


def _eos_event_count(eos_text: str) -> int:
    return sum(1 for line in eos_text.splitlines() if line.startswith("- `"))


def _eos_metadata_summary(row: dict) -> str:
    latest_eos = row.get("latestEos", "")
    if not latest_eos:
        return "Engineering evidence available in mission page."
    count = _eos_event_count(latest_eos)
    suffix = f"{count} events" if count else "event history"
    return f"Collapsed in mission page: Engineering Evidence ({suffix})."


def _mission_registry_schema() -> dict:
    return {
        "Mission": {"title": {}},
        "Mission ID": {"rich_text": {}},
        "Status": {
            "select": {
                "options": [
                    {"name": "Active", "color": "green"},
                    {"name": "Closed", "color": "gray"},
                ]
            }
        },
        "Current Objective": {"rich_text": {}},
        "Operational Posture": {
            "select": {
                "options": [
                    {"name": "Executing", "color": "green"},
                    {"name": "Paused", "color": "yellow"},
                    {"name": "Completed", "color": "gray"},
                    {"name": "Ready to Resume", "color": "blue"},
                    {"name": "Blocked", "color": "red"},
                ]
            }
        },
        "Latest Event": {"rich_text": {}},
        "Latest EOS": {"rich_text": {}},
        "Last Updated": {"date": {}},
    }


def create_mission_registry_database(parent_page_id: str, token: str) -> str:
    body = {
        "parent": {"type": "page_id", "page_id": parent_page_id},
        "title": [{"type": "text", "text": {"content": "Mission Registry"}}],
        "properties": _mission_registry_schema(),
    }
    result = _notion_request("POST", "/databases", token, body)
    return result["id"]


def _notion_page_properties(row: dict) -> dict:
    return {
        "Mission": {"title": [{"text": {"content": row["label"]}}]},
        "Mission ID": {"rich_text": _rich_text(row["missionId"])},
        "Status": {"select": {"name": row["status"]}},
        "Current Objective": {"rich_text": _rich_text(row["currentObjective"])},
        "Operational Posture": {"select": {"name": row["operationalIntent"]}},
        "Latest Event": {"rich_text": _rich_text(row["latestEvent"])},
        "Latest EOS": {"rich_text": _rich_text(_eos_metadata_summary(row))},
        "Last Updated": {"date": {"start": row["lastUpdated"][:10]}},
    }


def _query_by_mission_id(database_id: str, token: str, mission_id: str) -> str | None:
    body = {
        "filter": {
            "property": "Mission ID",
            "rich_text": {"equals": mission_id},
        }
    }
    result = _notion_request("POST", f"/databases/{database_id}/query", token, body)
    results = result.get("results", [])
    if not results:
        return None
    return results[0]["id"]


def upsert_registry_row(database_id: str, token: str, row: dict) -> str:
    properties = _notion_page_properties(row)
    page_id = _query_by_mission_id(database_id, token, row["missionId"])

    if page_id:
        _notion_request("PATCH", f"/pages/{page_id}", token, {"properties": properties})
        return page_id

    body = {
        "parent": {"database_id": database_id},
        "properties": properties,
    }
    result = _notion_request("POST", "/pages", token, body)
    return result["id"]


def sync_registry_to_notion(registry: MissionRegistry, *, init: bool = False) -> list[str]:
    token = os.environ.get("NOTION_API_KEY", "").strip()
    if not token:
        raise MissionRegistryError(
            "NOTION_API_KEY is required to sync Mission Registry. "
            "Set it in your environment and re-run: ods-eos proof"
        )

    database_id = os.environ.get("NOTION_MISSION_REGISTRY_DATABASE_ID", "").strip()
    if init or not database_id:
        parent_page_id = os.environ.get("NOTION_PARENT_PAGE_ID", "").strip()
        if not parent_page_id:
            raise MissionRegistryError(
                "NOTION_MISSION_REGISTRY_DATABASE_ID or NOTION_PARENT_PAGE_ID is required. "
                "Use `ods-eos proof --init-notion` with NOTION_PARENT_PAGE_ID."
            )
        database_id = create_mission_registry_database(parent_page_id, token)
        print(f"Created Mission Registry database: {database_id}")
        print("Save this as NOTION_MISSION_REGISTRY_DATABASE_ID")

    page_ids: list[str] = []
    for row in registry.registry_rows():
        page_ids.append(upsert_registry_row(database_id, token, row))
    return page_ids
