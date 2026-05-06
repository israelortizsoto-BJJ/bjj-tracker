/**
 * Session-only coach decisions about system-suggested training focus.
 * No persistence — survives until app restart / process end.
 */

export type CoachTrainingFocusDecision = {
  suggestedFocusArea: string;
  finalCoachFocus: string;
  recordedAtIso: string;
};

const sessionByKidId = new Map<string, CoachTrainingFocusDecision>();

export function recordCoachTrainingFocusDecision(
  kidId: string,
  suggestedFocusArea: string,
  finalCoachFocus: string,
): void {
  const k = kidId.trim();
  if (!k) return;
  const s = suggestedFocusArea.trim();
  const f = finalCoachFocus.trim();
  if (!s || !f) return;
  const row: CoachTrainingFocusDecision = {
    suggestedFocusArea: s,
    finalCoachFocus: f,
    recordedAtIso: new Date().toISOString(),
  };
  sessionByKidId.set(k, row);
  enqueueTrainingFocusOverrideForLearning(k, row);
}

export function peekCoachTrainingFocusDecision(kidId: string): CoachTrainingFocusDecision | null {
  const k = kidId.trim();
  if (!k) return null;
  return sessionByKidId.get(k) ?? null;
}

/** True when decision is timely enough to outweigh fresh derived focuses (TTL + parse guard). */
export function isCoachTrainingFocusDecisionFresh(
  decision: CoachTrainingFocusDecision | null | undefined,
  maxAgeMs: number = 1000 * 60 * 60 * 24 * 7,
  nowMs = Date.now(),
): boolean {
  if (!decision?.recordedAtIso) return false;
  const recorded = Date.parse(decision.recordedAtIso);
  if (!Number.isFinite(recorded)) return false;
  return nowMs - recorded <= maxAgeMs;
}

export function clearCoachTrainingFocusDecision(kidId: string): void {
  sessionByKidId.delete(kidId.trim());
}

/**
 * Future learning loop — drain into durable patterns / heuristic tuning.
 * Stub until persistence exists (`recordCoachTrainingFocusDecision` already calls this).
 */
export function enqueueTrainingFocusOverrideForLearning(
  _kidId: string,
  _decision: CoachTrainingFocusDecision,
): void {
  // Persist + batch analysis would land here.
}
