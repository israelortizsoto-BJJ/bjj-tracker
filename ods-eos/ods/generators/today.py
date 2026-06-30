"""Founder command center console report."""

from pathlib import Path

from ods.commands.prompts import utc_today
from ods.resolve import (
    decisions_since_previous_session,
    open_records,
)


class TodayError(Exception):
    """Today report generation failure."""


def gather_today_context(store: dict) -> dict:
    """Collect deterministic facts for the today command center."""
    decisions, latest_session, previous_session = decisions_since_previous_session(store)
    return {
        "latest_session": latest_session,
        "previous_session": previous_session,
        "open_investigations": open_records(store, "investigations"),
        "open_risks": open_records(store, "risks"),
        "open_parking": open_records(store, "parkingLot"),
        "latest_decisions": decisions,
    }


def latest_eod_path(latest_session: dict | None, eod_dir: Path) -> Path | None:
    if latest_session is None or not latest_session.get("endedAt"):
        return None
    return eod_dir / f"{latest_session['endedAt'][:10]}.md"


def recommended_first_action(context: dict) -> str:
    investigations = context["open_investigations"]
    if investigations:
        record = investigations[0]
        return f"Investigation {record['id']}: {record['title']}"

    risks = context["open_risks"]
    if risks:
        record = risks[0]
        return f"Risk {record['id']}: {record['description']}"

    parking = context["open_parking"]
    if parking:
        record = parking[0]
        return f"Parking lot {record['id']}: {record['title']}"

    latest_session = context["latest_session"]
    if latest_session and latest_session.get("planningIntent"):
        return f"Planning intent: {latest_session['planningIntent']}"

    return "(none)"


def _section_header(title: str) -> list[str]:
    return [title, "-" * len(title)]


def _append_record_lines(lines: list[str], record: dict, fields: list[tuple[str, str]]) -> None:
    for label, key in fields:
        value = record.get(key)
        if value is None or value == "":
            lines.append(f"  {label}: (none)")
        elif "\n" in str(value):
            lines.append(f"  {label}:")
            for part in str(value).splitlines():
                lines.append(f"    {part}")
        else:
            lines.append(f"  {label}: {value}")


def render_today(store: dict, *, eod_dir: Path, report_date: str | None = None) -> str:
    """Render a deterministic console report from store facts."""
    context = gather_today_context(store)
    latest_session = context["latest_session"]
    date = report_date or utc_today()

    lines: list[str] = [
        f"ODS-EOS Today — {date}",
        "=" * (len("ODS-EOS Today — ") + len(date)),
        "",
    ]

    lines.extend(_section_header("Current Planning Intent"))
    if latest_session:
        lines.append(f"  Session ID: {latest_session.get('id', '(none)')}")
        lines.append(f"  Session ended: {latest_session.get('endedAt', '(none)')}")
        intent = latest_session.get("planningIntent")
        if intent is None or intent == "":
            lines.append("  Planning intent: (none)")
        elif "\n" in intent:
            lines.append("  Planning intent:")
            for part in intent.splitlines():
                lines.append(f"    {part}")
        else:
            lines.append(f"  Planning intent: {intent}")
    else:
        lines.append("  (none)")
    lines.append("")

    lines.extend(_section_header("Open Investigations"))
    if context["open_investigations"]:
        for record in context["open_investigations"]:
            lines.append(f"- {record['id']}")
            _append_record_lines(
                lines,
                record,
                [("Title", "title"), ("Status", "status"), ("Objective", "objective")],
            )
            lines.append("")
    else:
        lines.append("(none)")
        lines.append("")

    lines.extend(_section_header("Open Risks"))
    if context["open_risks"]:
        for record in context["open_risks"]:
            lines.append(f"- {record['id']}")
            _append_record_lines(
                lines,
                record,
                [("Status", "status"), ("Description", "description")],
            )
            lines.append("")
    else:
        lines.append("(none)")
        lines.append("")

    lines.extend(_section_header("Open Parking Lot"))
    if context["open_parking"]:
        for record in context["open_parking"]:
            lines.append(f"- {record['id']}")
            _append_record_lines(
                lines,
                record,
                [
                    ("Title", "title"),
                    ("Status", "status"),
                    ("Reason deferred", "reasonDeferred"),
                ],
            )
            lines.append("")
    else:
        lines.append("(none)")
        lines.append("")

    lines.extend(_section_header("Latest Decisions"))
    if context["latest_decisions"]:
        for record in context["latest_decisions"]:
            lines.append(f"- {record['id']}")
            _append_record_lines(
                lines,
                record,
                [("Date", "date"), ("Description", "description")],
            )
            lines.append("")
    else:
        lines.append("(none)")
        lines.append("")

    lines.extend(_section_header("Latest EOD path"))
    eod_path = latest_eod_path(latest_session, eod_dir)
    lines.append(str(eod_path) if eod_path is not None else "(none)")
    lines.append("")

    lines.extend(_section_header("Recommended First Action"))
    lines.append(recommended_first_action(context))
    lines.append("")

    return "\n".join(lines).rstrip() + "\n"
