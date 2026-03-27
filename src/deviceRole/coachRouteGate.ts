/**
 * Parent pilot lane: weekly screen, connect / manage link, family competition editor only.
 * Coach lane may use all routes under this-week/* (including join/manage for QA).
 *
 * Uses navigation segments (not `usePathname`) so tab stacks stay reliable.
 */
export function isParentAllowedCoachSegments(segments: string[]): boolean {
  const laneAt = segments.lastIndexOf("this-week");
  if (laneAt === -1) return true;
  const rest = segments.slice(laneAt + 1);
  if (rest.length === 0) return true;
  const tail = rest.join("/");
  if (tail === "index") return true;
  if (tail === "join") return true;
  if (tail === "parent-athletes") return true;
  if (tail === "manage") return true;
  if (tail === "family-competition/edit") return true;
  return false;
}
