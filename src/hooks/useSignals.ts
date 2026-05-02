import { useMemo } from "react";

import {
  computeSignals,
  type SignalInput,
  type SignalOutput,
} from "../lib/signals/computeSignals";

export function useSignals(input: SignalInput): SignalOutput {
  return useMemo(() => computeSignals(input), [input]);
}
