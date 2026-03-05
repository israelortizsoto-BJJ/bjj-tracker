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
