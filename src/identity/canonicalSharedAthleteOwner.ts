import { isKidCoachArchived, type Kid, type KidsById } from "../types/coachKid";

export type CanonicalSharedAthleteOwnerContext = {
  reconcileSource?: string;
  activeWriterInviteTokenNorms?: Set<string>;
};

function pickPrimaryKidForShared(
  claimants: Kid[],
  _ctx?: CanonicalSharedAthleteOwnerContext,
): Kid | null {
  if (claimants.length === 0) return null;
  let best = claimants[0]!;
  for (const k of claimants.slice(1)) {
    const bu = (best.updatedAt ?? "").trim();
    const ku = (k.updatedAt ?? "").trim();
    if (ku.localeCompare(bu) > 0) best = k;
  }
  return best;
}

/** One primary kid row per `sharedAthleteId` (newest `updatedAt` wins). */
export function buildCanonicalSharedAthletePrimaryRowMap(
  kidsById: KidsById,
  ctx?: CanonicalSharedAthleteOwnerContext,
): Map<string, Kid> {
  const byShared = new Map<string, Kid[]>();
  for (const k of Object.values(kidsById)) {
    if (!k?.id) continue;
    if (isKidCoachArchived(k)) continue;
    const sid = (k.sharedAthleteId ?? "").trim();
    if (!sid) continue;
    const list = byShared.get(sid) ?? [];
    list.push(k);
    byShared.set(sid, list);
  }
  const out = new Map<string, Kid>();
  for (const [sid, claimants] of byShared) {
    const primary = pickPrimaryKidForShared(claimants, ctx);
    if (primary) out.set(sid, primary);
  }
  return out;
}

export function getCanonicalKidForSharedAthleteId(
  kidsById: KidsById,
  sharedAthleteId: string,
): Kid | null {
  const sid = typeof sharedAthleteId === "string" ? sharedAthleteId.trim() : "";
  if (!sid) return null;
  const claimants: Kid[] = [];
  for (const k of Object.values(kidsById)) {
    if (!k?.id) continue;
    if (isKidCoachArchived(k)) continue;
    if ((k.sharedAthleteId ?? "").trim() === sid) claimants.push(k);
  }
  return pickPrimaryKidForShared(claimants);
}
