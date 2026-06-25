import {
  MATMIND_AUDIT_SNAPSHOT_HEADER,
  type WorkerPersistSnapshot,
} from "./competitionStateAuditorContract";
import { persistCompetitionStateSnapshot } from "./competitionStateAuditorRing";

export function parseWorkerPersistSnapshotHeader(
  headerValue: string | null,
): WorkerPersistSnapshot | null {
  if (!headerValue?.trim()) return null;
  try {
    const parsed = JSON.parse(headerValue) as WorkerPersistSnapshot;
    if (parsed?.snapshotKind !== "worker_persist") return null;
    if (!parsed.transitionId || !parsed.sharedAthleteId || !parsed.domain) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function captureWorkerPersistSnapshotFromResponse(
  response: Pick<Response, "headers">,
): void {
  const raw = response.headers.get(MATMIND_AUDIT_SNAPSHOT_HEADER);
  const snapshot = parseWorkerPersistSnapshotHeader(raw);
  if (snapshot) persistCompetitionStateSnapshot(snapshot);
}
