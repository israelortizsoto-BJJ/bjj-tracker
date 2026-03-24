import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { DeviceRole } from "../storage/deviceRoleStore";
import { getDeviceRole, persistDeviceRole } from "../storage/deviceRoleStore";

type DeviceRoleContextValue = {
  role: DeviceRole | null;
  loading: boolean;
  setRole: (next: DeviceRole) => Promise<void>;
};

const DeviceRoleContext = createContext<DeviceRoleContextValue | null>(null);

export function DeviceRoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<DeviceRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await getDeviceRole();
        if (alive) setRoleState(r);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setRole = useCallback(async (next: DeviceRole) => {
    await persistDeviceRole(next);
    setRoleState(next);
  }, []);

  const value = useMemo(
    () => ({ role, loading, setRole }),
    [role, loading, setRole],
  );

  return <DeviceRoleContext.Provider value={value}>{children}</DeviceRoleContext.Provider>;
}

export function useDeviceRole(): DeviceRoleContextValue {
  const ctx = useContext(DeviceRoleContext);
  if (!ctx) {
    throw new Error("useDeviceRole must be used within DeviceRoleProvider");
  }
  return ctx;
}
