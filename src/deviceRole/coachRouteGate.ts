/**
 * Parent pilot lane: weekly screen, connect / manage link, family competition editor only.
 * Coach lane may use all routes under coaches/* (including join/manage for QA).
 *
 * Uses navigation segments (not `usePathname`) so tab stacks stay reliable.
 */
export function isParentAllowedCoachSegments(segments: string[]): boolean {
  const coachesAt = segments.lastIndexOf("coaches");
  if (coachesAt === -1) return true;
  const rest = segments.slice(coachesAt + 1);
  if (rest.length === 0) return true;
  const tail = rest.join("/");
  if (tail === "index") return true;
  if (tail === "join") return true;
  if (tail === "parent-athletes") return true;
  if (tail === "manage") return true;
  if (tail === "family-competition/edit") return true;
  return false;
}
