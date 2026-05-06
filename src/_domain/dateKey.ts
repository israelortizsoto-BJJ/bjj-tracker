/**
 * Canonical date key used across the app: YYYY-MM-DD (local day).
 * Prevents day-list mismatches caused by ISO timestamps or other formats.
 */
export function toDateKey(input?: string | null): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";

  // Fast-path: YYYY-MM-DD or ISO timestamp -> take YYYY-MM-DD
  if (raw.length >= 10 && raw[4] === "-" && raw[7] === "-") {
    return raw.slice(0, 10);
  }

  // Fallback: try to parse
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // If parsing fails, return original to avoid data loss (caller can handle)
  return raw;
}

/** Local calendar day as YYYY-MM-DD (for comparisons with `toDateKey` event dates). */
export function localTodayDateKey(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * True when the event day is today or earlier — match breakdown / match media apply.
 * Malformed dates return true so editing is not blocked.
 */
export function isCompetitionMatchUiAvailableForEventDate(
  eventDateRaw: string,
  now: Date = new Date(),
): boolean {
  const eventKey = toDateKey(eventDateRaw);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventKey)) return true;
  const todayKey = localTodayDateKey(now);
  return eventKey <= todayKey;
}

/** Whole calendar days from `earlierYMD` to `laterYMD` (non-negative when earlier ≤ later). */
export function calendarDaysBetweenYMD(
  earlierYMD: string,
  laterYMD: string,
): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(earlierYMD) || !/^\d{4}-\d{2}-\d{2}$/.test(laterYMD)) {
    return null;
  }
  const earlier = new Date(`${earlierYMD}T12:00:00`).getTime();
  const later = new Date(`${laterYMD}T12:00:00`).getTime();
  return Math.round((later - earlier) / 86400000);
}
