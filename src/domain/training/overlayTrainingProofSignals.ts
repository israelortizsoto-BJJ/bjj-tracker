import type { SignalOutput } from "../../lib/signals/computeSignals";
import type { SyncedTrainingProofArtifact } from "../../types/coachWeeklySync";

/** Parent-published proof is scoped to the athlete and carries bounded training metrics. */
export function hasTrainingProofVisibility(
  artifact: SyncedTrainingProofArtifact,
  expectedSharedAthleteId: string,
): boolean {
  const athleteId = expectedSharedAthleteId.trim();
  if (!athleteId) return false;
  if (artifact.sharedAthleteId.trim() !== athleteId) return false;
  return (
    artifact.currentWeekSessionCount > 0 ||
    Boolean(artifact.lastTrainingDateYMD) ||
    artifact.topSystems.length > 0 ||
    artifact.topTechniques.length > 0
  );
}

/**
 * Coach Summary only: shallow bounded training overlay from a hydrated parent proof artifact.
 * Does not touch streaks, gear, exposure, competition, timelines, or Session[].
 */
export function overlayTrainingProofSignals(
  signals: SignalOutput,
  artifact: SyncedTrainingProofArtifact,
): SignalOutput {
  const topSystemLabel = artifact.topSystems[0]?.label ?? null;
  const dominant = artifact.dominantSystemKey;

  return {
    ...signals,
    frequency: {
      ...signals.frequency,
      weeklySessionCount: artifact.currentWeekSessionCount,
    },
    consistency: {
      ...signals.consistency,
      currentWeekCount: artifact.currentWeekSessionCount,
      goalMet: artifact.weeklyGoalMet,
    },
    techniques: {
      ...signals.techniques,
      topTechniques: artifact.topTechniques,
    },
    systems: {
      ...signals.systems,
      topSystem: topSystemLabel,
    },
    patterns: {
      ...signals.patterns,
      topSystem: dominant ?? topSystemLabel,
    },
    dominantObservedSystem: dominant,
  };
}
