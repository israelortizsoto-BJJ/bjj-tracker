/**
 * Optional per-match submission classification (stored on `CompetitionDetailMatchSnapshot.submissionType`).
 * Keys are stable snake_case; labels are display-only.
 */
export const SUBMISSION_TYPE_CHIPS: readonly { key: string; label: string }[] = [
  { key: "armbar", label: "Armbar" },
  { key: "triangle", label: "Triangle" },
  { key: "rear_naked_choke", label: "Rear naked choke" },
  { key: "guillotine", label: "Guillotine" },
  { key: "kimura", label: "Kimura" },
  { key: "americana", label: "Americana" },
  { key: "bow_and_arrow", label: "Bow and arrow" },
  { key: "ankle_lock", label: "Ankle lock" },
  { key: "heel_hook", label: "Heel hook" },
  { key: "toe_hold", label: "Toe hold" },
  { key: "ezekiel", label: "Ezekiel" },
  { key: "baseball_bat_choke", label: "Baseball bat choke" },
  { key: "cross_collar", label: "Cross collar" },
  { key: "omoplata", label: "Omoplata" },
  { key: "darce", label: "Darce" },
  { key: "anaconda", label: "Anaconda" },
  { key: "other", label: "Other" },
] as const;

const KEY_TO_LABEL = new Map(SUBMISSION_TYPE_CHIPS.map((c) => [c.key, c.label]));
const VALID_KEYS = new Set(KEY_TO_LABEL.keys());

export function normalizeStoredSubmissionType(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const k = raw.trim().toLowerCase();
  if (!k || !VALID_KEYS.has(k)) return null;
  return k;
}

export function labelForSubmissionTypeKey(key: string | null | undefined): string | null {
  if (typeof key !== "string" || !key.trim()) return null;
  return KEY_TO_LABEL.get(key.trim().toLowerCase()) ?? null;
}
