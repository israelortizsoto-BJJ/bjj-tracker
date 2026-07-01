#!/usr/bin/env python3
"""One-time Notion Operating Surface setup — experience layer only.

Configures homepage, Mission Registry views, and mission page layouts
using the Notion Views API (2026-03-11). Does not modify ODS backend.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ods.operating_command import TodaysCommand, command_from_registry_doc

NOTION_VERSION_VIEWS = "2026-03-11"
NOTION_VERSION = "2025-09-03"
MISSION_REGISTRY_STATE = Path(__file__).resolve().parents[1] / ".ods-eos" / "mission-registry.json"

# Property IDs from Mission Registry data source
P = {
    "mission": "title",
    "status": "B%3D%3Ex",
    "last_updated": "DKPe",
    "latest_eos": "EsfG",
    "posture": "O%3Fmm",
    "objective": "peOW",
    "mission_id": "r%3D%7BC",
    "latest_event": "xc%3Fm",
}


def load_env() -> dict[str, str]:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    env: dict[str, str] = {}
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    for k in ("NOTION_API_KEY", "NOTION_MISSION_REGISTRY_DATABASE_ID", "NOTION_PARENT_PAGE_ID"):
        env.setdefault(k, os.environ.get(k, ""))
    return env


def notion(method: str, path: str, token: str, body: dict | None = None, *, version: str = NOTION_VERSION) -> dict:
    url = f"https://api.notion.com/v1{path}"
    payload = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        url,
        data=payload,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": version,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Notion {method} {path} ({exc.code}): {detail}") from exc


def props_visible(*ids: str) -> list[dict]:
    all_ids = [
        P["mission"],
        P["status"],
        P["posture"],
        P["latest_event"],
        P["last_updated"],
        P["latest_eos"],
        P["objective"],
        P["mission_id"],
    ]
    return [{"property_id": pid, "visible": pid in ids} for pid in all_ids]


def table_config(*visible: str) -> dict:
    return {"type": "table", "properties": props_visible(*visible)}


def list_config(*visible: str) -> dict:
    return {"type": "list", "properties": props_visible(*visible)}


def gallery_config(*visible: str) -> dict:
    return {"type": "gallery", "properties": props_visible(*visible), "card_layout": "compact"}


FILTER_ATTENTION = {
    "or": [
        {"property": "Operational Posture", "select": {"equals": "Blocked"}},
        {"property": "Operational Posture", "select": {"equals": "Paused"}},
        {"property": "Operational Posture", "select": {"equals": "Ready to Resume"}},
    ]
}

FILTER_EXECUTION = {
    "and": [
        {"property": "Status", "select": {"equals": "Active"}},
        {
            "or": [
                {"property": "Operational Posture", "select": {"equals": "Executing"}},
                {"property": "Operational Posture", "select": {"equals": "Ready to Resume"}},
            ]
        },
    ]
}

FILTER_TOP_PRIORITIES = {
    "property": "Status",
    "select": {"equals": "Active"},
}

FILTER_CLOSED = {
    "or": [
        {"property": "Status", "select": {"equals": "Closed"}},
        {"property": "Operational Posture", "select": {"equals": "Completed"}},
    ]
}

FILTER_CARRY = {
    "and": [
        {"property": "Status", "select": {"does_not_equal": "Closed"}},
        {"property": "Operational Posture", "select": {"does_not_equal": "Completed"}},
    ]
}

SORT_RECENT = [{"property": "Last Updated", "direction": "descending"}]


def create_registry_view(
    token: str,
    database_id: str,
    data_source_id: str,
    *,
    name: str,
    view_type: str,
    filter_obj: dict | None = None,
    sorts: list | None = None,
    configuration: dict | None = None,
    position: dict | None = None,
) -> dict:
    body: dict = {
        "database_id": database_id,
        "data_source_id": data_source_id,
        "name": name,
        "type": view_type,
    }
    if filter_obj is not None:
        body["filter"] = filter_obj
    if sorts is not None:
        body["sorts"] = sorts
    if configuration is not None:
        body["configuration"] = configuration
    if position is not None:
        body["position"] = position
    return notion("POST", "/views", token, body, version=NOTION_VERSION_VIEWS)


def create_linked_view(
    token: str,
    parent_page_id: str,
    data_source_id: str,
    *,
    name: str,
    view_type: str,
    filter_obj: dict | None = None,
    sorts: list | None = None,
    configuration: dict | None = None,
    after_block: str | None = None,
) -> dict:
    create_db: dict = {"parent": {"type": "page_id", "page_id": parent_page_id}}
    if after_block:
        create_db["position"] = {"type": "after_block", "block_id": after_block}
    body: dict = {
        "create_database": create_db,
        "data_source_id": data_source_id,
        "name": name,
        "type": view_type,
    }
    if filter_obj is not None:
        body["filter"] = filter_obj
    if sorts is not None:
        body["sorts"] = sorts
    if configuration is not None:
        body["configuration"] = configuration
    return notion("POST", "/views", token, body, version=NOTION_VERSION_VIEWS)


def append_blocks(token: str, page_id: str, blocks: list[dict]) -> list[str]:
    result = notion("PATCH", f"/blocks/{page_id}/children", token, {"children": blocks})
    return [b["id"] for b in result.get("results", [])]


def append_blocks_after(token: str, page_id: str, after_block_id: str, blocks: list[dict]) -> list[str]:
    result = notion(
        "PATCH",
        f"/blocks/{page_id}/children",
        token,
        {"after": after_block_id, "children": blocks},
    )
    return [b["id"] for b in result.get("results", [])]


def _block_text(block: dict) -> str:
    block_type = block.get("type")
    if not block_type:
        return ""
    data = block.get(block_type, {})
    return "".join(item.get("plain_text", "") for item in data.get("rich_text", []))


def _rich_text_chunks(text: str, *, bold: bool = False) -> list[dict]:
    if not text:
        return []
    chunks = []
    remaining = text
    while remaining:
        content = remaining[:2000]
        remaining = remaining[2000:]
        item = {"type": "text", "text": {"content": content}}
        if bold:
            item["annotations"] = {"bold": True}
        chunks.append(item)
    return chunks


def _command_callout(command: TodaysCommand) -> dict:
    color = "red_background" if command.state == "Founder Intervention Required" else "green_background"
    icon = "🔴" if command.state == "Founder Intervention Required" else "🟢"
    rich_text: list[dict] = []
    for content, bold in (
        (f"{command.command}\n", True),
        ("\nBest Next Move\n", True),
        (f"{command.best_next_move}\n", False),
        ("\nWhy Now\n", True),
        (f"{command.why_now}\n", False),
        ("\nCurrent Reality\n", True),
        (f"{command.current_reality}\n", False),
        ("\nYesterday\n", True),
        (command.yesterday, False),
    ):
        rich_text.extend(_rich_text_chunks(content, bold=bold))
    return {
        "icon": {"type": "emoji", "emoji": icon},
        "color": color,
        "rich_text": rich_text,
    }


def _top_priorities_recommended_callout(command: TodaysCommand) -> dict:
    return {
        "type": "callout",
        "callout": {
            "rich_text": [
                {"type": "text", "text": {"content": "Recommended\n"}, "annotations": {"bold": True}},
                {"type": "text", "text": {"content": f"{command.mission}\n"}},
                {
                    "type": "text",
                    "text": {"content": "This is the mission Today's Command is actively recommending."},
                    "annotations": {"color": "gray"},
                },
            ],
            "icon": {"type": "emoji", "emoji": "⭐"},
            "color": "yellow_background",
        },
    }


def _future_priority_affordance() -> dict:
    return {
        "type": "paragraph",
        "paragraph": {
            "rich_text": [
                {"type": "text", "text": {"content": "+ New Priority"}, "annotations": {"color": "gray"}},
                {
                    "type": "text",
                    "text": {"content": "    Promote · Demote · Pause · Resume · Complete"},
                    "annotations": {"color": "gray"},
                },
            ]
        },
    }


def project_todays_command() -> TodaysCommand:
    if not MISSION_REGISTRY_STATE.exists():
        raise RuntimeError(f"Mission State projection missing: {MISSION_REGISTRY_STATE}")
    return command_from_registry_doc(json.loads(MISSION_REGISTRY_STATE.read_text(encoding="utf-8")))


def refresh_todays_command(token: str, parent_page_id: str) -> TodaysCommand:
    """Patch the existing Today's Command callout from projected Mission State."""
    command = project_todays_command()
    children = notion("GET", f"/blocks/{parent_page_id}/children?page_size=100", token)
    blocks = children.get("results", [])
    seen_heading = False
    fallback_callout_id = None
    for block in blocks:
        block_type = block.get("type")
        text = _block_text(block)
        if block_type == "heading_1" and text == "Today's Command":
            seen_heading = True
            continue
        if block_type == "callout":
            if fallback_callout_id is None:
                fallback_callout_id = block["id"]
            if seen_heading or "Best Next Move" in text or "Capability Validation" in text:
                notion("PATCH", f"/blocks/{block['id']}", token, {"callout": _command_callout(command)})
                refresh_top_priorities(token, parent_page_id, command)
                return command
    if fallback_callout_id:
        notion("PATCH", f"/blocks/{fallback_callout_id}", token, {"callout": _command_callout(command)})
        refresh_top_priorities(token, parent_page_id, command)
        return command
    raise RuntimeError("Could not find a homepage callout to refresh Today's Command.")


def refresh_top_priorities(token: str, parent_page_id: str, command: TodaysCommand | None = None) -> None:
    """Replace Next Execution with Top Priorities on the homepage."""
    command = command or project_todays_command()
    children = notion("GET", f"/blocks/{parent_page_id}/children?page_size=100", token).get("results", [])

    section_start = None
    next_section = len(children)
    for idx, block in enumerate(children):
        if block.get("type") == "heading_2" and _block_text(block) in ("Next Execution", "Top Priorities"):
            section_start = idx
            notion(
                "PATCH",
                f"/blocks/{block['id']}",
                token,
                {"heading_2": {"rich_text": [{"type": "text", "text": {"content": "Top Priorities"}}]}},
            )
            break
    if section_start is None:
        return

    for idx in range(section_start + 1, len(children)):
        if children[idx].get("type") == "heading_2":
            next_section = idx
            break

    quote_id = None
    existing_recommended = None
    top_priorities_db = None
    legacy_execution_db = None
    future_affordance = None
    for block in children[section_start + 1 : next_section]:
        btype = block.get("type")
        text = _block_text(block)
        if btype == "quote":
            quote_id = block["id"]
            notion(
                "PATCH",
                f"/blocks/{block['id']}",
                token,
                {"quote": {"rich_text": [{"type": "text", "text": {"content": "What does the founder currently own?"}, "annotations": {"italic": True}}]}},
            )
        elif btype == "callout" and "Recommended" in text:
            existing_recommended = block["id"]
        elif btype == "child_database":
            title = block.get("child_database", {}).get("title", "")
            if title == "Top Priorities":
                top_priorities_db = block["id"]
            elif title in ("Next Execution", "Untitled"):
                legacy_execution_db = block["id"]
        elif btype == "paragraph" and "+ New Priority" in text:
            future_affordance = block["id"]

    if existing_recommended:
        notion(
            "PATCH",
            f"/blocks/{existing_recommended}",
            token,
            {"callout": _top_priorities_recommended_callout(command)["callout"]},
        )
        anchor = existing_recommended
    elif quote_id:
        ids = append_blocks_after(token, parent_page_id, quote_id, [_top_priorities_recommended_callout(command)])
        anchor = ids[0]
    else:
        anchor = children[section_start]["id"]

    if legacy_execution_db and legacy_execution_db != top_priorities_db:
        archive_block(token, {"id": legacy_execution_db, "type": "child_database"})

    if top_priorities_db:
        notion(
            "PATCH",
            f"/databases/{top_priorities_db}",
            token,
            {"title": [{"type": "text", "text": {"content": "Top Priorities"}}]},
        )
        _patch_linked_view(token, top_priorities_db, "Top Priorities", FILTER_TOP_PRIORITIES)
        anchor = top_priorities_db
    else:
        data_source_id = _mission_registry_data_source_id(token)
        v = create_linked_view(
            token,
            parent_page_id,
            data_source_id,
            name="Top Priorities",
            view_type="list",
            filter_obj=FILTER_TOP_PRIORITIES,
            sorts=SORT_RECENT,
            configuration=list_config(P["mission"], P["status"], P["posture"], P["latest_event"]),
            after_block=anchor,
        )
        anchor = v.get("parent", {}).get("database_id", anchor)
        if anchor:
            notion(
                "PATCH",
                f"/databases/{anchor}",
                token,
                {"title": [{"type": "text", "text": {"content": "Top Priorities"}}]},
            )

    if future_affordance:
        notion(
            "PATCH",
            f"/blocks/{future_affordance}",
            token,
            {"paragraph": _future_priority_affordance()["paragraph"]},
        )
    else:
        append_blocks_after(token, parent_page_id, anchor, [_future_priority_affordance()])


def _mission_registry_data_source_id(token: str) -> str:
    env = load_env()
    database_id = env.get("NOTION_MISSION_REGISTRY_DATABASE_ID", "")
    if not database_id:
        raise RuntimeError("Missing NOTION_MISSION_REGISTRY_DATABASE_ID for Top Priorities linked view.")
    db = notion("GET", f"/databases/{database_id}", token)
    return db["data_sources"][0]["id"]


def _patch_linked_view(token: str, child_database_id: str, name: str, filter_obj: dict) -> None:
    views = notion("GET", f"/views?database_id={child_database_id}", token, version=NOTION_VERSION_VIEWS)
    for item in views.get("results", []):
        view = notion("GET", f"/views/{item['id']}", token, version=NOTION_VERSION_VIEWS)
        vtype = view.get("type", "list")
        config = gallery_config(P["mission"], P["status"], P["posture"], P["latest_event"]) if vtype == "gallery" else list_config(P["mission"], P["status"], P["posture"], P["latest_event"])
        notion(
            "PATCH",
            f"/views/{item['id']}",
            token,
            {"name": name, "filter": filter_obj, "sorts": SORT_RECENT, "configuration": config},
            version=NOTION_VERSION_VIEWS,
        )


def should_archive_block(block: dict, registry_database_id: str) -> bool:
    """Archive legacy content only; preserve operating surface and source registry."""
    block_id = block.get("id", "")
    block_type = block.get("type")
    if block_id.replace("-", "") == registry_database_id.replace("-", ""):
        return False
    if block_type in ("callout", "heading_2", "quote", "divider", "toggle"):
        return False
    if block_type == "child_database":
        title = block.get("child_database", {}).get("title", "")
        if title in ("Attention Required", "Next Execution", "Top Priorities", "Latest Change", "Closed Loop", "Carry Forward", "System Table", "Untitled"):
            return False
    return block_type in ("child_page", "child_database")


def archive_block(token: str, block: dict) -> None:
    block_id = block["id"]
    block_type = block.get("type")
    if block_type == "child_page":
        notion("PATCH", f"/pages/{block_id}", token, {"archived": True})
    else:
        notion("PATCH", f"/blocks/{block_id}", token, {"archived": True})


def setup_registry_views(token: str, database_id: str, data_source_id: str, default_view_id: str) -> dict[str, str]:
    """Create Mission Registry views; return name → view_id map."""
    notion(
        "PATCH",
        f"/views/{default_view_id}",
        token,
        {
            "name": "System Table",
            "configuration": table_config(
                P["mission"],
                P["status"],
                P["posture"],
                P["objective"],
                P["latest_event"],
                P["latest_eos"],
                P["last_updated"],
                P["mission_id"],
            ),
        },
        version=NOTION_VERSION_VIEWS,
    )

    views: dict[str, str] = {"System Table": default_view_id}

    specs = [
        (
            "Operating State",
            "table",
            None,
            None,
            table_config(P["mission"], P["status"], P["posture"], P["last_updated"]),
        ),
        (
            "Attention Required",
            "list",
            FILTER_ATTENTION,
            None,
            list_config(P["mission"], P["posture"], P["latest_event"], P["last_updated"]),
        ),
        (
            "Top Priorities",
            "list",
            FILTER_TOP_PRIORITIES,
            SORT_RECENT,
            list_config(P["mission"], P["status"], P["posture"], P["latest_event"]),
        ),
        (
            "Latest Signal",
            "list",
            None,
            SORT_RECENT,
            list_config(P["mission"], P["latest_event"], P["last_updated"]),
        ),
        (
            "Closed Loop",
            "list",
            FILTER_CLOSED,
            SORT_RECENT,
            list_config(P["mission"], P["latest_eos"], P["last_updated"]),
        ),
        (
            "Carry Forward",
            "list",
            FILTER_CARRY,
            None,
            list_config(P["mission"], P["posture"], P["latest_eos"]),
        ),
    ]

    for name, vtype, filt, sorts, config in specs:
        v = create_registry_view(
            token,
            database_id,
            data_source_id,
            name=name,
            view_type=vtype,
            filter_obj=filt,
            sorts=sorts,
            configuration=config,
        )
        views[name] = v["id"]
        print(f"  Registry view: {name} ({v['id']})")

    return views


def setup_homepage(
    token: str,
    parent_page_id: str,
    data_source_id: str,
) -> None:
    notion(
        "PATCH",
        f"/pages/{parent_page_id}",
        token,
        {
            "icon": {"type": "emoji", "emoji": "🛰️"},
            "properties": {"title": [{"type": "text", "text": {"content": "ODS OS"}}]},
        },
    )

    # Archive legacy blocks only
    children = notion("GET", f"/blocks/{parent_page_id}/children?page_size=100", token)
    for block in children.get("results", []):
        if should_archive_block(block, os.environ.get("NOTION_MISSION_REGISTRY_DATABASE_ID", "")):
            archive_block(token, block)
            print(f"  Archived block: {block.get('type')} {block.get('id', '')[:8]}…")

    if any(b.get("type") == "callout" for b in children.get("results", [])):
        print("  Homepage already configured; skipping section build")
        return

    # Build homepage content blocks
    section_defs = [
        (
            "callout",
            {
                "type": "callout",
                "callout": {
                    "rich_text": [
                        {"type": "text", "text": {"content": "Current State\n\n"}},
                        {
                            "type": "text",
                            "text": {
                                "content": "You are operating from projected Mission State.\n\nStart with Today's Command.\n\nUse Top Priorities to review founder-owned missions."
                            },
                        },
                    ],
                    "icon": {"type": "emoji", "emoji": "📍"},
                    "color": "gray_background",
                },
            },
        ),
        ("heading", {"type": "heading_2", "heading_2": {"rich_text": [{"type": "text", "text": {"content": "Attention Required"}}]}}),
        ("quote", {"type": "quote", "quote": {"rich_text": [{"type": "text", "text": {"content": "What needs founder judgment?"}, "annotations": {"italic": True}}]}}),
        ("linked", {"name": "Attention Required", "type": "list", "filter": FILTER_ATTENTION, "config": list_config(P["mission"], P["posture"], P["latest_event"], P["last_updated"])}),
        ("divider", {"type": "divider", "divider": {}}),
        ("heading", {"type": "heading_2", "heading_2": {"rich_text": [{"type": "text", "text": {"content": "Top Priorities"}}]}}),
        ("quote", {"type": "quote", "quote": {"rich_text": [{"type": "text", "text": {"content": "What does the founder currently own?"}, "annotations": {"italic": True}}]}}),
        ("callout", _top_priorities_recommended_callout(project_todays_command())),
        ("linked", {"name": "Top Priorities", "type": "list", "filter": FILTER_TOP_PRIORITIES, "sorts": SORT_RECENT, "config": list_config(P["mission"], P["status"], P["posture"], P["latest_event"])}),
        ("block", _future_priority_affordance()),
        ("divider", {"type": "divider", "divider": {}}),
        ("heading", {"type": "heading_2", "heading_2": {"rich_text": [{"type": "text", "text": {"content": "Latest Change"}}]}}),
        ("quote", {"type": "quote", "quote": {"rich_text": [{"type": "text", "text": {"content": "What changed?"}, "annotations": {"italic": True}}]}}),
        ("linked", {"name": "Latest Change", "type": "list", "filter": None, "sorts": SORT_RECENT, "config": list_config(P["mission"], P["latest_event"], P["last_updated"])}),
        ("divider", {"type": "divider", "divider": {}}),
        ("heading", {"type": "heading_2", "heading_2": {"rich_text": [{"type": "text", "text": {"content": "Closed Loop"}}]}}),
        ("quote", {"type": "quote", "quote": {"rich_text": [{"type": "text", "text": {"content": "What closed?"}, "annotations": {"italic": True}}]}}),
        ("linked", {"name": "Closed Loop", "type": "list", "filter": FILTER_CLOSED, "sorts": SORT_RECENT, "config": list_config(P["mission"], P["latest_eos"], P["last_updated"])}),
        ("divider", {"type": "divider", "divider": {}}),
        ("heading", {"type": "heading_2", "heading_2": {"rich_text": [{"type": "text", "text": {"content": "Carry Forward"}}]}}),
        ("quote", {"type": "quote", "quote": {"rich_text": [{"type": "text", "text": {"content": "What continues tomorrow?"}, "annotations": {"italic": True}}]}}),
        ("linked", {"name": "Carry Forward", "type": "list", "filter": FILTER_CARRY, "config": list_config(P["mission"], P["posture"], P["latest_eos"])}),
        ("divider", {"type": "divider", "divider": {}}),
    ]

    last_block_id: str | None = None
    for kind, spec in section_defs:
        if kind == "linked":
            v = create_linked_view(
                token,
                parent_page_id,
                data_source_id,
                name=spec["name"],
                view_type=spec["type"],
                filter_obj=spec.get("filter"),
                sorts=spec.get("sorts"),
                configuration=spec["config"],
                after_block=last_block_id,
            )
            # Linked DB block id is in parent.database_id of the view
            db_id = v.get("parent", {}).get("database_id")
            if db_id:
                last_block_id = db_id.replace("-", "")
                # Notion block IDs may need dashes - use view parent
                last_block_id = v["parent"]["database_id"]
            print(f"  Homepage linked view: {spec['name']}")
        else:
            ids = append_blocks(token, parent_page_id, [spec])
            last_block_id = ids[0] if ids else last_block_id

    # System Registry toggle with full registry linked view
    toggle_heading = append_blocks(
        token,
        parent_page_id,
        [
            {
                "type": "toggle",
                "toggle": {
                    "rich_text": [
                        {"type": "text", "text": {"content": "System Registry"}, "annotations": {"bold": True}},
                    ],
                    "children": [
                        {
                            "type": "paragraph",
                            "paragraph": {
                                "rich_text": [
                                    {
                                        "type": "text",
                                        "text": {"content": "Canonical mission database projected from Mission State."},
                                        "annotations": {"italic": True, "color": "gray"},
                                    }
                                ]
                            },
                        },
                    ],
                },
            }
        ],
    )
    toggle_id = toggle_heading[0]

    create_linked_view(
        token,
        parent_page_id,
        data_source_id,
        name="System Table",
        view_type="table",
        configuration=table_config(
            P["mission"],
            P["status"],
            P["posture"],
            P["objective"],
            P["latest_event"],
            P["latest_eos"],
            P["last_updated"],
            P["mission_id"],
        ),
        after_block=toggle_id,
    )
    print("  System Registry toggle + linked System Table")
    fix_linked_view_titles(token, parent_page_id)


def fix_linked_view_titles(token: str, parent_page_id: str) -> None:
    """Rename linked database blocks from Untitled to their section name."""
    children = notion("GET", f"/blocks/{parent_page_id}/children?page_size=100", token)
    section: str | None = None
    for block in children.get("results", []):
        btype = block.get("type")
        if btype == "heading_2":
            section = "".join(x.get("plain_text", "") for x in block["heading_2"]["rich_text"])
        elif btype == "child_database" and section:
            title = block.get("child_database", {}).get("title") or "Untitled"
            if title == "Untitled":
                name = "System Table" if section == "System Registry" else section
                notion(
                    "PATCH",
                    f"/databases/{block['id']}",
                    token,
                    {"title": [{"type": "text", "text": {"content": name}}]},
                )
                print(f"  Renamed linked view: {name}")
            section = None


def setup_mission_page(token: str, page_id: str, props: dict) -> None:
    """Render Mission Intelligence v0.2 into the mission page body."""
    # Clear existing body blocks
    children = notion("GET", f"/blocks/{page_id}/children?page_size=100", token)
    for block in children.get("results", []):
        archive_block(token, block)

    mission = _plain(props.get("Mission", {}))
    status = _select(props.get("Status", {}))
    posture = _select(props.get("Operational Posture", {}))
    last_updated = _date(props.get("Last Updated", {}))
    objective = _plain(props.get("Current Objective", {}))
    latest_event = _plain(props.get("Latest Event", {}))
    latest_eos = _plain(props.get("Latest EOS", {}))
    mission_id = _plain(props.get("Mission ID", {}))
    mission_doc = _mission_doc(mission_id)
    events = mission_doc.get("events", []) if mission_doc else []
    full_eos = mission_doc.get("latestEos") or latest_eos
    status_read = _mission_status_read(mission, status, posture, last_updated)
    event_count = _eos_event_count(full_eos)

    blocks = [
        _h1(mission or "Mission"),
        _divider(),
        _h2("Mission Intelligence"),
        _p("Operating read. Start here before reviewing engineering evidence."),
        _divider(),
        _h2("Mission Summary"),
        _p(_mission_summary(mission, objective, status, posture, latest_event, events)),
        _divider(),
        _h2("Current Status"),
        *_bullets(status_read),
        _divider(),
        _h2("Executive Brief"),
        _p(_executive_brief(mission, objective, status, posture, events)),
        _divider(),
        _h2("Recent Progress"),
        *_bullets(_recent_progress(events)),
        _divider(),
        _h2("Key Decisions"),
        *_bullets(_key_decisions(events)),
        _divider(),
        _h2("QA Evidence"),
        *_bullets(_qa_evidence(events)),
        _divider(),
        _h2("Immediate Next Action"),
        _callout_next_action(_immediate_next_action(mission, objective, status, posture, latest_event)),
        _divider(),
        _h2("Risks"),
        *_bullets(_risks(events, status, posture)),
        _divider(),
        _h2("Engineering Evidence"),
        _eos_toggle(full_eos, event_count=event_count),
        _divider(),
        {
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": "System Details"}}],
                "children": [
                    _labeled_block("Mission ID", mission_id),
                    _labeled_block("Status", status),
                    _labeled_block("Operational Posture", posture),
                    _labeled_block("Last Updated", last_updated),
                ],
            },
        },
    ]

    notion("PATCH", f"/blocks/{page_id}/children", token, {"children": blocks})


def _mission_doc(mission_id: str) -> dict | None:
    if not mission_id or not MISSION_REGISTRY_STATE.exists():
        return None
    doc = json.loads(MISSION_REGISTRY_STATE.read_text(encoding="utf-8"))
    return next((item for item in doc.get("missions", []) if item.get("missionId") == mission_id), None)


def _event_label(event: dict) -> str:
    return str(event.get("summary") or event.get("objective") or event.get("eventType") or "")


def _eos_event_count(eos_text: str) -> int:
    return sum(1 for line in (eos_text or "").splitlines() if line.startswith("- `"))


def _clean_sentence(text: str) -> str:
    return (text or "").strip().rstrip(".")


def _mission_status_read(mission: str, status: str, posture: str, last_updated: str) -> list[str]:
    return [
        f"Mission: {mission or '—'}",
        f"Operational Posture: {posture or '—'}",
        f"Health: {_health(status, posture)}",
        "Confidence: Not scored in Mission State v0.1",
        f"Last Updated: {last_updated or '—'}",
    ]


def _health(status: str, posture: str) -> str:
    if status == "Closed" or posture == "Completed":
        return "Closed / validated"
    if posture == "Blocked":
        return "Needs founder intervention"
    if posture == "Paused":
        return "Paused"
    if posture == "Ready to Resume":
        return "Ready"
    if posture == "Executing":
        return "Healthy"
    return "Unknown"


def _mission_summary(mission: str, objective: str, status: str, posture: str, latest_event: str, events: list[dict]) -> str:
    purpose = _clean_sentence(objective) or "No objective is represented in Mission State"
    recent = _clean_sentence(latest_event or (_event_label(events[-1]) if events else "No recent event is represented"))
    return (
        f"{mission or 'This mission'} exists to {purpose}. "
        f"It is currently {status or 'Unknown'} with an operational posture of {posture or 'Unknown'}. "
        f"Recent progress is anchored by: {recent}. "
        f"The page below turns the event history into an executive operating read before exposing the raw EOS."
    )


def _executive_brief(mission: str, objective: str, status: str, posture: str, events: list[dict]) -> str:
    recent = [_clean_sentence(_event_label(event)) for event in events if event.get("eventType") != "mission.begin"][-3:]
    if recent:
        movement = " Recent movement: " + " ".join(f"{item}." for item in recent if item)
    else:
        movement = " No recent movement is represented yet."
    return (
        f"{mission or 'This mission'} is operating from {status or 'Unknown'} / {posture or 'Unknown'}. "
        f"The objective is {_clean_sentence(objective) or 'not represented in Mission State'}.{movement} "
        "The immediate read is generated from Mission State and event history, not manually authored page copy."
    )


def _recent_progress(events: list[dict]) -> list[str]:
    progress_events = [
        _event_label(event)
        for event in events
        if event.get("eventType") not in ("mission.begin", "mission.close") and _event_label(event)
    ]
    return progress_events[-5:] or ["No recent progress is represented in Mission State."]


def _key_decisions(events: list[dict]) -> list[str]:
    decisions = [
        _event_label(event)
        for event in events
        if event.get("eventType") == "decision.promoted" and _event_label(event)
    ]
    return decisions[-5:] or ["No promoted decisions are represented in Mission State."]


def _qa_evidence(events: list[dict]) -> list[str]:
    keywords = ("validat", "verif", "proof", "sync", "idempot", "qa", "law #001", "projection")
    evidence = []
    for event in events:
        label = _event_label(event)
        if label and any(keyword in label.lower() for keyword in keywords):
            evidence.append(label)
    return evidence[-5:] or ["No explicit QA evidence is represented in Mission State."]


def _immediate_next_action(mission: str, objective: str, status: str, posture: str, latest_event: str) -> str:
    if status == "Closed" or posture == "Completed":
        return f"Use {mission or 'this mission'} as closure evidence and move attention to the next active mission."
    if posture == "Blocked":
        return f"Resolve the blocker represented by: {latest_event or objective or mission}."
    if posture == "Paused":
        return f"Decide whether to resume or leave {mission or 'this mission'} paused."
    if posture == "Ready to Resume":
        return f"Resume {mission or 'this mission'} from the latest represented signal."
    if objective:
        return f"Continue execution against: {objective}"
    return f"Continue {mission or 'this mission'} from the latest represented event."


def _risks(events: list[dict], status: str, posture: str) -> list[str]:
    risk_events = [
        _event_label(event)
        for event in events
        if any(term in _event_label(event).lower() for term in ("risk", "blocked", "blocker", "unresolved", "pending"))
    ]
    risks = risk_events[-3:]
    if posture in ("Blocked", "Paused"):
        risks.append(f"Operational posture is {posture}.")
    risks.append("Confidence scoring is not represented in Mission State v0.1.")
    if status != "Closed":
        risks.append("Progress percentage is not represented in Mission State v0.1.")
    return risks[:5]


def _plain(prop: dict) -> str:
    t = prop.get("type")
    if t == "title":
        return "".join(x.get("plain_text", "") for x in prop.get("title", []))
    if t == "rich_text":
        return "".join(x.get("plain_text", "") for x in prop.get("rich_text", []))
    return ""


def _select(prop: dict) -> str:
    sel = prop.get("select")
    return sel.get("name", "") if sel else ""


def _date(prop: dict) -> str:
    d = prop.get("date")
    return d.get("start", "") if d else ""


def _h1(text: str) -> dict:
    return {"type": "heading_1", "heading_1": {"rich_text": [{"type": "text", "text": {"content": text}}]}}


def _h2(text: str) -> dict:
    return {"type": "heading_2", "heading_2": {"rich_text": [{"type": "text", "text": {"content": text}}]}}


def _p(text: str) -> dict:
    return {"type": "paragraph", "paragraph": {"rich_text": _rich_text_chunks(text or "—")}}


def _bullets(items: list[str]) -> list[dict]:
    return [
        {
            "type": "bulleted_list_item",
            "bulleted_list_item": {"rich_text": _rich_text_chunks(item or "—")},
        }
        for item in items
    ]


def _callout_next_action(text: str) -> dict:
    return {
        "type": "callout",
        "callout": {
            "rich_text": _rich_text_chunks(text, bold=True),
            "icon": {"type": "emoji", "emoji": "🎯"},
            "color": "blue_background",
        },
    }


def _eos_toggle(text: str, *, event_count: int = 0) -> dict:
    chunks = []
    remaining = text or "No EOS is available."
    while remaining:
        chunk = remaining[:1800]
        remaining = remaining[1800:]
        chunks.append(_p(chunk))
    label = f"Latest EOS ({event_count} Events)" if event_count else "Latest EOS"
    return {
        "type": "toggle",
        "toggle": {
            "rich_text": [{"type": "text", "text": {"content": label}, "annotations": {"bold": True}}],
            "children": chunks,
        },
    }


def _divider() -> dict:
    return {"type": "divider", "divider": {}}


def _callout_current_read(status: str, posture: str, last_updated: str) -> dict:
    lines = f"Status: {status or '—'}  ·  Operational Posture: {posture or '—'}  ·  Last Updated: {last_updated or '—'}"
    return {
        "type": "callout",
        "callout": {
            "rich_text": [
                {"type": "text", "text": {"content": "Current Read\n"}, "annotations": {"bold": True}},
                {"type": "text", "text": {"content": lines}},
            ],
            "icon": {"type": "emoji", "emoji": "📊"},
            "color": "blue_background",
        },
    }


def _labeled(label: str, value: str) -> dict:
    return {
        "type": "paragraph",
        "paragraph": {
            "rich_text": [
                {"type": "text", "text": {"content": f"{label}\n"}, "annotations": {"bold": True}},
                {"type": "text", "text": {"content": value or "—"}},
            ]
        },
    }


def _labeled_block(label: str, value: str) -> dict:
    return {
        "type": "bulleted_list_item",
        "bulleted_list_item": {
            "rich_text": [
                {"type": "text", "text": {"content": f"{label}: "}, "annotations": {"bold": True}},
                {"type": "text", "text": {"content": value or "—"}, "annotations": {"code": True}},
            ]
        },
    }


def main() -> int:
    env = load_env()
    token = env.get("NOTION_API_KEY", "")
    database_id = env.get("NOTION_MISSION_REGISTRY_DATABASE_ID", "")
    parent_page_id = env.get("NOTION_PARENT_PAGE_ID", "")
    os.environ["NOTION_MISSION_REGISTRY_DATABASE_ID"] = database_id

    missions_only = "--missions-only" in sys.argv
    command_only = "--refresh-command-only" in sys.argv

    if not all([token, database_id, parent_page_id]):
        print("Missing NOTION_API_KEY, NOTION_MISSION_REGISTRY_DATABASE_ID, or NOTION_PARENT_PAGE_ID", file=sys.stderr)
        return 1

    if command_only:
        command = refresh_todays_command(token, parent_page_id)
        print("=== Today's Command ===")
        print(f"  Rule: {command.rule}")
        print(f"  State: {command.state}")
        print(f"  Command: {command.command}")
        print(f"  Best Next Move: {command.best_next_move}")
        print(f"  Why Now: {command.why_now}")
        return 0

    db = notion("GET", f"/databases/{database_id}", token)
    data_source_id = db["data_sources"][0]["id"]

    if missions_only:
        print("=== Mission pages only ===")
    else:
        views_list = notion("GET", f"/views?database_id={database_id}", token, version=NOTION_VERSION_VIEWS)

        print("=== Mission Registry views ===")
        existing = {notion("GET", f"/views/{v['id']}", token, version=NOTION_VERSION_VIEWS)["name"]: v["id"] for v in views_list["results"]}
        if len(existing) >= 7:
            print("  Registry views already exist; skipping creation")
            registry_views = existing
        else:
            default_view_id = views_list["results"][0]["id"]
            registry_views = setup_registry_views(token, database_id, data_source_id, default_view_id)

        print("\n=== Homepage (ODS OS) ===")
        setup_homepage(token, parent_page_id, data_source_id)
        command = refresh_todays_command(token, parent_page_id)
        print(f"  Today's Command refreshed: {command.command} ({command.rule})")

    print("\n=== Mission pages ===")
    query = notion(
        "POST",
        f"/databases/{database_id}/query",
        token,
        {"page_size": 100},
        version="2022-06-28",
    )
    for page in query.get("results", []):
        title = _plain(page.get("properties", {}).get("Mission", {}))
        setup_mission_page(token, page["id"], page.get("properties", {}))
        print(f"  Mission page: {title}")

    fix_linked_view_titles(token, parent_page_id)

    views_list = notion("GET", f"/views?database_id={database_id}", token, version=NOTION_VERSION_VIEWS)
    registry_views = {
        notion("GET", f"/views/{v['id']}", token, version=NOTION_VERSION_VIEWS)["name"]: notion(
            "GET", f"/views/{v['id']}", token, version=NOTION_VERSION_VIEWS
        )["url"]
        for v in views_list["results"]
    }
    manifest = {
        "homepage_url": f"https://app.notion.com/p/ODS-OS-{parent_page_id.replace('-', '')}",
        "registry_url": f"https://app.notion.com/p/{database_id.replace('-', '')}",
        "registry_views": registry_views,
        "mission_pages": [p["url"] for p in query.get("results", [])],
    }
    out = Path(__file__).resolve().parents[1] / ".ods-eos" / "operating-surface-manifest.json"
    out.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"\nManifest written: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
