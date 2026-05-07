import { useMemo, useRef } from "react";

import {
  computeSignals,
  type SignalInput,
  type SignalOutput,
} from "../lib/signals/computeSignals";

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
  const { sessions, competitions } = useAthleteData(trimmedAthlete);

  const previousSignalsRef = useRef<SignalOutput | null>(null);

  return useMemo(() => {
    const hasAthlete = trimmedAthlete.length > 0;

    if (__DEV__) {
      console.log("SIGNALS INPUT", {
        athleteId: hasAthlete ? trimmedAthlete : null,
        sessionCount: sessions.length,
        competitionCount: competitions.length,
      });
    }

    if (!hasAthlete) {
      if (previousSignalsRef.current !== null) {
        if (__DEV__) {
          console.warn("⚠️ Skipping signals: missing athleteId");
        }
        return previousSignalsRef.current;
      }
    }

    const computed = computeSignals({
      sessions,
      competitions,
      referenceDate,
      declaredInput,
      coachData,
      connectionState,
      athleteId: hasAthlete ? trimmedAthlete : null,
      kidId,
    });

    if (hasAthlete) {
      previousSignalsRef.current = computed;
    }

    return computed;
  }, [
    sessions,
    competitions,
    referenceDate,
    declaredInput,
    coachData,
    connectionState,
    trimmedAthlete,
    kidId,
  ]);
}
