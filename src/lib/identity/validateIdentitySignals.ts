export type ValidationStatus =
  | "aligned"
  | "developing"
  | "mismatch"
  | "insufficient";

export type IdentityValidationResult = {
  skills: ValidationStatus;
  competitor: ValidationStatus;
  experience: ValidationStatus;
  overall: ValidationStatus;
  notes: string[]; // short human-readable hints
};

export type IdentityValidationInputs = {
  declaredSkills?: string[] | null;
  isCompetitor?: boolean | null;
  experienceLevel?: string | null;

  signals?: any | null; // SignalOutput
  coachSignals?: Record<
    string,
    { strength: number; weakness: number; focus: number }
  > | null;

  sessionCount?: number;
  competitionCount?: number;
};

function hasSufficientData(inputs: IdentityValidationInputs) {
  return (inputs.sessionCount ?? 0) >= 3;
}

function normalizeSkill(s: string) {
  return s?.toLowerCase().replace(/_/g, " ").trim();
}

function validateSkills(inputs: IdentityValidationInputs): ValidationStatus {
  const declared = inputs.declaredSkills ?? [];
  const signals = inputs.signals;

  if (!hasSufficientData(inputs)) return "insufficient";
  if (!signals?.hasData) return "insufficient";

  const observed =
    signals?.patterns?.topSystem ||
    signals?.patterns?.topTechnique ||
    signals?.systems?.topSystem;

  if (!observed || declared.length === 0) return "developing";

  const observedNorm = normalizeSkill(observed);

  const match = declared.some((s) =>
    normalizeSkill(s).includes(observedNorm),
  );

  if (match) return "aligned";

  return "mismatch";
}

function validateCompetitor(inputs: IdentityValidationInputs): ValidationStatus {
  const declared = !!inputs.isCompetitor;
  const compCount = inputs.competitionCount ?? 0;

  if (compCount === 0) return "insufficient";

  if (declared && compCount > 0) return "aligned";
  if (!declared && compCount > 0) return "mismatch";

  return "developing";
}

function validateExperience(inputs: IdentityValidationInputs): ValidationStatus {
  const exp = (inputs.experienceLevel ?? "").toLowerCase();
  const sessions = inputs.sessionCount ?? 0;

  if (sessions < 3) return "insufficient";

  if (exp === "beginner" && sessions < 10) return "aligned";
  if (exp === "developing" && sessions >= 10) return "aligned";
  if (exp === "experienced" && sessions >= 25) return "aligned";

  return "developing";
}

function adjustWithCoachSignals(
  status: ValidationStatus,
  coachSignals:
    | Record<string, { strength: number; weakness: number; focus: number }>
    | null
    | undefined,
): ValidationStatus {
  if (!coachSignals) return status;

  const entries = Object.values(coachSignals);

  const strongWeakness = entries.some((e) => e.weakness >= 0.7);

  if (strongWeakness && status === "aligned") {
    return "developing"; // soften alignment
  }

  return status;
}

export function validateIdentitySignals(
  inputs: IdentityValidationInputs,
): IdentityValidationResult {
  const skills = adjustWithCoachSignals(
    validateSkills(inputs),
    inputs.coachSignals,
  );

  const competitor = validateCompetitor(inputs);
  const experience = validateExperience(inputs);

  const statuses = [skills, competitor, experience];

  let overall: ValidationStatus = "aligned";

  if (statuses.includes("mismatch")) overall = "mismatch";
  else if (statuses.includes("developing")) overall = "developing";
  else if (statuses.every((s) => s === "insufficient"))
    overall = "insufficient";

  const notes: string[] = [];

  if (skills === "mismatch") {
    notes.push("Your training patterns differ from your declared focus.");
  }

  if (competitor === "mismatch") {
    notes.push("Competition activity doesn’t match your stated intent.");
  }

  if (experience === "developing") {
    notes.push("Your experience level is still forming based on activity.");
  }

  return {
    skills,
    competitor,
    experience,
    overall,
    notes,
  };
}
