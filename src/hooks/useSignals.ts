import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useRef, useState } from "react";

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

  useFocusEffect(
    useCallback(() => {
      if (deviceRole !== "coach" || !trimmedAthlete) {
        setCoachAggregate(null);
        setCoachTrainingProof(null);
        return;
      }

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
    }, [deviceRole, trimmedAthlete]),
  );

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

    if (deviceRole !== "coach" || !hasAthlete) {
      return computed;
    }

    let withCoachOverlays = computed;

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

    const proof = coachTrainingProof;
    if (!proof) {
      if (__DEV__) {
        console.log("[TRAINING_PROOF_OVERLAY] overlay_missing", {
          sharedAthleteId: trimmedAthlete,
        });
      }
      return withCoachOverlays;
    }

    if (!hasTrainingProofVisibility(proof, trimmedAthlete)) {
      if (__DEV__) {
        console.log("[TRAINING_PROOF_OVERLAY] overlay_hidden_visibility", {
          sharedAthleteId: trimmedAthlete,
          currentWeekSessionCount: proof.currentWeekSessionCount,
          lastTrainingDateYMD: proof.lastTrainingDateYMD,
        });
      }
      return withCoachOverlays;
    }

    if (__DEV__) {
      console.log("[TRAINING_PROOF_OVERLAY] overlay_applied", {
        sharedAthleteId: trimmedAthlete,
        currentWeekSessionCount: proof.currentWeekSessionCount,
        weeklyGoalMet: proof.weeklyGoalMet,
      });
    }

    return overlayTrainingProofSignals(withCoachOverlays, proof);
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
