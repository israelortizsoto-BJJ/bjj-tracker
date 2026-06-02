/**
 * Phase 1 additive rollout gate. Defaults off until the worker route is deployed and verified.
 * Coach devices remain inert because no topology consumer exists in this phase.
 */
export const topologyPublishV2 =
  process.env.EXPO_PUBLIC_TOPOLOGY_PUBLISH_V2 === "1";
