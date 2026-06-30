"""End-of-day report generator."""

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
from ods.resolve import resolve_session_links


class EodError(Exception):
    """EOD generation failure."""


def render_eod(store: dict, session: dict) -> str:
    """Render a deterministic EOD markdown document for one Session."""
    ended_at = session.get("endedAt")
    if not ended_at:
        raise EodError("Session endedAt is required for EOD generation.")

    report_date = ended_at[:10]
    linked = resolve_session_links(store, session)

    parts: list[str] = [
        f"# End-of-Day Report — {report_date}",
        "",
        f"Session ID: `{session['id']}`",
        "",
        "---",
        "",
        render_section(
            "Session",
            "\n".join(
                [
                    render_field("ID", session.get("id")),
                    render_field("Status", session.get("status")),
                    render_field("Started", session.get("startedAt")),
                    render_field("Ended", session.get("endedAt")),
                    render_field("Repository", session.get("repository")),
                    render_field("Summary", session.get("summary")),
                ]
            ),
        ),
    ]

    decisions = linked["decisions"]
    if decisions:
        body = "\n\n".join(render_decision(record) for record in decisions)
        parts.append(render_section("Decisions", body))
    else:
        parts.append(render_none_section("Decisions"))

    investigations = linked["investigations"]
    if investigations:
        body = "\n\n".join(render_investigation(record) for record in investigations)
        parts.append(render_section("Investigations", body))
    else:
        parts.append(render_none_section("Investigations"))

    parking = linked["parkingLot"]
    if parking:
        body = "\n\n".join(render_parking(record) for record in parking)
        parts.append(render_section("Parking Lot", body))
    else:
        parts.append(render_none_section("Parking Lot"))

    risks = linked["risks"]
    if risks:
        body = "\n\n".join(render_risk(record) for record in risks)
        parts.append(render_section("Risks", body))
    else:
        parts.append(render_none_section("Risks"))

    parts.append(
        render_section(
            "Tomorrow",
            render_field("Planning intent", session.get("planningIntent")),
        )
    )

    parts.append("---")
    parts.append("")
    parts.append("## Record Index")
    parts.append("")
    parts.append("| Type | ID |")
    parts.append("|------|----|")
    parts.append(f"| Session | `{session['id']}` |")
    for record in decisions:
        parts.append(f"| Decision | `{record['id']}` |")
    for record in investigations:
        parts.append(f"| Investigation | `{record['id']}` |")
    for record in parking:
        parts.append(f"| Parking Lot | `{record['id']}` |")
    for record in risks:
        parts.append(f"| Risk | `{record['id']}` |")

    return "\n".join(parts) + "\n"


def write_eod(store: dict, session: dict, output_dir: Path) -> Path:
    """Write the EOD report for a Session and return the output path."""
    ended_at = session.get("endedAt")
    if not ended_at:
        raise EodError("Session endedAt is required for EOD generation.")

    report_date = ended_at[:10]
    output_path = output_dir / f"{report_date}.md"
    content = render_eod(store, session)

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
    return output_path
