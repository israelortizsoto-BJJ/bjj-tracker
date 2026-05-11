/**
 * Canonical athlete metadata: belt rank, experience maturity, and competitor flag are independent.
 * Stored `beltRank` / `experienceLevel` values are lowercase snake_case tokens (e.g. `grey_white`, `beginner`).
 */

export const ATHLETE_BELT_RANK_OPTIONS = [
  { value: "white", label: "White" },
  { value: "grey_white", label: "Grey/White" },
  { value: "grey", label: "Grey" },
  { value: "grey_black", label: "Grey/Black" },
  { value: "yellow_white", label: "Yellow/White" },
  { value: "yellow", label: "Yellow" },
  { value: "yellow_black", label: "Yellow/Black" },
  { value: "orange_white", label: "Orange/White" },
  { value: "orange", label: "Orange" },
  { value: "orange_black", label: "Orange/Black" },
  { value: "green_white", label: "Green/White" },
  { value: "green", label: "Green" },
  { value: "green_black", label: "Green/Black" },
  { value: "blue", label: "Blue" },
  { value: "purple", label: "Purple" },
  { value: "brown", label: "Brown" },
  { value: "black", label: "Black" },
] as const;

export type AthleteBeltRankKey = (typeof ATHLETE_BELT_RANK_OPTIONS)[number]["value"];

const BELT_RANK_SET: ReadonlySet<string> = new Set(
  ATHLETE_BELT_RANK_OPTIONS.map((o) => o.value),
);

const BELT_LABEL_BY_VALUE: Readonly<Record<string, string>> = Object.fromEntries(
  ATHLETE_BELT_RANK_OPTIONS.map((o) => [o.value, o.label]),
);

export const ATHLETE_EXPERIENCE_LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "developing", label: "Developing" },
  { value: "experienced", label: "Experienced" },
] as const;

export type AthleteExperienceLevelKey = (typeof ATHLETE_EXPERIENCE_LEVEL_OPTIONS)[number]["value"];

const EXPERIENCE_SET: ReadonlySet<string> = new Set(
  ATHLETE_EXPERIENCE_LEVEL_OPTIONS.map((o) => o.value),
);

/** Legacy placeholder from older onboarding — not a real rank; maps to “unknown” until the user picks a belt. */
const LEGACY_NON_RANK_BELTS = new Set(["kids"]);

function titleCaseWords(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Normalize free text / legacy storage toward a snake_case key for lookup.
 */
export function normalizeBeltRankStorageKey(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/\s+belt\s*$/i, "");
  s = s.replace(/\bgray\b/g, "grey");
  s = s.replace(/\//g, "_");
  s = s.replace(/[\s-]+/g, "_");
  s = s.replace(/_+/g, "_");
  s = s.replace(/^_|_$/g, "");
  return s;
}

export function isKnownAthleteBeltRank(value: string): boolean {
  return BELT_RANK_SET.has(value.trim());
}

export function isKnownAthleteExperienceLevel(value: string): boolean {
  return EXPERIENCE_SET.has(value.trim().toLowerCase());
}

/**
 * Map stored belt string to a canonical `ATHLETE_BELT_RANK_OPTIONS` value, or "" if unknown / legacy placeholder.
 */
export function canonicalBeltRankFromStored(raw: string | undefined): string {
  if (!raw?.trim()) return "";
  const k = normalizeBeltRankStorageKey(raw);
  if (!k || LEGACY_NON_RANK_BELTS.has(k)) return "";
  if (BELT_RANK_SET.has(k)) return k;
  const fromLabel = ATHLETE_BELT_RANK_OPTIONS.find(
    (o) => normalizeBeltRankStorageKey(o.label) === k,
  );
  return fromLabel?.value ?? "";
}

export function canonicalExperienceLevelFromStored(raw: string | undefined): string {
  if (!raw?.trim()) return "";
  const k = raw.trim().toLowerCase();
  const hit = ATHLETE_EXPERIENCE_LEVEL_OPTIONS.find((o) => o.value === k);
  return hit?.value ?? "";
}

/**
 * Display label for summary / headers. Returns null when empty.
 * Unknown non-empty values (e.g. old custom text) still render readably.
 */
export function formatAthleteBeltRankLabel(beltRank: string | undefined): string | null {
  const t = beltRank?.trim();
  if (!t) return null;
  const canonical = canonicalBeltRankFromStored(t);
  if (canonical) {
    const mapped = BELT_LABEL_BY_VALUE[canonical];
    return mapped ? `${mapped} Belt` : null;
  }
  const base = t.replace(/\s+belt\s*$/i, "").trim();
  if (!base) return null;
  return `${titleCaseWords(base.replace(/_/g, " "))} Belt`;
}

export function formatAthleteExperienceLevelLabel(experienceLevel: string | undefined): string | null {
  const t = experienceLevel?.trim();
  if (!t) return null;
  const k = t.toLowerCase();
  const hit = ATHLETE_EXPERIENCE_LEVEL_OPTIONS.find((o) => o.value === k);
  if (hit) return hit.label;
  return titleCaseWords(t);
}

/** Belt contribution weights for identity score — kids interpolated between white and blue. */
export const ATHLETE_BELT_IDENTITY_WEIGHT: Readonly<Record<string, number>> = {
  white: 20,
  grey_white: 22,
  grey: 24,
  grey_black: 26,
  yellow_white: 28,
  yellow: 30,
  yellow_black: 32,
  orange_white: 33,
  orange: 34,
  orange_black: 35,
  green_white: 36,
  green: 37,
  green_black: 38,
  blue: 40,
  purple: 70,
  brown: 85,
  black: 95,
};

export function resolveBeltRankForIdentityScore(beltRank: string | undefined | null): string {
  const c = canonicalBeltRankFromStored(beltRank ?? "");
  if (c) return c;
  const head = normalizeBeltRankStorageKey(beltRank ?? "").split("_")[0] ?? "";
  return head;
}
