import type {
  KidCompetitionEventStatus,
  KidCompetitionResult,
} from "../../types/coachKid";

/**
 * INV-CIL-4 / Competition Intelligence Lifecycle — ParentResultsRecorded.
 *
 * Pure domain predicate. No persistence. No store fields.
 *
 * ParentResultsRecorded is true only when:
 *   1. Competition has occurred
 *   AND
 *   2. Parent has recorded either:
 *        - Competition Result, OR
 *        - One or more Match Results with stable lineage suitable for
 *          Coach Match Breakdown attachment
 *
 * Occurrence uses certified proxies until CompetitionOccurred is first-class:
 *   cancelled ⇒ false; eventStatus === "completed" OR eventDate ≤ today.
 *
 * Match Result = matchResult ∈ {win, loss}. Finish-type `outcome` alone does not count.
 */

const TRANSIENT_MATCH_ID_PATTERN = /^match-(new|init|legacy)-/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ParentResultsRecordedMatch = {
  id?: string | null;
  matchResult?: "win" | "loss" | null;
};

export type ParentResultsRecordedInput = {
  eventDate: string;
  /** Prefer `status ?? eventStatus` at call sites. */
  eventStatus?: KidCompetitionEventStatus | null;
  /** Competition-level result; undefined = Outcome Not Yet Recorded (INV-CIL-2). */
  result?: KidCompetitionResult;
  matches?: readonly ParentResultsRecordedMatch[] | null;
  /** Injectable clock for tests; defaults to local now. */
  now?: Date;
};

function toDateKey(input?: string | null): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  if (raw.length >= 10 && raw[4] === "-" && raw[7] === "-") {
    return raw.slice(0, 10);
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return raw;
}

function localTodayDateKey(now: Date): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Same contract as `isCompetitionMatchUiAvailableForEventDate`:
 * true when event day is today or earlier; malformed dates return true.
 */
function eventDateHasOccurred(eventDateRaw: string, now: Date): boolean {
  const eventKey = toDateKey(eventDateRaw);
  if (!YMD_RE.test(eventKey)) return true;
  return eventKey <= localTodayDateKey(now);
}

/** Stable lineage suitable for Coach Match Breakdown attachment (INV-O / overlay join). */
export function isStableMatchLineageKey(value: string | null | undefined): boolean {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id) return false;
  return !TRANSIENT_MATCH_ID_PATTERN.test(id);
}

/**
 * Competition has occurred (INV-CIL-1): distinct from review completion.
 * Proxies: completed status or event date on/before today; cancelled never occurred for review.
 */
export function competitionHasOccurred(input: {
  eventDate: string;
  eventStatus?: KidCompetitionEventStatus | null;
  now?: Date;
}): boolean {
  if (input.eventStatus === "cancelled") return false;
  if (input.eventStatus === "completed") return true;
  return eventDateHasOccurred(input.eventDate, input.now ?? new Date());
}

function hasCompetitionResult(result: KidCompetitionResult | undefined): boolean {
  return typeof result !== "undefined";
}

/** Match Results that satisfy the predicate must carry stable lineage. */
export function hasParentMatchResultsWithStableLineage(
  matches: readonly ParentResultsRecordedMatch[] | null | undefined,
): boolean {
  if (!Array.isArray(matches) || matches.length === 0) return false;
  return matches.some((match) => {
    const mr = match.matchResult;
    if (mr !== "win" && mr !== "loss") return false;
    return isStableMatchLineageKey(match.id);
  });
}

/**
 * Fact-based Sprint 2 gate for Coach Match Breakdown authoring / publish.
 * Parent-plane meaning only — Coach must not author this predicate.
 */
export function parentResultsRecorded(input: ParentResultsRecordedInput): boolean {
  if (
    !competitionHasOccurred({
      eventDate: input.eventDate,
      eventStatus: input.eventStatus,
      now: input.now,
    })
  ) {
    return false;
  }
  if (hasCompetitionResult(input.result)) return true;
  return hasParentMatchResultsWithStableLineage(input.matches);
}
