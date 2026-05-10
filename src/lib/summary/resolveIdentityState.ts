export type IdentityState = "exploring" | "building" | "performing";

export function resolveIdentityState(input: {
  sessionCount?: number;
  competitionCount?: number;
  hasData: boolean;
}): IdentityState {
  if (!input.hasData || (input.sessionCount ?? 0) < 3) {
    return "exploring";
  }

  if ((input.competitionCount ?? 0) >= 3) {
    return "performing";
  }

  return "building";
}
