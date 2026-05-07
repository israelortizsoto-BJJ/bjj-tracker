export type CoachSignal = {
  system: string | null;
  type: "strength" | "weakness" | "focus";
  confidence: number; // 0–1 (low weight)
};

export type CoachSignalsAggregate = Record<
  string,
  { strength: number; weakness: number; focus: number }
>;

const WEAKNESS_KEYWORDS = [
  "got passed",
  "lost position",
  "swept",
  "couldn't escape",
  "late reaction",
];

const STRENGTH_KEYWORDS = ["controlled", "good pressure", "dominant", "kept position"];

const FOCUS_KEYWORDS = ["needs to", "should work on", "focus on", "improve"];

const SYSTEM_KEYWORDS = {
  guard: ["guard", "retention"],
  passing: ["pass", "passing"],
  takedown: ["takedown", "wrestling"],
  back: ["back control", "back"],
  escapes: ["escape", "defense"],
} as const;

function detectSystem(note: string): string | null {
  const lower = note.toLowerCase();

  for (const [system, keywords] of Object.entries(SYSTEM_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) {
      return system;
    }
  }

  return null;
}

export function deriveCoachSignals(notes: string[]): CoachSignal[] {
  if (!notes || notes.length === 0) return [];

  const signals: CoachSignal[] = [];

  for (const raw of notes) {
    const note = raw.toLowerCase();

    const system = detectSystem(note);

    if (WEAKNESS_KEYWORDS.some((k) => note.includes(k))) {
      signals.push({ system, type: "weakness", confidence: 0.5 });
      continue;
    }

    if (STRENGTH_KEYWORDS.some((k) => note.includes(k))) {
      signals.push({ system, type: "strength", confidence: 0.5 });
      continue;
    }

    if (FOCUS_KEYWORDS.some((k) => note.includes(k))) {
      signals.push({ system, type: "focus", confidence: 0.4 });
    }
  }

  return signals;
}

export function aggregateCoachSignals(signals: CoachSignal[]): CoachSignalsAggregate {
  const result: CoachSignalsAggregate = {};

  for (const s of signals) {
    if (!s.system) continue;

    if (!result[s.system]) {
      result[s.system] = {
        strength: 0,
        weakness: 0,
        focus: 0,
      };
    }

    result[s.system][s.type] += s.confidence;
  }

  return result;
}
