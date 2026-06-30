"""Morning brief generator."""

from pathlib import Path

from ods.generators.render import (
    render_decision,
    render_field,
    render_investigation,
    render_none_section,
    render_parking,
    render_risk,
    render_section,
)
from ods.resolve import (
    decisions_since_previous_session,
    open_records,
)


class MorningError(Exception):
    """Morning brief generation failure."""


def render_morning(store: dict, report_date: str) -> str:
    """Render a deterministic morning brief from store facts."""
    decisions, latest_session, previous_session = decisions_since_previous_session(store)
    open_investigations = open_records(store, "investigations")
    open_risks = open_records(store, "risks")
    open_parking = open_records(store, "parkingLot")

    parts: list[str] = [
        f"# Morning Brief — {report_date}",
        "",
        "---",
        "",
    ]

    if latest_session:
        planning_body = "\n".join(
            [
                render_field("Session ID", latest_session.get("id")),
                render_field("Session ended", latest_session.get("endedAt")),
                render_field("Planning intent", latest_session.get("planningIntent")),
            ]
        )
        parts.append(render_section("Planning Intent", planning_body))
    else:
        parts.append(render_none_section("Planning Intent"))

    if open_investigations:
        body = "\n\n".join(render_investigation(record) for record in open_investigations)
        parts.append(render_section("Open Investigations", body))
    else:
        parts.append(render_none_section("Open Investigations"))

    if open_risks:
        body = "\n\n".join(render_risk(record) for record in open_risks)
        parts.append(render_section("Open Risks", body))
    else:
        parts.append(render_none_section("Open Risks"))

    if open_parking:
        body = "\n\n".join(render_parking(record) for record in open_parking)
        parts.append(render_section("Open Parking Lot", body))
    else:
        parts.append(render_none_section("Open Parking Lot"))

    if decisions:
        body = "\n\n".join(render_decision(record) for record in decisions)
        parts.append(render_section("Latest Decisions", body))
    else:
        parts.append(render_none_section("Latest Decisions"))

    parts.append("---")
    parts.append("")
    parts.append("## Record Index")
    parts.append("")
    parts.append("| Type | ID |")
    parts.append("|------|----|")
    if latest_session:
        parts.append(f"| Session (latest) | `{latest_session['id']}` |")
    if previous_session:
        parts.append(f"| Session (previous) | `{previous_session['id']}` |")
    for record in open_investigations:
        parts.append(f"| Investigation | `{record['id']}` |")
    for record in open_risks:
        parts.append(f"| Risk | `{record['id']}` |")
    for record in open_parking:
        parts.append(f"| Parking Lot | `{record['id']}` |")
    for record in decisions:
        parts.append(f"| Decision | `{record['id']}` |")

    return "\n".join(parts) + "\n"


def write_morning(store: dict, output_dir: Path, report_date: str) -> Path:
    """Write the morning brief and return the output path."""
    output_path = output_dir / f"{report_date}.md"
    content = render_morning(store, report_date)

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
    return output_path
