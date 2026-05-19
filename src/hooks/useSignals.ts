import { useEffect, useMemo, useRef, useState } from "react";

import {
  computeSignals,
  type SignalInput,
  type SignalOutput,
} from "../lib/signals/computeSignals";
import { useDeviceRole } from "../deviceRole/DeviceRoleProvider";
import {
  hasBoundedAggregateVisibility,
  hasFullLocalMatchLineage,
  overlayCompetitionAggregateSignals,
} from "../domain/competition/overlayCompetitionAggregateSignals";
import {
  hasTrainingProofVisibility,
  overlayTrainingProofSignals,
} from "../domain/training/overlayTrainingProofSignals";
import {
  filterSessionsLikeTrainingRefresh,
  normalizeSessionsLikeTraining,
} from "../domain/sessionUtils";
import {
  getCoachCompetitionAggregate,
  peekCoachCompetitionAggregate,
} from "../storage/coachCompetitionAggregateStore";
import {
  getCoachTrainingProof,
  peekCoachTrainingProof,
} from "../storage/coachTrainingProofStore";
import { useCoachSyncHydrationVersion } from "../storage/coachSyncHydrationStore";
import type {
  SyncedCompetitionAggregateArtifact,
  SyncedTrainingProofArtifact,
} from "../types/coachWeeklySync";

import { useAthleteData } from "./useAthleteData";

export function useSignals(input: SignalInput = {}): SignalOutput {
  const {
    referenceDate,
    declaredInput,
    coachData,
    connectionState,
    athleteId,
    kidId,
  } = input;

  const trimmedAthlete =
    typeof athleteId === "string" ? athleteId.trim() : "";
  const linkedKidTrim =
    typeof kidId === "string" && kidId.trim() ? kidId.trim() : null;
  const { role: deviceRole } = useDeviceRole();
  const summaryFlowTraceRole =
    deviceRole === "coach" ? "coach" : deviceRole === "parent" ? "parent" : "unknown";
  const { sessions, competitions } = useAthleteData(
    trimmedAthlete,
    linkedKidTrim,
    summaryFlowTraceRole,
  );

  const lastSignalsAthleteScopeRef = useRef<string | null>(null);
  const [coachAggregate, setCoachAggregate] =
    useState<SyncedCompetitionAggregateArtifact | null>(() =>
      deviceRole === "coach" && trimmedAthlete
        ? peekCoachCompetitionAggregate(trimmedAthlete)
        : null,
    );
  const [coachTrainingProof, setCoachTrainingProof] =
    useState<SyncedTrainingProofArtifact | null>(() =>
      deviceRole === "coach" && trimmedAthlete
        ? peekCoachTrainingProof(trimmedAthlete)
        : null,
    );

  const hydrationVersion = useCoachSyncHydrationVersion();
  const prevHydrationVersionRef = useRef(hydrationVersion);

  useEffect(() => {
    if (deviceRole !== "coach" || !trimmedAthlete) {
      setCoachAggregate(null);
      setCoachTrainingProof(null);
      prevHydrationVersionRef.current = hydrationVersion;
      return;
    }

    const triggeredByHydrationInvalidation =
      prevHydrationVersionRef.current !== hydrationVersion;

    if (__DEV__ && triggeredByHydrationInvalidation) {
      console.log("[COACH_SYNC_HYDRATION] useSignals_overlay_reload", {
        hydrationVersion,
        athleteId: trimmedAthlete,
        deviceRole,
      });
    }

    prevHydrationVersionRef.current = hydrationVersion;

    let mounted = true;
    const athleteId = trimmedAthlete;
    const peekedAggregate = peekCoachCompetitionAggregate(athleteId);
    if (peekedAggregate) setCoachAggregate(peekedAggregate);
    const peekedProof = peekCoachTrainingProof(athleteId);
    if (peekedProof) setCoachTrainingProof(peekedProof);

    void getCoachCompetitionAggregate(athleteId).then((artifact) => {
      if (!mounted) return;
      setCoachAggregate(artifact);
    });
    void getCoachTrainingProof(athleteId).then((artifact) => {
      if (!mounted) return;
      setCoachTrainingProof(artifact);
    });

    return () => {
      mounted = false;
    };
  }, [hydrationVersion, deviceRole, trimmedAthlete]);

  return useMemo(() => {
    const hasAthlete = trimmedAthlete.length > 0;

    if (__DEV__) {
      const prevScope = lastSignalsAthleteScopeRef.current;
      if (prevScope !== null && prevScope !== trimmedAthlete) {
        // TEMP Phase 1 authority stabilization
        console.log("[useSignals] athlete scope transition (signals reset to scoped input)", {
          from: prevScope.length > 0 ? prevScope : "(no OAI)",
          to: trimmedAthlete.length > 0 ? trimmedAthlete : "(no OAI)",
        });
      }
      lastSignalsAthleteScopeRef.current = trimmedAthlete.length > 0 ? trimmedAthlete : "";
    }

    const scopedSessions = hasAthlete
      ? filterSessionsLikeTrainingRefresh(
          normalizeSessionsLikeTraining(sessions),
          {
            deviceRole,
            athleteId: trimmedAthlete,
            linkedKidId:
              typeof kidId === "string" && kidId.trim() ? kidId.trim() : undefined,
          },
        )
      : [];

    const scopedCompetitions = hasAthlete ? competitions : [];

    if (__DEV__ && hasAthlete) {
      const lk = linkedKidTrim ?? "";
      const matchedBySharedCount = sessions.filter(
        (s) => (s.sharedAthleteId ?? "").trim() === trimmedAthlete,
      ).length;
      const matchedByKidCount = lk
        ? sessions.filter((s) => (s.kidId ?? "").trim() === lk).length
        : 0;
      console.log("[SUMMARY_SESSION_SOURCE]", {
        athleteId: trimmedAthlete,
        linkedKidId: lk || null,
        totalSessionsLoaded: sessions.length,
        matchedBySharedCount,
        matchedByKidCount,
        finalSessionIds: scopedSessions.map((s) => s.id),
      });
    }

    if (__DEV__) {
      console.log("SIGNALS INPUT", {
        athleteId: hasAthlete ? trimmedAthlete : null,
        sessionCount: scopedSessions.length,
        competitionCount: scopedCompetitions.length,
      });
      if (!hasAthlete) {
        // TEMP Phase 1 authority stabilization
        console.log("[useSignals] neutral signals: missing operating athlete (no prior output reuse)");
      }
    }

    const computed = computeSignals({
      sessions: scopedSessions,
      competitions: scopedCompetitions,
      referenceDate,
      declaredInput: hasAthlete ? declaredInput : undefined,
      coachData: hasAthlete ? coachData : undefined,
      connectionState: hasAthlete ? connectionState : undefined,
      athleteId: hasAthlete ? trimmedAthlete : null,
      kidId: hasAthlete ? kidId : null,
    });

    const localSessionCount = scopedSessions.length;

    if (deviceRole !== "coach" || !hasAthlete) {
      if (__DEV__ && hasAthlete) {
        console.log("[SUMMARY_PROOF_CONSUME]", {
          athleteId: trimmedAthlete,
          proofCount: null,
          localSessionCount,
          finalSessionCount: computed.frequency.weeklySessionCount,
          source: deviceRole !== "coach" ? "parent_local_signals" : "no_athlete",
        });
        console.log("[TRAINING_PROOF_OVERLAY]", {
          athleteId: trimmedAthlete,
          role: deviceRole,
          localSessionCount,
          proofSessionCount: null,
          overlayApplied: false,
          overlayReason: deviceRole !== "coach" ? "not_coach" : "no_athlete",
          finalSessionCount: computed.frequency.weeklySessionCount,
          dominantSystems: {
            local: computed.dominantObservedSystem,
            proof: null,
            final: computed.dominantObservedSystem,
          },
        });
      }
      return computed;
    }

    let withCoachOverlays = computed;
    let overlayApplied = false;
    let overlayReason:
      | "overlay_missing"
      | "overlay_hidden_visibility"
      | "overlay_applied" = "overlay_missing";
    const proof = coachTrainingProof;
    const proofSessionCount = proof?.currentWeekSessionCount ?? null;

    const localMatchLineage = hasFullLocalMatchLineage(scopedCompetitions);
    if (localMatchLineage) {
      if (__DEV__) {
        console.log("[COMP_AGG_TRACE] overlay_skipped_local_matches", {
          sharedAthleteId: trimmedAthlete,
        });
      }
    } else {
      const aggregate = coachAggregate;
      if (!aggregate) {
        if (__DEV__) {
          console.log("[COMP_AGG_TRACE] overlay_missing", {
            sharedAthleteId: trimmedAthlete,
          });
        }
      } else if (!hasBoundedAggregateVisibility(aggregate, trimmedAthlete)) {
        if (__DEV__) {
          console.log("[COMP_AGG_TRACE] overlay_incomplete", {
            sharedAthleteId: trimmedAthlete,
            totalMatches: aggregate.totalMatches,
            wins: aggregate.wins,
            losses: aggregate.losses,
          });
        }
      } else {
        if (__DEV__) {
          console.log("[COMP_AGG_TRACE] overlay_applied", {
            sharedAthleteId: trimmedAthlete,
            totalMatches: aggregate.totalMatches,
            wins: aggregate.wins,
            losses: aggregate.losses,
          });
        }
        withCoachOverlays = overlayCompetitionAggregateSignals(withCoachOverlays, aggregate);
      }
    }

    if (!proof) {
      overlayReason = "overlay_missing";
      if (__DEV__) {
        console.log("[SUMMARY_PROOF_CONSUME]", {
          athleteId: trimmedAthlete,
          proofCount: null,
          localSessionCount,
          finalSessionCount: withCoachOverlays.frequency.weeklySessionCount,
          source: "coach_local_signals_no_proof",
        });
        console.log("[TRAINING_PROOF_OVERLAY]", {
          athleteId: trimmedAthlete,
          role: deviceRole,
          localSessionCount,
          proofSessionCount: null,
          overlayApplied,
          overlayReason,
          finalSessionCount: withCoachOverlays.frequency.weeklySessionCount,
          dominantSystems: {
            local: computed.dominantObservedSystem,
            proof: null,
            final: withCoachOverlays.dominantObservedSystem,
          },
        });
      }
      return withCoachOverlays;
    }

    if (!hasTrainingProofVisibility(proof, trimmedAthlete)) {
      overlayReason = "overlay_hidden_visibility";
      if (__DEV__) {
        console.log("[SUMMARY_PROOF_CONSUME]", {
          athleteId: trimmedAthlete,
          proofCount: proofSessionCount,
          localSessionCount,
          finalSessionCount: withCoachOverlays.frequency.weeklySessionCount,
          source: "coach_proof_hidden_visibility",
        });
        console.log("[TRAINING_PROOF_OVERLAY]", {
          athleteId: trimmedAthlete,
          role: deviceRole,
          localSessionCount,
          proofSessionCount,
          overlayApplied,
          overlayReason,
          finalSessionCount: withCoachOverlays.frequency.weeklySessionCount,
          dominantSystems: {
            local: computed.dominantObservedSystem,
            proof: proof.dominantSystemKey,
            final: withCoachOverlays.dominantObservedSystem,
          },
          proofVisibility: {
            currentWeekSessionCount: proof.currentWeekSessionCount,
            lastTrainingDateYMD: proof.lastTrainingDateYMD,
            topSystemsLen: proof.topSystems.length,
            topTechniquesLen: proof.topTechniques.length,
          },
        });
      }
      return withCoachOverlays;
    }

    overlayApplied = true;
    overlayReason = "overlay_applied";
    const withTrainingProof = overlayTrainingProofSignals(withCoachOverlays, proof);

    if (__DEV__) {
      console.log("[SUMMARY_PROOF_CONSUME]", {
        athleteId: trimmedAthlete,
        proofCount: proofSessionCount,
        localSessionCount,
        finalSessionCount: withTrainingProof.frequency.weeklySessionCount,
        source: "coach_proof_overlay_applied",
      });
      console.log("[TRAINING_PROOF_OVERLAY]", {
        athleteId: trimmedAthlete,
        role: deviceRole,
        localSessionCount,
        proofSessionCount,
        overlayApplied,
        overlayReason,
        finalSessionCount: withTrainingProof.frequency.weeklySessionCount,
        dominantSystems: {
          local: computed.dominantObservedSystem,
          proof: proof.dominantSystemKey,
          final: withTrainingProof.dominantObservedSystem,
        },
        weeklyGoalMet: proof.weeklyGoalMet,
      });
    }

    return withTrainingProof;
  }, [
    sessions,
    competitions,
    coachAggregate,
    coachTrainingProof,
    deviceRole,
    linkedKidTrim,
    referenceDate,
    declaredInput,
    coachData,
    connectionState,
    trimmedAthlete,
    kidId,
  ]);
}
