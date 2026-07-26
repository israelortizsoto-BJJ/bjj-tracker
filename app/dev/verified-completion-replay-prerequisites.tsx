import { VerifiedCompletionReplayPrerequisiteInspectorDevScreen } from "@/src/dev/VerifiedCompletionReplayPrerequisiteInspectorDevScreen";

export default function VerifiedCompletionReplayPrerequisiteInspectorRoute() {
  if (!__DEV__) return null;
  return <VerifiedCompletionReplayPrerequisiteInspectorDevScreen />;
}
