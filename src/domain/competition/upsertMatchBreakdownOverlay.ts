import { writeCoachMatchBreakdownOverlay } from "../../storage/coachMatchBreakdownOverlayStore";
import type {
  CoachMatchBreakdownOverlay,
  CoachMatchBreakdownOverlayIdentity,
  CoachMatchBreakdownOverlayPatch,
} from "../../types/coachMatchBreakdownOverlay";

/** Coach-owned annotation write. Never mutates competition shells or canonical topology. */
export async function upsertMatchBreakdownOverlay(input: {
  identity: CoachMatchBreakdownOverlayIdentity;
  patch: CoachMatchBreakdownOverlayPatch;
  updatedAt?: string;
  traceId?: string | null;
}): Promise<CoachMatchBreakdownOverlay | null> {
  return writeCoachMatchBreakdownOverlay({
    identity: input.identity,
    patch: input.patch,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    traceId: input.traceId ?? null,
  });
}
