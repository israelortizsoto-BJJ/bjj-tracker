import CoachInsightDebugScreen from "@/src/features/coach/CoachInsightDebugScreen";

export default function CoachInsightDebugRoute() {
  if (!__DEV__) {
    return null;
  }

  return <CoachInsightDebugScreen />;
}
