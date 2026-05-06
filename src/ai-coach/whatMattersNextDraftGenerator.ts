import { getPlacementLabel } from "../features/competition/placementLabel";
import {
  computeMultiEventCompetitionMetrics,
  multiEventCoachPatternFragment,
  type CompetitionEntry,
  type CompetitionPlacementTrend,
} from "../lib/signals/computeSignals";
import type { LastCompetitionWeeklyContext } from "../storage/competitionStore";
import type { CoachOutcome, KidCompetitionResult } from "../types/coachKid";
import { trainingSkillBucketDisplayLabel } from "./skillBucketText";
import {
  principalTrainingSkillBucketFromDerivedFocus,
  type CompetitionTrainingSkillFocus,
} from "./competitionTrainingSkillFocus";
import type {
  WhatMattersNextDraftCompetition,
  WhatMattersNextDraftGenerator,
  WhatMattersNextDraftPayload,
  WhatMattersNextDraftResult,
} from "./whatMattersNextDraftTypes";

function collapseSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Coach wording diverged from the system suggestion — defer to coach, trim redundant cues. */
function coachOverrodeSuggestedTrainingFocus(payload: WhatMattersNextDraftPayload): boolean {
  const d = payload.coachTrainingFocusDecision;
  if (!d) return false;
  const sug = collapseSpace(d.suggestedFocusArea).toLowerCase();
  const fin = collapseSpace(d.finalCoachFocus).toLowerCase();
  return Boolean(sug && fin && sug !== fin);
}

function trainingSkillFocusForDraft(
  payload: WhatMattersNextDraftPayload,
): CompetitionTrainingSkillFocus | null {
  if (coachOverrodeSuggestedTrainingFocus(payload)) return null;
  return payload.trainingSkillFocus;
}

function outcomeLabel(o: CoachOutcome): string {
  switch (o) {
    case "not_yet":
      return "Learning";
    case "developing":
      return "Developing";
    case "on_track":
      return "On track";
  }
}

/** Placement copy for lists — always via `getPlacementLabel` (no medal color names). */
function resultLabel(r: KidCompetitionResult): string {
  return getPlacementLabel(r);
}

function appendMultiEventCoachPatternPlacement(
  baseCue: string,
  placementTrend: CompetitionPlacementTrend | null,
): string {
  const fragment = placementTrend == null ? "" : multiEventCoachPatternFragment(placementTrend);
  if (!fragment) return collapseSpace(baseCue);
  return collapseSpace(`${collapseSpace(baseCue)} ${fragment}`);
}

function competitionOutcomeCoachingCue(
  lastWeekly: LastCompetitionWeeklyContext | null,
  fallbackRecent: WhatMattersNextDraftCompetition | undefined,
  trainingSkillFocus: CompetitionTrainingSkillFocus | null,
): string {
  const result: KidCompetitionResult | undefined =
    lastWeekly?.lastCompetitionResult ?? fallbackRecent?.result;
  const matchTag =
    lastWeekly?.lastCompetitionMatchSummary?.trim()
      ? ` Match log: ${lastWeekly.lastCompetitionMatchSummary.trim()}.`
      : "";
  const spec =
    trainingSkillFocus?.highConfidence && trainingSkillFocus.focusFragments.length
      ? collapseSpace(trainingSkillFocus.focusFragments.join(" and "))
      : "";
  const trainingThread = spec ? ` Training direction from logged notes: prioritize ${spec}.` : "";

  if (typeof result === "undefined") {
    return (
      collapseSpace(
        "Competition cue: name the hardest moment from the day and align this week's reps with that single focus." +
          trainingThread +
          matchTag,
      )
    );
  }

  const placement = getPlacementLabel(result);

  if (result === "gold") {
    const core = spec
      ? `Competition cue (${placement}): reinforce the themes that already worked for you—especially ${spec}—then choose one crisp polish item before the next event.`
      : `Competition cue (${placement}): reinforce strengths that showed up; suggest one refinement to polish before the next event.`;
    return collapseSpace(core + matchTag);
  }

  if (result === "silver" || result === "bronze") {
    const core = spec
      ? `Competition cue (${placement}): highlight the gap to the next level; steer this week's reps toward ${spec}, where your logged notes keep pointing.`
      : `Competition cue (${placement}): highlight the gap to the next level; suggest one specific position or sequence to own this week.`;
    return collapseSpace(core + matchTag);
  }

  if (result === "participated") {
    const core = spec
      ? `Competition cue (${placement}): encourage the effort; keep the plan honest by zeroing in on ${spec} if that is what the notes keep showing.`
      : `Competition cue (${placement}): encourage the effort; identify one improvement target from the day for this week's training.`;
    return collapseSpace(core + matchTag);
  }

  if (result === "dnf") {
    const core = spec
      ? `Competition cue (${placement}): prioritize recovery and measured volume; rebuild confidence with deliberate reps around ${spec}.`
      : `Competition cue (${placement}): prioritize recovery and fundamentals; keep volume measured and rebuild confidence with one technical priority.`;
    return collapseSpace(core + matchTag);
  }

  if (result === "other") {
    const core = spec
      ? `Competition cue (${placement}): translate what happened into a single week theme—use ${spec} as the anchor if that pattern is showing up in logs.`
      : `Competition cue (${placement}): translate what happened into one concrete training theme for this week.`;
    return collapseSpace(core + matchTag);
  }

  return collapseSpace(
    (spec
      ? `Competition cue (${placement}): connect that outcome to ${spec} in training.`
      : `Competition cue (${placement}): connect that outcome to one clear priority in training.`) + matchTag,
  );
}

function multiEventCuePayloadFromDraftCompetitions(
  competitions: readonly WhatMattersNextDraftCompetition[],
): CompetitionEntry[] {
  return competitions.map((row, index) => ({
    eventDate: row.eventDate,
    ...(typeof row.result !== "undefined" ? { result: row.result } : {}),
    createdAt: `${row.eventDate}:${String(index).padStart(3, "0")}`,
  }));
}

/**
 * Local deterministic stand-in until a remote model is wired.
 * Only rearranges and tightens wording from the payload; does not add new claims.
 */
export function mockWhatMattersNextDraftFromPayload(
  payload: WhatMattersNextDraftPayload,
): WhatMattersNextDraftResult {
  const focusForCue = trainingSkillFocusForDraft(payload);

  const h0 = collapseSpace(payload.standingGuidanceDraft.headline);
  const d0 = collapseSpace(payload.standingGuidanceDraft.detail);
  const week = payload.currentWeekWeeklyFocus;

  let suggestedHeadline = h0;
  if (!suggestedHeadline && week?.title) {
    suggestedHeadline = collapseSpace(week.title);
  }
  if (!suggestedHeadline && payload.recentCheckIns[0]?.focusTitle) {
    suggestedHeadline = collapseSpace(payload.recentCheckIns[0].focusTitle);
  }
  const last = payload.lastCompetitionWeekly;
  if (!suggestedHeadline && last?.lastCompetitionName) {
    const label =
      typeof last.lastCompetitionResult !== "undefined"
        ? getPlacementLabel(last.lastCompetitionResult)
        : "";
    const bit = [label, last.lastCompetitionName].filter(Boolean).join(" · ");
    suggestedHeadline = `${payload.kidDisplayName}: ${bit}`;
  }
  if (!suggestedHeadline && payload.recentCompetitions[0]?.tournamentName) {
    suggestedHeadline = `${payload.kidDisplayName}: ${payload.recentCompetitions[0].tournamentName}`;
  }

  const detailParts: string[] = [];
  if (d0) detailParts.push(d0);

  if (week) {
    const bits = [`This week’s focus: ${week.title}.`];
    if (week.noteOrMetadata) bits.push(week.noteOrMetadata);
    if (week.templateId) bits.push(`(Template ${week.templateId}.)`);
    if (week.hasYoutubeUrl) bits.push("Video link on file (not sent).");
    detailParts.push(bits.join(" "));
  }

  if (payload.recentCheckIns.length) {
    const lines = payload.recentCheckIns.map((c) => {
      const oc = c.coachOutcome
        ? `Outcome: ${outcomeLabel(c.coachOutcome)}.`
        : "";
      const notes = c.coachNotes ? c.coachNotes : "";
      const core = `Week ${c.weekStartYMD} — ${c.focusTitle}`;
      return collapseSpace([core, oc, notes].filter(Boolean).join(" "));
    });
    detailParts.push(`Recent check-ins:\n${lines.map((l) => `• ${l}`).join("\n")}`);
  }

  const placementTrendFromRecentDraftCompetitions: CompetitionPlacementTrend | null =
    payload.recentCompetitions.length >= 3
      ? computeMultiEventCompetitionMetrics(
          multiEventCuePayloadFromDraftCompetitions(payload.recentCompetitions),
        ).placementTrend
      : null;

  if (payload.recentCompetitions.length) {
    const lines = payload.recentCompetitions.map((e) => {
      const bits = [
        e.eventDate,
        e.tournamentName,
        typeof e.result !== "undefined" ? resultLabel(e.result) : "",
        e.eventStatus ? `status ${e.eventStatus}` : "",
        e.organizationOrPromoter ? e.organizationOrPromoter : "",
        e.outcomeKind ? `how ${e.outcomeKind}` : "",
      ].filter(Boolean);
      return bits.join(" · ");
    });
    detailParts.push(
      `Recent competitions:\n${lines.map((l) => `• ${collapseSpace(l)}`).join("\n")}`,
    );
    const cue = competitionOutcomeCoachingCue(
      payload.lastCompetitionWeekly,
      payload.recentCompetitions[0],
      focusForCue,
    );
    detailParts.push(
      appendMultiEventCoachPatternPlacement(cue, placementTrendFromRecentDraftCompetitions),
    );
  } else if (payload.lastCompetitionWeekly) {
    detailParts.push(
      competitionOutcomeCoachingCue(payload.lastCompetitionWeekly, undefined, focusForCue),
    );
  }

  const suggestedDetail = detailParts.join("\n\n");

  const competitionFocusPrimary =
    focusForCue?.highConfidence && focusForCue.focusFragments.length
      ? collapseSpace(focusForCue.focusFragments.join(" and "))
      : "";

  const principalTrainingBucket =
    focusForCue != null ? principalTrainingSkillBucketFromDerivedFocus(focusForCue) : null;
  const principalBucketTrajectory =
    principalTrainingBucket != null
      ? payload.bucketOutcomeTrends[principalTrainingBucket]
      : undefined;

  let finalHeadline = collapseSpace(suggestedHeadline);
  if (
    competitionFocusPrimary &&
    principalTrainingBucket &&
    principalBucketTrajectory === "improving"
  ) {
    finalHeadline = collapseSpace(
      `${payload.kidDisplayName}: ${trainingSkillBucketDisplayLabel(principalTrainingBucket)} is improving — continue reinforcing`,
    );
  } else if (
    competitionFocusPrimary &&
    principalTrainingBucket &&
    principalBucketTrajectory === "declining"
  ) {
    finalHeadline = collapseSpace(
      `${payload.kidDisplayName}: ${trainingSkillBucketDisplayLabel(principalTrainingBucket)} has not improved — adjust approach`,
    );
  } else if (competitionFocusPrimary) {
    finalHeadline = collapseSpace(
      `${payload.kidDisplayName}: Focus on ${competitionFocusPrimary} this week`,
    );
  }

  return {
    suggestedHeadline: finalHeadline,
    suggestedDetail: suggestedDetail.trim(),
  };
}

export const mockWhatMattersNextDraftGenerator: WhatMattersNextDraftGenerator = {
  async generateDraft(payload) {
    await new Promise((r) => setTimeout(r, 450));
    return mockWhatMattersNextDraftFromPayload(payload);
  },
};

/** Default Slice 1 generator (swap when a remote provider exists). */
export function getDefaultWhatMattersNextDraftGenerator(): WhatMattersNextDraftGenerator {
  return mockWhatMattersNextDraftGenerator;
}
