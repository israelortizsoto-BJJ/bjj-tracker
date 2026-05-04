import { useEffect, useRef } from "react";

import CoachDashboardScreen from "@/src/features/coach/CoachDashboardScreen";

export default function CoachTab() {
  const mountRef = useRef(0);
  useEffect(() => {
    mountRef.current += 1;
    console.log("[MOUNT_TRACE:COACH_DASHBOARD]", mountRef.current);
  }, []);

  return <CoachDashboardScreen />;
}
