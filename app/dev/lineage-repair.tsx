import { LineageRepairDevScreen } from "@/src/identity/LineageRepairDevScreen";

export default function LineageRepairRoute() {
  if (!__DEV__) {
    return null;
  }

  return <LineageRepairDevScreen />;
}
