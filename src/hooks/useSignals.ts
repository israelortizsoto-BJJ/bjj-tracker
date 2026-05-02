import { useMemo } from "react";

import {
  computeSignals,
  type SignalInput,
  type SignalOutput,
} from "../lib/signals/computeSignals";

export function useSignals(input: SignalInput = {}): SignalOutput {
  const {
    sessions,
    competitions,
    referenceDate,
    declaredInput,
    coachData,
    connectionState,
  } = input;

  return useMemo(() => {
    if (__DEV__) {
      console.log("SIGNALS RUN", Array.isArray(sessions) ? sessions.length : 0);
    }

    return computeSignals({
      sessions,
      competitions,
      referenceDate,
      declaredInput,
      coachData,
      connectionState,
    });
  }, [sessions, competitions, referenceDate, declaredInput, coachData, connectionState]);
}
