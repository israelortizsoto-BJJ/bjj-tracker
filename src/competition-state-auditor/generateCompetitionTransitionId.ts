/** Generates a transition ID chaining parent canonical → publish → worker persist snapshots. */
export function generateCompetitionTransitionId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `comp-tx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
