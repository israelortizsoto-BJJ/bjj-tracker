type BreakdownTextSource = {
  coachNote?: string | null;
  dictatedReflection?: string | null;
  analysis?: string | null;
};

export type CompetitionProjectionBreakdownTrace = {
  stage: string;
  sharedCompetitionId: string;
  sharedMatchId: string;
  matchLineageKey: string;
  hasCoachBreakdown: boolean;
  coachBreakdownLength: number;
  hasTranscript: boolean;
  transcriptLength: number;
  overlaySource: string;
};

export function breakdownFieldsFromSource(source: BreakdownTextSource) {
  const coachBreakdown = source.coachNote?.trim() ?? "";
  const transcript =
    source.dictatedReflection?.trim() ?? source.analysis?.trim() ?? "";
  return {
    hasCoachBreakdown: coachBreakdown.length > 0,
    coachBreakdownLength: coachBreakdown.length,
    hasTranscript: transcript.length > 0,
    transcriptLength: transcript.length,
  };
}

export function logCompetitionProjectionBreakdownTrace(
  input: CompetitionProjectionBreakdownTrace,
): void {
  console.log("COMPETITION_PROJECTION_TRACE", input);
}

export function logBreakdownPropagationForMatch(input: {
  stage: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
  overlaySource: string;
  source?: BreakdownTextSource;
}): void {
  const matchLineageKey = input.matchLineageKey.trim();
  const breakdown = breakdownFieldsFromSource(input.source ?? {});
  logCompetitionProjectionBreakdownTrace({
    stage: input.stage,
    sharedCompetitionId: input.sharedCompetitionId,
    sharedMatchId: matchLineageKey,
    matchLineageKey,
    overlaySource: input.overlaySource,
    ...breakdown,
  });
}
