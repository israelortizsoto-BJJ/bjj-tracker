export type IdentityInputs = {
  beltRank?: string | null;
  declaredSkills?: string[] | null;
  sessionCount?: number;
  competitionCount?: number;
};

export type IdentityScoreResult = {
  score: number; // 0–100
  phase: "cold" | "developing" | "experienced";
};

const BELT_BASE: Record<string, number> = {
  white: 20,
  blue: 40,
  purple: 70,
  brown: 85,
  black: 95,
};

function normalizeBelt(belt?: string | null): string {
  return (belt ?? "").toLowerCase().split(" ")[0];
}

function getBeltScore(belt?: string | null): number {
  const key = normalizeBelt(belt);
  return BELT_BASE[key] ?? 10; // fallback minimal
}

function getSkillsScore(skills?: string[] | null): number {
  const count = skills?.length ?? 0;

  if (count === 0) return 0;
  if (count <= 3) return 5;
  if (count <= 7) return 10;
  return 15;
}

function getTrainingScore(sessionCount?: number): number {
  const count = sessionCount ?? 0;

  if (count === 0) return 0;
  if (count <= 5) return 5;
  if (count <= 15) return 10;
  return 20;
}

function getCompetitionScore(competitionCount?: number): number {
  const count = competitionCount ?? 0;

  if (count === 0) return 0;
  if (count === 1) return 5;
  if (count <= 5) return 10;
  return 15;
}

function getPhase(inputs: IdentityInputs): IdentityScoreResult["phase"] {
  const sessions = inputs.sessionCount ?? 0;

  if (sessions === 0) return "cold";
  if (sessions < 10) return "developing";
  return "experienced";
}

export function computeIdentityScore(inputs: IdentityInputs): IdentityScoreResult {
  const phase = getPhase(inputs);

  const belt = getBeltScore(inputs.beltRank);
  const skills = getSkillsScore(inputs.declaredSkills);
  const training = getTrainingScore(inputs.sessionCount);
  const competition = getCompetitionScore(inputs.competitionCount);

  let score = 0;

  if (phase === "cold") {
    score = belt * 0.5 + skills * 0.3 + training * 0.1 + competition * 0.1;
  } else if (phase === "developing") {
    score = belt * 0.3 + skills * 0.25 + training * 0.3 + competition * 0.15;
  } else {
    score = belt * 0.2 + skills * 0.15 + training * 0.35 + competition * 0.3;
  }

  return {
    score: Math.round(Math.min(100, score)),
    phase,
  };
}
