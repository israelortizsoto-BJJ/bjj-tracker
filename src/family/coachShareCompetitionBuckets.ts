import type {
  Kid,
  KidCompetitionEntry,
  KidCompetitionFormat,
  KidCompetitionResult,
  KidId,
  KidsById,
} from "../types/coachKid";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function compareYMD(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Single-child family MVP: one deterministic kid from the pilot roster.
 * When multiple kids exist, uses the earliest `createdAt` (first added on this device).
 */
export function pickFamilyCompetitionKidId(kidsById: KidsById): KidId | null {
  const kids = Object.values(kidsById);
  if (kids.length === 0) return null;
  if (kids.length === 1) return kids[0]!.id;
  const sorted = kids.slice().sort((a, b) => {
    const c = a.createdAt.localeCompare(b.createdAt);
    if (c !== 0) return c;
    return a.id.localeCompare(b.id);
  });
  return sorted[0]!.id;
}

/** Same ordering as `pickFamilyCompetitionKidId` (first-added-first on device). */
export function sortedKidsForFamilyCompetitionChips(kidsById: KidsById): Kid[] {
  const kids = Object.values(kidsById);
  if (kids.length <= 1) return kids;
  return kids.slice().sort((a, b) => {
    const c = a.createdAt.localeCompare(b.createdAt);
    if (c !== 0) return c;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Resolves which kid the family Competition lane should use.
 * - 0 kids → null
 * - 1 kid → that kid (ignores stale stored id)
 * - 2+ kids → stored id if still on roster, else deterministic `pickFamilyCompetitionKidId`
 */
export function resolveFamilyCompetitionKidId(
  kidsById: KidsById,
  storedKidId: string | null | undefined,
): KidId | null {
  const kids = Object.values(kidsById);
  if (kids.length === 0) return null;
  if (kids.length === 1) return kids[0]!.id;
  const trimmed = storedKidId?.trim();
  if (trimmed && kidsById[trimmed]) return trimmed;
  return pickFamilyCompetitionKidId(kidsById);
}

export function kidDisplayNameForId(kidsById: KidsById, kidId: KidId): string | null {
  const k = kidsById[kidId];
  const n = k?.name?.trim();
  return n ? n : null;
}

export function familyCompetitionFormatLabel(
  format?: KidCompetitionFormat,
): string | null {
  switch (format) {
    case "gi":
      return "Gi";
    case "nogi":
      return "No-Gi";
    case "both":
      return "Both";
    default:
      return null;
  }
}

/** Promoter/org line with optional format suffix (family list rows). */
export function familyCompetitionPromoterFormatLine(
  entry: KidCompetitionEntry,
  orgMaxChars: number,
): string | null {
  const org = entry.organizationOrPromoter?.trim();
  const fmt = familyCompetitionFormatLabel(entry.format);
  if (org && fmt) return `${truncateEnd(org, orgMaxChars)} · ${fmt}`;
  if (org) return truncateEnd(org, orgMaxChars);
  if (fmt) return fmt;
  return null;
}

export function familyCompetitionResultLabel(
  r: KidCompetitionResult | undefined,
): string {
  if (!r) return "—";
  switch (r) {
    case "gold":
      return "Gold";
    case "silver":
      return "Silver";
    case "bronze":
      return "Bronze";
    case "participated":
      return "Participated";
    case "dnf":
      return "DNF";
    case "other":
      return "Other";
  }
}

/** Month label for grouping (YYYY-MM). */
export function formatFamilyCompetitionMonthHeading(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  const d = new Date(y, m - 1, 1);
  if (Number.isNaN(d.getTime())) return monthKey;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/**
 * Group competition rows by YYYY-MM for month headers + collapse (coach kid screen pattern).
 * `monthOrder` / `entryOrder` align with family "upcoming" (soonest-first) vs "recent" (newest-first).
 */
export function groupFamilyCompetitionEntriesByMonth(
  entries: KidCompetitionEntry[],
  opts: { monthOrder: "asc" | "desc"; entryOrder: "asc" | "desc" },
): { monthKey: string; entries: KidCompetitionEntry[] }[] {
  const map = new Map<string, KidCompetitionEntry[]>();
  for (const e of entries) {
    const mk = e.eventDate.length >= 7 ? e.eventDate.slice(0, 7) : "";
    if (!mk) continue;
    const arr = map.get(mk) ?? [];
    arr.push(e);
    map.set(mk, arr);
  }
  const keys = Array.from(map.keys()).sort((a, b) =>
    opts.monthOrder === "asc" ? compareYMD(a, b) : compareYMD(b, a),
  );
  return keys.map((monthKey) => ({
    monthKey,
    entries: (map.get(monthKey) ?? []).sort((a, b) => {
      const dateCmp =
        opts.entryOrder === "asc"
          ? compareYMD(a.eventDate, b.eventDate)
          : compareYMD(b.eventDate, a.eventDate);
      if (dateCmp !== 0) return dateCmp;
      return opts.entryOrder === "asc"
        ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt);
    }),
  }));
}

export type FamilyCompetitionHomeSegment =
  | { type: "month"; monthKey: string }
  | { type: "entry"; entry: KidCompetitionEntry };

/**
 * Inserts month headings while preserving entry order (list must already be sorted).
 * Skips headings when the slice is short so the weekly screen stays compact.
 */
export function familyCompetitionHomeSegments(
  entries: KidCompetitionEntry[],
  opts: { monthHeaders: boolean },
): FamilyCompetitionHomeSegment[] {
  if (!opts.monthHeaders || entries.length <= 2) {
    return entries.map((entry) => ({ type: "entry" as const, entry }));
  }
  const out: FamilyCompetitionHomeSegment[] = [];
  let prevMonth = "";
  for (const entry of entries) {
    const mk =
      entry.eventDate.length >= 7 ? entry.eventDate.slice(0, 7) : "";
    if (mk && mk !== prevMonth) {
      out.push({ type: "month", monthKey: mk });
      prevMonth = mk;
    }
    out.push({ type: "entry", entry });
  }
  return out;
}

export type FamilyCompetitionChip = {
  label: string;
  backgroundColor: string;
  textColor: string;
};

/** One calm semantic chip per row (family-facing, not coach jargon). */
export function familyCompetitionChipForEntry(
  entry: KidCompetitionEntry,
  todayYMD: string,
): FamilyCompetitionChip {
  const st = entry.eventStatus;
  const dateOk = YMD_RE.test(entry.eventDate);
  const isFutureOrToday =
    dateOk && compareYMD(entry.eventDate, todayYMD) >= 0;
  const isPastDate = dateOk && compareYMD(entry.eventDate, todayYMD) < 0;

  if (st === "cancelled") {
    return {
      label: "Cancelled",
      backgroundColor: "#fef3c7",
      textColor: "#92400e",
    };
  }
  if (st === "completed") {
    return {
      label: "Completed",
      backgroundColor: "#f3f4f6",
      textColor: "#4b5563",
    };
  }
  if (st === "upcoming") {
    if (isPastDate) {
      return {
        label: "Past event",
        backgroundColor: "#f3f4f6",
        textColor: "#4b5563",
      };
    }
    return {
      label: "Coming up",
      backgroundColor: "#e0e7ff",
      textColor: "#3730a3",
    };
  }
  if (st === "unknown" || st === undefined) {
    if (isFutureOrToday) {
      return {
        label: "Coming up",
        backgroundColor: "#e0e7ff",
        textColor: "#3730a3",
      };
    }
    return {
      label: "Past event",
      backgroundColor: "#f3f4f6",
      textColor: "#4b5563",
    };
  }
  return {
    label: "Coming up",
    backgroundColor: "#e0e7ff",
    textColor: "#3730a3",
  };
}

/** Result line on family rows: recent only; not cancelled; completed or past event date. */
export function shouldShowFamilyCompetitionResult(
  entry: KidCompetitionEntry,
  bucket: "upcoming" | "recent",
  todayYMD: string,
): boolean {
  if (bucket !== "recent") return false;
  if (entry.eventStatus === "cancelled") return false;
  if (entry.eventStatus === "completed") return true;
  if (!entry.result) return false;
  if (!YMD_RE.test(entry.eventDate)) return false;
  return compareYMD(entry.eventDate, todayYMD) < 0;
}

/**
 * Split entries for the family home preview.
 * Recent = completed, cancelled, or event date before today.
 * Upcoming = everything else with a valid date (today or future), sorted soonest first.
 */
export function partitionFamilyCompetitionEntries(
  entries: KidCompetitionEntry[],
  todayYMD: string,
): { upcoming: KidCompetitionEntry[]; recent: KidCompetitionEntry[] } {
  const upcoming: KidCompetitionEntry[] = [];
  const recent: KidCompetitionEntry[] = [];

  for (const e of entries) {
    const st = e.eventStatus;
    if (st === "completed" || st === "cancelled") {
      recent.push(e);
      continue;
    }

    if (!YMD_RE.test(e.eventDate)) {
      recent.push(e);
      continue;
    }

    if (compareYMD(e.eventDate, todayYMD) < 0) {
      recent.push(e);
    } else {
      upcoming.push(e);
    }
  }

  upcoming.sort(
    (a, b) =>
      compareYMD(a.eventDate, b.eventDate) ||
      a.createdAt.localeCompare(b.createdAt),
  );

  recent.sort(
    (a, b) =>
      compareYMD(b.eventDate, a.eventDate) ||
      b.createdAt.localeCompare(a.createdAt),
  );

  return { upcoming, recent };
}

export function truncateEnd(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  if (maxChars <= 1) return "…";
  return `${t.slice(0, maxChars - 1)}…`;
}

export function formatFamilyCompetitionDate(ymd: string): string {
  if (!YMD_RE.test(ymd)) return ymd;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return ymd;
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
