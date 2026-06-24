import type {
  CoachAnalysisReadinessHydrationSource,
  CoachAnalysisReadinessLinkEvidence,
  CoachAnalysisTerminalReadinessResolution,
} from "./coachAnalysisReadinessTypes";
import { logMatchBreakdownAuthorityTrace } from "../../dev/matchBreakdownAuthorityTrace";
import { resolveCoachAnalysisReadinessForAthlete } from "./resolveCoachAnalysisReadiness";
import {
  beginNextCoachAnalysisReadinessGeneration,
  resolveCoachAnalysisReadinessGeneration,
  type CoachAnalysisReadinessStoreWriteOutcome,
} from "../../storage/coachAnalysisReadinessStore";
import type { CoachWeeklySyncSessionResponse } from "../../types/coachWeeklySync";

type BeginGeneration = typeof beginNextCoachAnalysisReadinessGeneration;
type ResolveGeneration = typeof resolveCoachAnalysisReadinessGeneration;

export type CoachAnalysisReadinessRun = {
  recordSuccessfulSession: (
    linkKey: string,
    session: CoachWeeklySyncSessionResponse,
  ) => void;
  recordFailedLink: (linkKey: string) => void;
  finalize: (resolvedAt: string) => Promise<CoachAnalysisReadinessStoreWriteOutcome[]>;
};

function uniqueAthleteIds(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function readinessFinalizeReason(input: {
  sharedAthleteId: string;
  links: readonly CoachAnalysisReadinessLinkEvidence[];
  resolution: ReturnType<typeof resolveCoachAnalysisReadinessForAthlete>;
}): string {
  const athleteId = input.sharedAthleteId.trim();
  if (input.resolution.state === "READY") return "artifact_populated";
  if (input.resolution.state === "EMPTY_READY") return "explicit_empty_artifact_set";
  if (input.resolution.state === "PENDING") return "links_pending";
  for (const link of input.links) {
    if (link.status === "failed") return "link_fetch_failed";
    if (link.status === "pending") continue;
    const classification =
      link.artifactEvidence.athleteEntryClassificationById[athleteId];
    if (classification === "malformed") return "athlete_entry_malformed";
    if (classification === "empty") continue;
    if (classification === "populated") return "artifact_populated";
    if (link.artifactEvidence.fieldClassification === "malformed") {
      return "field_malformed";
    }
    if (link.artifactEvidence.fieldClassification === "omitted") {
      return "field_omitted";
    }
    if (link.artifactEvidence.fieldClassification === "valid") {
      return "valid_field_athlete_absent";
    }
  }
  return "failure_evidence_default";
}

export async function startCoachAnalysisReadinessRun(input: {
  initialSharedAthleteIds: readonly string[];
  linkKeys: readonly string[];
  startedAt: string;
  hydrationSource?: CoachAnalysisReadinessHydrationSource;
  beginGeneration?: BeginGeneration;
  resolveGeneration?: ResolveGeneration;
}): Promise<CoachAnalysisReadinessRun> {
  const beginGeneration =
    input.beginGeneration ?? beginNextCoachAnalysisReadinessGeneration;
  const resolveGeneration =
    input.resolveGeneration ?? resolveCoachAnalysisReadinessGeneration;
  const linkEvidenceByKey = new Map<string, CoachAnalysisReadinessLinkEvidence>(
    input.linkKeys.map((linkKey) => [
      linkKey,
      { linkKey, status: "pending" },
    ]),
  );
  const generationByAthleteId = new Map<string, number>();
  const discoveredAthleteIds = new Set<string>(
    uniqueAthleteIds(input.initialSharedAthleteIds),
  );
  let finalized = false;

  async function beginAthlete(athleteId: string): Promise<void> {
    if (generationByAthleteId.has(athleteId)) return;
    try {
      const outcome = await beginGeneration({
        sharedAthleteId: athleteId,
        startedAt: input.startedAt,
        hydrationSource: input.hydrationSource ?? "coach_writer_sessions",
      });
      if (outcome.status === "written") {
        generationByAthleteId.set(athleteId, outcome.record.generation);
      }
    } catch {
      // Readiness is observational and must not alter hydration behavior.
    }
  }

  for (const athleteId of discoveredAthleteIds) {
    await beginAthlete(athleteId);
  }

  return {
    recordSuccessfulSession(linkKey, session) {
      const artifactSetUpdatedAtByAthleteId = Object.fromEntries(
        Object.entries(session.coachMatchBreakdownArtifacts ?? {}).map(
          ([athleteId, artifactSet]) => [
            athleteId.trim(),
            artifactSet.updatedAt,
          ],
        ),
      );
      linkEvidenceByKey.set(linkKey, {
        linkKey,
        status: "success",
        artifactEvidence:
          session.coachMatchBreakdownArtifactEvidence ?? {
            fieldClassification: "omitted",
            athleteEntryClassificationById: {},
          },
        artifactSetUpdatedAtByAthleteId,
      });
      for (const athlete of session.athletes) {
        const athleteId = athlete.id.trim();
        if (athleteId) discoveredAthleteIds.add(athleteId);
      }
      for (const athleteId of Object.keys(
        session.coachMatchBreakdownArtifactEvidence
          ?.athleteEntryClassificationById ?? {},
      )) {
        const normalized = athleteId.trim();
        if (normalized) discoveredAthleteIds.add(normalized);
      }
    },

    recordFailedLink(linkKey) {
      linkEvidenceByKey.set(linkKey, {
        linkKey,
        status: "failed",
      });
    },

    async finalize(resolvedAt) {
      if (finalized) return [];
      finalized = true;

      for (const athleteId of [...discoveredAthleteIds].sort()) {
        await beginAthlete(athleteId);
      }

      const links = [...linkEvidenceByKey.values()];
      const outcomes: CoachAnalysisReadinessStoreWriteOutcome[] = [];
      for (const athleteId of [...generationByAthleteId.keys()].sort()) {
        const resolution = resolveCoachAnalysisReadinessForAthlete({
          sharedAthleteId: athleteId,
          links,
        });
        let terminalResolution: CoachAnalysisTerminalReadinessResolution;
        if (resolution.state === "PENDING") {
          terminalResolution = { state: "FAILED" };
        } else {
          terminalResolution = {
            state: resolution.state,
            ...(resolution.artifactSetUpdatedAt
              ? {
                  artifactSetUpdatedAt:
                    resolution.artifactSetUpdatedAt,
                }
              : {}),
          };
        }
        try {
          outcomes.push(
            await resolveGeneration({
              sharedAthleteId: athleteId,
              generation: generationByAthleteId.get(athleteId)!,
              resolvedAt,
              resolution: terminalResolution,
            }),
          );
          logMatchBreakdownAuthorityTrace("READINESS_FINALIZE", {
            traceId: null,
            sharedAthleteId: athleteId,
            generation: generationByAthleteId.get(athleteId) ?? null,
            readinessState: terminalResolution.state,
            artifactSetUpdatedAt:
              terminalResolution.state === "READY" ||
              terminalResolution.state === "EMPTY_READY"
                ? (terminalResolution.artifactSetUpdatedAt ?? null)
                : null,
            reason: readinessFinalizeReason({
              sharedAthleteId: athleteId,
              links,
              resolution,
            }),
          });
        } catch {
          // Readiness is observational and must not alter hydration behavior.
        }
      }
      return outcomes;
    },
  };
}
