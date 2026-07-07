"""Reverse-chronological ordering for docs/dev-handoff.md."""

from __future__ import annotations

import re
from datetime import date, datetime

SESSION_START_RE = re.compile(
    r"^(?:# DEV HANDOFF(?:\s*[—–-].*)?|# BJJ Tracker — Developer Handoff Notes)\s*$",
    re.MULTILINE,
)

DEV_HANDOFF_DATE_RE = re.compile(
    r"^#\s*DEV HANDOFF\s*[—–-]\s*(\d{4}-\d{2}-\d{2})",
    re.MULTILINE,
)

BODY_DATE_RE = re.compile(
    r"^\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})",
    re.MULTILINE,
)

ISO_DATE_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")

MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}

MONTH_RANGE_RE = re.compile(
    r"^#\s*"
    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
    r"(\d+)\s*[–—-]\s*"
    r"(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+)?"
    r"(\d+),?\s*"
    r"(\d{4})\s*$",
    re.MULTILINE | re.IGNORECASE,
)


def split_handoff(text: str) -> tuple[str, list[str]]:
    """Split handoff into permanent header and session blocks."""
    matches = list(SESSION_START_RE.finditer(text))
    if not matches:
        return text.rstrip(), []

    header = text[: matches[0].start()].rstrip()
    sessions: list[str] = []
    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        sessions.append(text[start:end].rstrip())
    return header, sessions


def session_sort_date(session: str) -> date:
    """Best-effort date for reverse-chronological ordering."""
    header_match = DEV_HANDOFF_DATE_RE.search(session)
    if header_match:
        return _parse_iso(header_match.group(1))

    body_match = BODY_DATE_RE.search(session)
    if body_match:
        return _parse_iso(body_match.group(1))

    for line in session.splitlines()[:40]:
        range_match = MONTH_RANGE_RE.match(line.strip())
        if range_match:
            end_month_name = range_match.group(3) or range_match.group(1)
            end_day = int(range_match.group(4))
            year = int(range_match.group(5))
            month = MONTHS[end_month_name.lower()]
            return date(year, month, end_day)

    iso_matches = ISO_DATE_RE.findall(session[:2000])
    if iso_matches:
        return max(_parse_iso(value) for value in iso_matches)

    return date.min


def session_date_key(session: str) -> str | None:
    """Return YYYY-MM-DD when the session header or body exposes one."""
    sort_date = session_sort_date(session)
    if sort_date == date.min:
        return None
    return sort_date.isoformat()


def sort_sessions_reverse_chronological(sessions: list[str]) -> list[str]:
    """Order sessions newest-first; stable tie-break preserves input order."""
    indexed = list(enumerate(sessions))
    indexed.sort(
        key=lambda item: (session_sort_date(item[1]), -item[0]),
        reverse=True,
    )
    return [session for _, session in indexed]


def upsert_session(
    sessions: list[str],
    new_session: str,
    *,
    session_date: str,
) -> list[str]:
    """Replace same-day session or prepend if new."""
    kept = [
        session
        for session in sessions
        if session_date_key(session) != session_date
    ]
    return [new_session.strip(), *kept]


def assemble_handoff(header: str, sessions: list[str]) -> str:
    """Rebuild handoff with header first, then reverse-chronological sessions."""
    parts: list[str] = []
    if header.strip():
        parts.append(header.rstrip())
    parts.extend(session.rstrip() for session in sessions if session.strip())
    return "\n\n".join(parts) + "\n"


def update_handoff(existing: str, new_session: str, *, session_date: str) -> str:
    """Preserve header, upsert today's session, and enforce newest-first ordering."""
    header, sessions = split_handoff(existing)
    sessions = upsert_session(sessions, new_session, session_date=session_date)
    sessions = sort_sessions_reverse_chronological(sessions)
    return assemble_handoff(header, sessions)


def verify_newest_first(content: str) -> bool:
    """Return True when session dates descend after the permanent header."""
    _, sessions = split_handoff(content)
    if len(sessions) < 2:
        return True

    dates = [session_sort_date(session) for session in sessions]
    return dates == sorted(dates, reverse=True)


def _parse_iso(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()
