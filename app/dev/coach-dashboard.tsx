import CoachDashboardScreen from "@/src/features/coach/CoachDashboardScreen";

export default function CoachDashboardRoute() {
  if (!__DEV__) {
    return null;
  }

  return <CoachDashboardScreen />;
}
