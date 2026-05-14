import { useMemo, useRef } from "react";

import {
  computeSignals,
  type SignalInput,
  type SignalOutput,
} from "../lib/signals/computeSignals";
import { useDeviceRole } from "../deviceRole/DeviceRoleProvider";
import {
  filterSessionsLikeTrainingRefresh,
  normalizeSessionsLikeTraining,
} from "../domain/sessionUtils";

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

    return computed;
  }, [
    sessions,
    competitions,
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
