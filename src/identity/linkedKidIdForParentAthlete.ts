import type { KidsById } from "../types/coachKid";

export type LinkedKidForParentAthleteOptions = Record<string, never>;

export function linkedKidIdForParentAthlete(
  kidsById: KidsById,
  athleteId: string,
): string | null {
  const aid = typeof athleteId === "string" ? athleteId.trim() : "";
  if (!aid) return null;
  for (const k of Object.values(kidsById)) {
    if (!k?.id) continue;
    if ((k.sharedAthleteId ?? "").trim() === aid) return k.id;
  }
  return null;
}
