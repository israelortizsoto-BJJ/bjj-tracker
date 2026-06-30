"""Shared markdown render helpers for generators."""


def render_field(label: str, value: object) -> str:
    if value is None or value == "":
        return f"- **{label}:** (none)"
    text = str(value)
    if "\n" in text:
        return f"- **{label}:**\n\n```\n{text}\n```"
    return f"- **{label}:** {text}"


def render_evidence(evidence: list[dict]) -> str:
    if not evidence:
        return "- (none)"

    lines: list[str] = []
    sorted_evidence = sorted(
        evidence,
        key=lambda item: (
            item.get("kind", ""),
            item.get("ref", ""),
            item.get("summary", ""),
        ),
    )
    for item in sorted_evidence:
        kind = item.get("kind", "(none)")
        ref = item.get("ref", "(none)")
        summary = item.get("summary")
        if summary:
            lines.append(f"- kind=`{kind}` ref=`{ref}` summary=`{summary}`")
        else:
            lines.append(f"- kind=`{kind}` ref=`{ref}`")
    return "\n".join(lines)


def render_decision(record: dict) -> str:
    lines = [
        f"### {record['id']}",
        "",
        render_field("Date", record.get("date")),
        render_field("Description", record.get("description")),
        "- **Supporting evidence:**",
        "",
        render_evidence(record.get("supportingEvidence") or []),
    ]
    return "\n".join(lines)


def render_investigation(record: dict) -> str:
    lines = [
        f"### {record['id']}",
        "",
        render_field("Title", record.get("title")),
        render_field("Status", record.get("status")),
        render_field("Objective", record.get("objective")),
        "- **Evidence:**",
        "",
        render_evidence(record.get("evidence") or []),
    ]
    if record.get("verdict") is not None:
        lines.extend(["", render_field("Verdict", record.get("verdict"))])
    return "\n".join(lines)


def render_parking(record: dict) -> str:
    lines = [
        f"### {record['id']}",
        "",
        render_field("Title", record.get("title")),
        render_field("Status", record.get("status")),
        render_field("Reason deferred", record.get("reasonDeferred")),
    ]
    return "\n".join(lines)


def render_risk(record: dict) -> str:
    lines = [
        f"### {record['id']}",
        "",
        render_field("Status", record.get("status")),
        render_field("Description", record.get("description")),
    ]
    if record.get("mitigation") is not None:
        lines.append(render_field("Mitigation", record.get("mitigation")))
    if record.get("resolution") is not None:
        lines.append(render_field("Resolution", record.get("resolution")))
    evidence = record.get("supportingEvidence")
    if evidence:
        lines.extend(
            [
                "- **Supporting evidence:**",
                "",
                render_evidence(evidence),
            ]
        )
    return "\n".join(lines)


def render_section(title: str, body: str) -> str:
    return f"## {title}\n\n{body.rstrip()}\n"


def render_none_section(title: str) -> str:
    return render_section(title, "(none)")
