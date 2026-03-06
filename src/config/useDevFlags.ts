import { useEffect, useState } from "react";
import { DEFAULT_DEV_FLAGS, type DevFlags, applyDevGuard } from "./flags";
import { loadDevFlags } from "./devFlagsStore";

export function useDevFlags() {
  const [flags, setFlags] = useState<DevFlags>(DEFAULT_DEV_FLAGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const loaded = await loadDevFlags();
      setFlags(applyDevGuard(loaded));
      setReady(true);
    })();
  }, []);

  return { flags, ready };
}
