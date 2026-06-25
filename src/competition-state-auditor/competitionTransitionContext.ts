import { generateCompetitionTransitionId } from "./generateCompetitionTransitionId";

type ActiveTransition = {
  transitionId: string;
  sharedAthleteId: string;
};

let activeTransition: ActiveTransition | null = null;

export function beginCompetitionTransition(sharedAthleteId: string): string {
  const trimmed = sharedAthleteId.trim();
  const transitionId = generateCompetitionTransitionId();
  if (trimmed) {
    activeTransition = { transitionId, sharedAthleteId: trimmed };
  }
  return transitionId;
}

export function peekActiveCompetitionTransition(sharedAthleteId?: string): string | undefined {
  if (!activeTransition) return undefined;
  if (sharedAthleteId && activeTransition.sharedAthleteId !== sharedAthleteId.trim()) {
    return undefined;
  }
  return activeTransition.transitionId;
}

export function endCompetitionTransition(transitionId: string): void {
  if (activeTransition?.transitionId === transitionId) {
    activeTransition = null;
  }
}

/** Test-only reset. */
export function __resetCompetitionTransitionContextForTests(): void {
  activeTransition = null;
}
