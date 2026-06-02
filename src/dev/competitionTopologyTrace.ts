let topologyTraceSequence = 0;

/** Ephemeral correlation only. Never persist this value or add it to canonical artifacts. */
export function createCompetitionTopologyTraceId(stage: "parent-publish" | "coach-hydrate"): string {
  topologyTraceSequence += 1;
  return `${stage}:${Date.now().toString(36)}:${topologyTraceSequence.toString(36)}`;
}

export function logCompetitionTopologyTrace(
  namespace: "[COMP_TOPOLOGY_TRACE]" | "[COMP_TOPOLOGY_HYDRATE]",
  event: string,
  details: Record<string, unknown>,
): void {
  if (__DEV__) {
    console.log(namespace, event, {
      ...details,
      timestamp: new Date().toISOString(),
    });
  }
}
