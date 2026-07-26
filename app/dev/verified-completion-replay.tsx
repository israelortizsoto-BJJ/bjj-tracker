import { VerifiedCompletionReplayDevScreen } from "@/src/dev/VerifiedCompletionReplayDevScreen";

export default function VerifiedCompletionReplayRoute() {
  if (!__DEV__) return null;
  return <VerifiedCompletionReplayDevScreen />;
}
