export type IdentitySuggestionSource = "signals" | "coach" | "activity";

export type IdentitySuggestion = {
  type: "skill" | "competitor" | "experience";
  message: string;
  suggestedValue?: string | boolean;

  confidence: number; // 0–1
  priority: number; // higher = more important

  source: IdentitySuggestionSource;
  context: string | null;
};

export type IdentitySuggestionInputs = {
  declaredSkills?: string[] | null;
  isCompetitor?: boolean | null;
  experienceLevel?: string | null;

  signals?: any | null;
  coachSignals?: Record<
    string,
    { strength: number; weakness: number; focus: number }
  > | null;

  validation?: any | null;
  sessionCount?: number;
  competitionCount?: number;
};

function formatLabel(value?: string | null) {
  if (!value) return null;
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function hasTrainingFocus(signals: IdentitySuggestionInputs["signals"]): boolean {
  if (!signals || typeof signals !== "object") return false;
  const tf = (signals as { trainingFocus?: unknown }).trainingFocus;
  return typeof tf === "string" && tf.trim().length > 0;
}

function getObservedFocus(signals: any) {
  return (
    signals?.patterns?.topSystem ||
    signals?.patterns?.topTechnique ||
    signals?.systems?.topSystem ||
    null
  );
}

function normalizeSystemToken(raw: string) {
  return raw.toLowerCase().replace(/_/g, "").trim();
}

function coachSignalsSupportObservedSystem(
  coachSignals: IdentitySuggestionInputs["coachSignals"],
  observed: string,
): boolean {
  if (!coachSignals || !observed) return false;
  const obs = normalizeSystemToken(observed);
  if (!obs) return false;

  for (const [key, agg] of Object.entries(coachSignals)) {
    const k = normalizeSystemToken(key);
    if (!k) continue;
    const touches =
      obs === k || obs.includes(k) || k.includes(obs);
    if (!touches) continue;
    const hasSignal =
      (agg.focus ?? 0) > 0 ||
      (agg.strength ?? 0) > 0 ||
      (agg.weakness ?? 0) > 0;
    if (hasSignal) return true;
  }

  return false;
}

function capConfidence(confidence: number): number {
  return Math.min(confidence, 1.0);
}

function contextForConfidence(confidence: number, line: string): string | null {
  if (confidence < 0.6) return null;
  return line;
}

function deriveSkillSuggestion(inputs: IdentitySuggestionInputs): IdentitySuggestion | null {
  const observed = getObservedFocus(inputs.signals);

  if (!observed) return null;
  if (!inputs.validation || inputs.validation.skills !== "mismatch") {
    return null;
  }

  const declared = inputs.declaredSkills ?? [];
  if (declared.includes(observed)) return null;

  let confidence = 0.8;
  if ((inputs.sessionCount ?? 0) < 12) {
    confidence = 0.5;
  }

  const coachAligned = coachSignalsSupportObservedSystem(
    inputs.coachSignals,
    observed,
  );
  if (coachAligned) {
    confidence += 0.1;
  }

  confidence = capConfidence(confidence);

  const source: IdentitySuggestionSource = coachAligned ? "coach" : "signals";
  const contextLine =
    source === "coach"
      ? "Based on recent competition feedback"
      : "Based on recent training patterns";

  const label = formatLabel(observed);
  const focusSet = hasTrainingFocus(inputs.signals);
  const message = focusSet
    ? `Consider aligning your focus with ${label}. Updating your recognized skills can keep your profile in sync with that emphasis.`
    : `You're building patterns around ${label}. Consider adding ${label} to your recognized skills if it reflects your training.`;

  return {
    type: "skill",
    message,
    suggestedValue: observed,
    confidence,
    priority: 3,
    source,
    context: contextForConfidence(confidence, contextLine),
  };
}

function deriveCompetitorSuggestion(
  inputs: IdentitySuggestionInputs,
): IdentitySuggestion | null {
  if (inputs.isCompetitor === true) return null;

  const declared = !!inputs.isCompetitor;
  const comps = inputs.competitionCount ?? 0;

  if (comps < 2) return null;

  if (!declared && comps >= 2) {
    const confidence = capConfidence(comps >= 4 ? 0.8 : 0.6);
    const contextLine = "Based on your competition activity";
    return {
      type: "competitor",
      message:
        "You're actively competing. Consider identifying as a competitor.",
      suggestedValue: true,
      confidence,
      priority: 2,
      source: "activity",
      context: contextForConfidence(confidence, contextLine),
    };
  }

  return null;
}

function deriveExperienceSuggestion(
  inputs: IdentitySuggestionInputs,
): IdentitySuggestion | null {
  const sessions = inputs.sessionCount ?? 0;
  const exp = (inputs.experienceLevel ?? "").toLowerCase();
  const suggestedValue = "experienced";

  if (exp === suggestedValue) return null;

  if (sessions >= 20 && exp !== suggestedValue) {
    const confidence = capConfidence(sessions >= 30 ? 0.8 : 0.6);
    const contextLine = "Based on your training volume";
    return {
      type: "experience",
      message:
        "Your activity level suggests you're progressing. Consider updating your experience level.",
      suggestedValue,
      confidence,
      priority: 1,
      source: "activity",
      context: contextForConfidence(confidence, contextLine),
    };
  }

  return null;
}

export function deriveIdentitySuggestions(
  inputs: IdentitySuggestionInputs,
): IdentitySuggestion[] {
  const suggestions: IdentitySuggestion[] = [];

  const skill = deriveSkillSuggestion(inputs);
  if (skill) suggestions.push(skill);

  const competitor = deriveCompetitorSuggestion(inputs);
  if (competitor) suggestions.push(competitor);

  const experience = deriveExperienceSuggestion(inputs);
  if (experience) suggestions.push(experience);

  const deduped = suggestions
    .filter(Boolean)
    .filter((s, index, arr) => arr.findIndex((x) => x.type === s.type) === index);

  deduped.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.confidence - a.confidence;
  });

  return deduped.map((s) => ({
    ...s,
    confidence: capConfidence(s.confidence),
  })).slice(0, 2);
}
