export type TrainingSkillBucket =
  | "guard_retention"
  | "sweeps"
  | "submissions"
  | "defense"
  | "positioning";

const BUCKET_KEYWORD_GROUPS: Record<TrainingSkillBucket, readonly string[]> = {
  guard_retention: [
    "closed guard",
    "open guard",
    "playing guard",
    "guard retention",
    "retention",
    "got passed",
    "getting passed",
    "passed guard",
    "passed my guard",
    "lost guard",
    "bottom",
    "pulled guard",
    "de la riva",
    "half guard",
    "x guard",
    "lasso spider",
    "invert",
    "berimbolo",
  ],
  sweeps: ["sweep timing", "sweep", "hip bump", "scissor sweep", "pendulum sweep", "flower sweep"],
  submissions: [
    "choke",
    "armbar",
    "triangle",
    "kimura",
    "americana",
    "leg lock",
    "heel hook",
    "straight ankle lock",
    "bow and arrow",
    "rear naked",
    "rnc",
    "cross collar",
    "loop choke",
    "guillotine",
    "anaconda",
    "darce",
    "finish",
    "finished",
  ],
  defense: [
    "defense",
    "escape",
    "escaped",
    "survived mount",
    "mounted",
    "side control pressure",
    "side control stuck",
    "back taken",
    "turtle stuck",
    "submitted",
    "tapped",
    "could not escape",
  ],
  positioning: [
    "points",
    "point battle",
    "advantage",
    "stand up wrestling",
    "takedown",
    "pressure pass",
    "top pressure",
    "positional",
    "scrambled",
    "scoring",
    "down on points",
  ],
};

function normalizedHaystack(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Lightweight keyword tagging on free text — deterministic substring match (longer phrases win order).
 */
/** Lowercase cue phrase aligned with summaries and coach copy (same naming as legacy `BUCKET_CUE_FRAGMENTS`). */
export const SKILL_BUCKET_TOPIC_PHRASES: Record<TrainingSkillBucket, string> = {
  guard_retention: "guard retention",
  sweeps: "sweep timing",
  submissions: "submission chains",
  defense: "defense and escapes",
  positioning: "positional control and scoring",
};

export function trainingSkillPhraseTitleCase(phrase: string): string {
  return phrase
    .split(" ")
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function trainingSkillBucketDisplayLabel(bucket: TrainingSkillBucket): string {
  return trainingSkillPhraseTitleCase(SKILL_BUCKET_TOPIC_PHRASES[bucket]);
}

export function trainingSkillBucketTopicPhrase(bucket: TrainingSkillBucket): string {
  return SKILL_BUCKET_TOPIC_PHRASES[bucket];
}

export function inferSkillBucketsFromText(raw: string): TrainingSkillBucket[] {
  const h = normalizedHaystack(raw);
  if (!h) return [];
  const hit = new Set<TrainingSkillBucket>();
  const ordered = (Object.keys(BUCKET_KEYWORD_GROUPS) as TrainingSkillBucket[]).flatMap((b) =>
    [...BUCKET_KEYWORD_GROUPS[b]]
      .sort((a, x) => x.length - a.length)
      .map((phrase) => ({ bucket: b, phrase: phrase.toLowerCase() })),
  );
  ordered.sort((a, b) => b.phrase.length - a.phrase.length);
  for (const { bucket, phrase } of ordered) {
    if (h.includes(phrase)) hit.add(bucket);
  }
  return [...hit];
}
