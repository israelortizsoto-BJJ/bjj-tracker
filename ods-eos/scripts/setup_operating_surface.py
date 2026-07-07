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
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ods.operating_command import TodaysCommand, command_from_registry_doc
from ods.doctrine import load_decision_entries, load_section_entries
from ods.config import get_yesterday_path
from ods.generators.yesterday import load_yesterday_text

RECAP_HEADINGS = ("Latest Change", "Yesterday's Recap")

NOTION_VERSION = "2025-09-03"
MISSION_REGISTRY_STATE = Path(__file__).resolve().parents[1] / ".ods-eos" / "mission-registry.json"
KNOWLEDGE_STORE_STATE = Path(__file__).resolve().parents[1] / ".ods-eos" / "knowledge-store.json"

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


def refresh_operational_pulse(token: str, parent_page_id: str) -> None:
    """Render the computed executive pulse without changing the rest of the homepage."""
    children = notion("GET", f"/blocks/{parent_page_id}/children?page_size=100", token).get("results", [])
    section_start = None
    section_end = len(children)
    for idx, block in enumerate(children):
        if block.get("type") == "heading_1" and _block_text(block) == "Operational Pulse":
            section_start = idx
            break

    if section_start is not None:
        for idx in range(section_start + 1, len(children)):
            if children[idx].get("type") in ("heading_1", "heading_2"):
                section_end = idx
                break
        for block in children[section_start + 1 : section_end]:
            archive_block(token, block)
        append_blocks_after(token, parent_page_id, children[section_start]["id"], _operational_pulse_blocks()[1:])
        return

    blocks = _operational_pulse_blocks()
    if children:
        append_blocks_after(token, parent_page_id, children[0]["id"], blocks)
    else:
        append_blocks(token, parent_page_id, blocks)


def refresh_todays_command(token: str, parent_page_id: str) -> TodaysCommand:
    """Patch the existing Today's Command callout from projected Mission State."""
    command = project_todays_command()
    refresh_operational_pulse(token, parent_page_id)
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
                refresh_yesterday_recap(token, parent_page_id)
                return command
    if fallback_callout_id:
        notion("PATCH", f"/blocks/{fallback_callout_id}", token, {"callout": _command_callout(command)})
        refresh_top_priorities(token, parent_page_id, command)
        refresh_yesterday_recap(token, parent_page_id)
        return command
    raise RuntimeError("Could not find a homepage callout to refresh Today's Command.")


def refresh_top_priorities(token: str, parent_page_id: str, command: TodaysCommand | None = None) -> None:
    """Render Active Priorities as founder-facing priority cards."""
    command = command or project_todays_command()
    children = notion("GET", f"/blocks/{parent_page_id}/children?page_size=100", token).get("results", [])

    section_start = None
    next_section = len(children)
    for idx, block in enumerate(children):
        if block.get("type") == "heading_2" and _block_text(block) in ("Next Execution", "Top Priorities", "Active Priorities"):
            section_start = idx
            notion(
                "PATCH",
                f"/blocks/{block['id']}",
                token,
                {"heading_2": {"rich_text": [{"type": "text", "text": {"content": "Active Priorities"}}]}},
            )
            break
    if section_start is None:
        return

    for idx in range(section_start + 1, len(children)):
        if children[idx].get("type") == "heading_2":
            next_section = idx
            break

    for block in children[section_start + 1 : next_section]:
        archive_block(token, block)

    append_blocks_after(token, parent_page_id, children[section_start]["id"], _active_priority_blocks(command))

    refresh_execution_context(token, parent_page_id)


def refresh_yesterday_recap(token: str, parent_page_id: str) -> None:
    """Replace Latest Change with a deterministic recap from docs/bootstrap/yesterday.md."""
    children = notion("GET", f"/blocks/{parent_page_id}/children?page_size=100", token).get("results", [])

    section_start = None
    next_section = len(children)
    for idx, block in enumerate(children):
        if block.get("type") == "heading_2" and _block_text(block) in RECAP_HEADINGS:
            section_start = idx
            notion(
                "PATCH",
                f"/blocks/{block['id']}",
                token,
                {"heading_2": {"rich_text": [{"type": "text", "text": {"content": "Yesterday's Recap"}}]}},
            )
            break
    if section_start is None:
        return

    for idx in range(section_start + 1, len(children)):
        if children[idx].get("type") == "heading_2":
            next_section = idx
            break

    for block in children[section_start + 1 : next_section]:
        archive_block(token, block)

    append_blocks_after(token, parent_page_id, children[section_start]["id"], _yesterday_recap_blocks())


def _yesterday_recap_blocks() -> list[dict]:
    text = load_yesterday_text(get_yesterday_path())
    if not text:
        return [
            _p("No recap generated yet."),
            _p("Run `python3 cli.py eod` to project yesterday's operational replay."),
        ]
    return _recap_text_to_blocks(text)


def _recap_text_to_blocks(text: str) -> list[dict]:
    blocks: list[dict] = []
    for raw_section in text.split("-----------------------------------"):
        lines = [line.strip() for line in raw_section.splitlines() if line.strip()]
        if not lines:
            continue
        if lines[0] == "Yesterday":
            lines = lines[1:]
        if not lines:
            continue
        title = lines[0]
        body = lines[1:]
        blocks.append(_h3(title))
        for line in body:
            if line.startswith("✓ "):
                blocks.append(
                    {
                        "type": "to_do",
                        "to_do": {
                            "rich_text": _rich_text_chunks(line[2:]),
                            "checked": True,
                        },
                    }
                )
            elif line.startswith("• "):
                blocks.extend(_bullets([line[2:]]))
            else:
                blocks.append(_p(line))
    return blocks or [_p(text)]

def _active_priority_blocks(command: TodaysCommand) -> list[dict]:
    missions = _active_priority_missions()
    missions = sorted(
        missions,
        key=lambda mission: (mission["label"] != command.mission, mission["posture"] != "Executing", mission["label"]),
    )
    cards = [_active_priority_card(mission, recommended=mission["label"] == command.mission) for mission in missions]
    return cards or [_p("No active priorities are projected.")]


def _active_priority_missions() -> list[dict]:
    if not MISSION_REGISTRY_STATE.exists():
        return []
    doc = json.loads(MISSION_REGISTRY_STATE.read_text(encoding="utf-8"))
    missions = []
    for item in doc.get("missions", []):
        state = item.get("state", {})
        if state.get("status") == "Active" and state.get("operationalIntent") != "Completed":
            missions.append(
                {
                    "label": state.get("label") or item.get("label", ""),
                    "status": state.get("status", ""),
                    "posture": state.get("operationalIntent", ""),
                    "objective": state.get("currentObjective", ""),
                    "latest_event": state.get("latestEvent", ""),
                    "last_updated": state.get("lastUpdated", ""),
                }
            )
    return sorted(missions, key=lambda mission: (mission["posture"] != "Executing", mission["label"]))


def _operational_pulse_blocks() -> list[dict]:
    metrics = _operational_pulse_metrics()
    return [
        _h1("Operational Pulse"),
        _operational_pulse_callout(metrics),
        _p("Pipeline: Coming Soon    Revenue: Coming Soon    Business Health: Coming Soon"),
        _divider(),
    ]


def _operational_pulse_metrics() -> dict[str, str]:
    missions = _all_projected_missions()
    active = [
        mission
        for mission in missions
        if mission["status"] == "Active" and mission["posture"] != "Completed"
    ]
    founder_waiting = [
        mission
        for mission in active
        if mission["posture"] in ("Blocked", "Paused")
    ]
    blocked = [mission for mission in active if mission["posture"] == "Blocked"]
    completed_this_week = [
        mission
        for mission in missions
        if (mission["status"] == "Closed" or mission["posture"] == "Completed")
        and _is_this_week(mission["last_updated"])
    ]
    qa_runs = _qa_run_count()
    health = "Blocked" if blocked else "Needs Attention" if founder_waiting else "Healthy"
    return {
        "Active Priorities": str(len(active)),
        "Founder Decisions Waiting": str(len(founder_waiting)),
        "Blocked Work": str(len(blocked)),
        "Completed This Week": str(len(completed_this_week)),
        "Active Bugs": "Coming Soon",
        "QA Runs": str(qa_runs),
        "System Health": f"● {health}",
    }


def _operational_pulse_callout(metrics: dict[str, str]) -> dict:
    ordered = (
        "Active Priorities",
        "Founder Decisions Waiting",
        "Blocked Work",
        "Completed This Week",
        "Active Bugs",
        "QA Runs",
        "System Health",
    )
    rich_text: list[dict] = []
    for label in ordered:
        value = metrics[label]
        rich_text.extend(
            [
                {"type": "text", "text": {"content": f"{value}\n"}, "annotations": {"bold": True}},
                {"type": "text", "text": {"content": f"{label}\n\n"}},
            ]
        )
    return {
        "type": "callout",
        "callout": {
            "rich_text": rich_text,
            "icon": {"type": "emoji", "emoji": "📊"},
            "color": "blue_background",
        },
    }


def _all_projected_missions() -> list[dict]:
    if not MISSION_REGISTRY_STATE.exists():
        return []
    doc = json.loads(MISSION_REGISTRY_STATE.read_text(encoding="utf-8"))
    missions = []
    for item in doc.get("missions", []):
        state = item.get("state", {})
        missions.append(
            {
                "label": state.get("label") or item.get("label", ""),
                "status": state.get("status", ""),
                "posture": state.get("operationalIntent", ""),
                "latest_event": state.get("latestEvent", ""),
                "last_updated": state.get("lastUpdated", ""),
            }
        )
    return missions


def _is_this_week(value: str) -> bool:
    if not value:
        return False
    normalized = value.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError:
        return False
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=now.weekday())
    start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=7)
    return start <= dt.astimezone(timezone.utc) < end


def _qa_run_count() -> int:
    if not KNOWLEDGE_STORE_STATE.exists():
        return 0
    try:
        store = json.loads(KNOWLEDGE_STORE_STATE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return 0
    qa_runs = store.get("qaRuns", [])
    return len(qa_runs) if isinstance(qa_runs, list) else 0


def _active_priority_card(mission: dict, *, recommended: bool) -> dict:
    title = f"Recommended\n{mission['label']}" if recommended else mission["label"]
    lines = [
        (f"{title}\n", True),
        (f"What is this? {mission['label']}.\n", False),
        (f"Current State: {mission['posture'] or mission['status'] or 'Unknown'}\n", False),
        (f"Why It Matters: {_why_it_matters(mission)}\n", False),
        (f"Recommended Next Action: {_priority_next_action(mission)}\n", False),
        (f"Business Impact: {_business_impact(mission)}\n", False),
        (f"Health: {_executive_health(mission['status'], mission['posture'])}", False),
    ]
    rich_text: list[dict] = []
    for content, bold in lines:
        rich_text.extend(_rich_text_chunks(content, bold=bold))
    return {
        "type": "callout",
        "callout": {
            "rich_text": rich_text,
            "icon": {"type": "emoji", "emoji": "⭐" if recommended else "📌"},
            "color": "yellow_background" if recommended else "gray_background",
        },
    }


def _why_it_matters(mission: dict) -> str:
    text = f"{mission.get('label', '')} {mission.get('objective', '')} {mission.get('latest_event', '')}".lower()
    if "gemini" in text or "multi-project" in text or "concurrent" in text:
        return "Validates multi-priority execution before ODS scales."
    if "mission intelligence" in text or "intelligence" in text:
        return "Improves every future mission handoff and decision review."
    if "notion" in text or "sync" in text or "projection" in text or "operating surface" in text:
        return "Improves operational trust in the founder operating surface."
    if "proof" in text or "validate" in text:
        return "Proves the operating system can be trusted before expansion."
    return _clean_sentence(mission.get("objective", "")) or "Represents active founder attention."


def _priority_next_action(mission: dict) -> str:
    label = mission.get("label", "this priority")
    posture = mission.get("posture", "")
    latest = _clean_sentence(mission.get("latest_event", ""))
    objective = _clean_sentence(mission.get("objective", ""))
    text = f"{label} {objective} {latest}".lower()
    if posture == "Blocked":
        return f"Resolve {latest or objective or label}."
    if posture == "Paused":
        return f"Decide whether to resume {label}."
    if posture == "Ready to Resume":
        return f"Resume {label} from the latest validated signal."
    if "gemini" in text:
        return "Validate Gemini Timeline inside the operating loop."
    if "mission intelligence" in text or "intelligence" in text:
        return "Tighten Mission Intelligence until a new operator can act quickly."
    if "operating surface" in text or "notion" in text:
        return "Polish the operating surface until the next decision is obvious."
    if objective:
        return f"Advance {label} against the current objective."
    return f"Continue {label} from the latest signal."


def _business_impact(mission: dict) -> str:
    text = f"{mission.get('label', '')} {mission.get('objective', '')} {mission.get('latest_event', '')}".lower()
    if "gemini" in text or "multi-project" in text or "concurrent" in text:
        return "Improves founder attention allocation across concurrent work."
    if "mission intelligence" in text or "intelligence" in text:
        return "Reduces onboarding time for future collaborators."
    if "notion" in text or "sync" in text or "projection" in text or "operating surface" in text:
        return "Reduces operational drag and manual coordination cost."
    if "proof" in text or "validate" in text:
        return "Increases confidence before investing in the next system layer."
    return "Protects founder focus and execution quality."


def _executive_health(status: str, posture: str) -> str:
    if status == "Closed" or posture == "Completed":
        return "Healthy"
    if posture == "Blocked":
        return "Blocked"
    if posture == "Paused":
        return "At Risk"
    if posture == "Ready to Resume":
        return "Needs Attention"
    if posture == "Executing":
        return "Healthy"
    return "Needs Attention"


def refresh_execution_context(token: str, parent_page_id: str) -> None:
    """Render static Execution Context v0.2 below Active Priorities."""
    children = notion("GET", f"/blocks/{parent_page_id}/children?page_size=100", token).get("results", [])
    context_start = None
    context_end = len(children)
    for idx, block in enumerate(children):
        if block.get("type") == "heading_2" and _block_text(block) == "Execution Context":
            context_start = idx
            break
    if context_start is not None:
        for idx in range(context_start + 1, len(children)):
            if children[idx].get("type") == "heading_2":
                context_end = idx
                break
        for block in children[context_start:context_end]:
            archive_block(token, block)
        children = notion("GET", f"/blocks/{parent_page_id}/children?page_size=100", token).get("results", [])

    top_start = None
    top_end = len(children)
    for idx, block in enumerate(children):
        if block.get("type") == "heading_2" and _block_text(block) in ("Top Priorities", "Active Priorities"):
            top_start = idx
            break
    if top_start is None:
        return

    for idx in range(top_start + 1, len(children)):
        if children[idx].get("type") == "heading_2":
            top_end = idx
            break

    anchor = children[top_end - 1]["id"] if top_end > top_start else children[top_start]["id"]
    append_blocks_after(token, parent_page_id, anchor, _execution_context_blocks())


def _execution_context_blocks() -> list[dict]:
    return [
        _h2("Execution Context"),
        _callout_static(
            "Operating Playbook",
            "Run the checklist. Open reference only when a decision feels unclear.",
            icon="🧭",
            color="gray_background",
        ),
        _h3("Always Read"),
        *_todos(
            [
                "Review Today's Priorities",
                "Check git status",
                "Verify clean working tree",
                "Review active decisions",
                "Begin implementation",
                *load_section_entries("always-read"),
            ]
        ),
        *_bullets(
            [
                "Evidence before assumptions",
                "Repository before implementation",
                "Architecture before patches",
            ]
        ),
        _h3("Sometimes Read"),
        _toggle_section(
            "Operating Principles",
            _bullets(
                [
                    "One source of truth",
                    "Leave every repository cleaner than you found it",
                    "Decisions become doctrine",
                    "Humans consume intelligence. Machines consume evidence.",
                ]
            ),
        ),
        _toggle_section(
            "Engineering Doctrine",
            _bullets(
                [
                    "Never debug by guessing",
                    "Instrument before redesign",
                    "Protect canonical systems",
                    "Repository-first investigation",
                    "QA before promotion",
                    "Every recurring lesson becomes doctrine",
                    *load_section_entries("engineering-doctrine"),
                ]
            ),
        ),
        _toggle_section(
            "Python Doctrine",
            _bullets(load_section_entries("python-doctrine") or ["No promoted Python doctrine yet."]),
        ),
        _toggle_section(
            "Product Doctrine",
            _bullets(load_section_entries("product-doctrine") or ["No promoted product doctrine yet."]),
        ),
        _toggle_section(
            "Founder / Operator Doctrine",
            _bullets(
                [
                    "Operators think in priorities",
                    "Technology serves operators",
                    "Interfaces reduce cognitive load",
                    "Evidence should never compete with intelligence",
                    "Projects compete for attention",
                    "The system recommends. The founder decides.",
                    *load_section_entries("founder-doctrine"),
                ]
            ),
        ),
        _toggle_section(
            "Communication Doctrine",
            [
                _callout_static(
                    "Language boundary",
                    "Backend language stays stable. Presentation language can translate for operators.",
                    icon="🗣️",
                    color="blue_background",
                ),
                *_bullets(
                    [
                        "Backend: Mission, Mission Registry, Mission State",
                        "Presentation: Project, Projects, Project Status",
                        "No backend rename. Presentation layer only.",
                        *load_section_entries("communication-doctrine"),
                    ]
                ),
            ],
        ),
        _h3("Reference Only"),
        _toggle_section(
            "Protected Systems",
            _bullets(
                [
                    "Competition Overlay",
                    "Mission Registry",
                    "Mission State",
                    "EOS",
                    "Promotion Bridge",
                    "Proof Floor",
                    "Law #001",
                ]
            ),
        ),
        _toggle_section(
            "Parking Lot",
            _bullets(load_section_entries("parking-lot") or ["No promoted parking lot items yet."]),
        ),
        _toggle_section(
            "Current Architecture Floors",
            _bullets(
                [
                    "Conversation → Promotion → Event Store → Mission Engine → Mission State → Projection Engine → Notion",
                    "Mission Registry schema is protected",
                    "Mission State is protected",
                    "Event Store is protected",
                    "EOS generation is protected",
                    "Law #001 remains the operating pipeline",
                ]
            ),
        ),
        _toggle_section("Decision Register", _decision_register_blocks()),
        _divider(),
    ]


def _decision_register_blocks() -> list[dict]:
    decisions = [
        (
            "Law #001 accepted",
            "EOS is the single founder interaction; downstream projection runs automatically.",
            "Active",
            "ODS",
            "Law #001 pipeline QA",
        ),
        (
            "Mission Registry frozen",
            "Canonical mission data remains stable while presentation evolves.",
            "Active",
            "ODS",
            "Founder Proof Floor v0.4-v0.6",
        ),
        (
            "Generic mission discovery adopted",
            "Concurrent missions enter ODS without project-specific code.",
            "Active",
            "ODS",
            "Gemini Timeline integration",
        ),
        (
            "Evidence is progressively disclosed",
            "Executive intelligence must be visible before raw engineering history.",
            "Active",
            "ODS",
            "Mission Intelligence v0.2",
        ),
    ]
    for entry in load_decision_entries():
        decisions.append(
            (
                entry["text"],
                f"Promoted into {entry['section']} via Knowledge Promotion Engine.",
                "Active",
                "ODS",
                entry["timestamp"],
            )
        )
    blocks: list[dict] = []
    for decision, reason, status, owner, evidence in decisions:
        blocks.append(
            {
                "type": "toggle",
                "toggle": {
                    "rich_text": [
                        {"type": "text", "text": {"content": decision}, "annotations": {"bold": True}},
                    ],
                    "children": [
                        _labeled_block("Reason", reason),
                        _labeled_block("Status", status),
                        _labeled_block("Owner", owner),
                        _labeled_block("Evidence", evidence),
                    ],
                },
            }
        )
    return blocks


def _mission_registry_data_source_id(token: str) -> str:
    env = load_env()
    database_id = env.get("NOTION_MISSION_REGISTRY_DATABASE_ID", "")
    if not database_id:
        raise RuntimeError("Missing NOTION_MISSION_REGISTRY_DATABASE_ID for active priority infrastructure.")
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
        if title in ("Attention Required", "Next Execution", "Top Priorities", "Active Priorities", "Latest Change", "Yesterday's Recap", "Closed Loop", "Carry Forward", "System Table", "Untitled"):
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
                                "content": "You are operating from projected Mission State.\n\nStart with Today's Command.\n\nUse Active Priorities to allocate attention."
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
        ("heading", {"type": "heading_2", "heading_2": {"rich_text": [{"type": "text", "text": {"content": "Active Priorities"}}]}}),
        *[("block", block) for block in _active_priority_blocks(project_todays_command())],
        ("divider", {"type": "divider", "divider": {}}),
        ("heading", {"type": "heading_2", "heading_2": {"rich_text": [{"type": "text", "text": {"content": "Yesterday's Recap"}}]}}),
        *[("block", block) for block in _yesterday_recap_blocks()],
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


def _h3(text: str) -> dict:
    return {"type": "heading_3", "heading_3": {"rich_text": [{"type": "text", "text": {"content": text}}]}}


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


def _todos(items: list[str]) -> list[dict]:
    return [
        {
            "type": "to_do",
            "to_do": {"rich_text": _rich_text_chunks(item or "—"), "checked": False},
        }
        for item in items
    ]


def _toggle_section(title: str, children: list[dict]) -> dict:
    return {
        "type": "toggle",
        "toggle": {
            "rich_text": [{"type": "text", "text": {"content": title}, "annotations": {"bold": True}}],
            "children": children,
        },
    }


def _callout_static(title: str, body: str, *, icon: str, color: str) -> dict:
    return {
        "type": "callout",
        "callout": {
            "rich_text": [
                {"type": "text", "text": {"content": f"{title}\n"}, "annotations": {"bold": True}},
                {"type": "text", "text": {"content": body}},
            ],
            "icon": {"type": "emoji", "emoji": icon},
            "color": color,
        },
    }


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
