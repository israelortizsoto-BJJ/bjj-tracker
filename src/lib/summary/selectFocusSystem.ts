export type FocusSystemInput = {
  coachSystem?: string | null;
  signalSystem?: string | null;
  identityFocus?: string | null;
};

export function selectFocusSystem(input: FocusSystemInput): string | null {
  const coach = input.coachSystem?.trim() || null;
  const signal = input.signalSystem?.trim() || null;
  const identity = input.identityFocus?.trim() || null;

  // Priority rules:

  // 1. If coach exists → always use coach
  if (coach) return coach;

  // 2. If no coach, but identity exists → expand identity
  if (identity) return identity;

  // 3. If no identity, use signals
  if (signal) return signal;

  return null;
}
