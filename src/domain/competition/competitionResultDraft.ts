import type { KidCompetitionResult } from "../../types/coachKid";

/**
 * INV-CIL-2 / INV-CIL-3 — Competition result draft parity.
 *
 * `undefined` means Outcome Not Yet Recorded. Editors must hydrate and persist
 * that absence without coercing to a presentation default such as `"participated"`.
 */

export type CompetitionResultDraft = KidCompetitionResult | undefined;

/** New competitions start with no recorded outcome. */
export function newCompetitionResultDraft(): CompetitionResultDraft {
  return undefined;
}

/**
 * Hydrate editor draft from the domain value as-is.
 * Do not normalize. Do not substitute presentation defaults.
 */
export function hydrateCompetitionResultDraft(
  domainResult: KidCompetitionResult | undefined,
): CompetitionResultDraft {
  return domainResult;
}

/** Optional result chips: tap active value again to clear back to undefined. */
export function toggleCompetitionResultDraft(
  previous: CompetitionResultDraft,
  next: KidCompetitionResult,
): CompetitionResultDraft {
  return previous === next ? undefined : next;
}

/**
 * Persist fields for create/update payloads.
 * Omits `result` when draft is undefined so stores keep Outcome Not Yet Recorded.
 */
export function competitionResultPersistFields(
  resultDraft: CompetitionResultDraft,
): { result?: KidCompetitionResult } {
  return typeof resultDraft !== "undefined" ? { result: resultDraft } : {};
}
