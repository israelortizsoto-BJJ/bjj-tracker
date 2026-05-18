import type { AthleteAuthorityBootstrapState } from "../identity/types";
import type { DeviceRole } from "../storage/deviceRoleStore";

export type AuthorityConsumerRouteTelemetryInput = {
  routeScreen: string;
  hydrationReady: boolean;
  athleteId: string;
  linkedKidId: string | null;
  authorityBootstrapState: AthleteAuthorityBootstrapState | undefined;
  role: DeviceRole | null;
};

/** DEV route-scoped authority consumer telemetry (stub — no side effects). */
export function useAuthorityConsumerRouteTelemetry(
  _input: AuthorityConsumerRouteTelemetryInput,
): void {}
