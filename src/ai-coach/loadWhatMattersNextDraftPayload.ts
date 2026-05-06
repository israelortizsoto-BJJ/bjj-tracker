import {
  getKidWeeklyFocusEntriesForKid,
  getKidsById,
  getLatestKidWeeklyFocusForWeek,
  startOfWeekMondayYMD,
  todayYMD,
} from "../storage/coachKidStore";
import {
  getKidCompetitionEntriesWithMatchDetailForKid,
  pickLastCompetitionWeeklyContext,
} from "../storage/competitionStore";
import { getSessions } from "../storage/sessionsStore";
import type { KidCompetitionEntry, KidWeeklyFocusEntry } from "../types/coachKid";
import type {
  WhatMattersNextDraftCheckIn,
  WhatMattersNextDraftCompetition,
  WhatMattersNextDraftPayload,
  WhatMattersNextDraftWeeklyFocus,
} from "./whatMattersNextDraftTypes";
import { deriveCompetitionBucketHistorySignals } from "../lib/signals/competitionBucketHistory";
import { deriveCompetitionTrainingSkillFocus } from "./competitionTrainingSkillFocus";
import { peekCoachTrainingFocusDecision } from "./coachTrainingFocusFeedback";

const RECENT_CHECK_INS_CAP = 12;
const RECENT_COMPETITIONS_CAP = 8;

function weeklyFocusToPayload(
  entry: KidWeeklyFocusEntry,
): WhatMattersNextDraftWeeklyFocus {
  const hasYoutubeUrl = Boolean(entry.youtubeUrl?.trim());
  if (entry.focusType === "template") {
    const meta = entry.metadata?.trim();
    return {
      title: entry.title,
      ...(meta ? { noteOrMetadata: meta } : {}),
      templateId: entry.templateId,
      hasYoutubeUrl,
    };
  }
  const note = entry.note?.trim();
  return {
    title: entry.title,
    ...(note ? { noteOrMetadata: note } : {}),
    hasYoutubeUrl,
  };
}

function checkInToPayload(entry: KidWeeklyFocusEntry): WhatMattersNextDraftCheckIn {
  return {
    weekStartYMD: entry.weekStartYMD,
    focusTitle: entry.title,
    coachOutcome: entry.coachOutcome,
    coachNotes: entry.coachNotes?.trim() ? entry.coachNotes.trim() : undefined,
  };
}

function competitionToPayload(row: KidCompetitionEntry): WhatMattersNextDraftCompetition {
  return {
    eventDate: row.eventDate,
    tournamentName: row.tournamentName,
    ...(typeof row.result !== "undefined" ? { result: row.result } : {}),
    ...(row.eventStatus ? { eventStatus: row.eventStatus } : {}),
    ...(row.organizationOrPromoter
      ? { organizationOrPromoter: row.organizationOrPromoter }
      : {}),
    ...(row.outcomeKind ? { outcomeKind: row.outcomeKind } : {}),
  };
}

/**
 * Builds the Slice 1 draft payload from local stores + current on-screen draft text.
 * Omits media URLs and other kids; includes a derived training-focus hint from recent sessions + logged match notes.
 */
export async function loadWhatMattersNextDraftPayload(
  kidId: string,
  standingGuidanceDraft: { headline: string; detail: string },
): Promise<WhatMattersNextDraftPayload | null> {
  const kids = await getKidsById();
  const kid = kids[kidId];
  if (!kid) return null;

  const weekStart = startOfWeekMondayYMD(todayYMD());
  const weekRow = await getLatestKidWeeklyFocusForWeek(kidId, weekStart);

  const allFocus = await getKidWeeklyFocusEntriesForKid(kidId);
  const byCreated = allFocus
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const recentCheckIns = byCreated
    .slice(0, RECENT_CHECK_INS_CAP)
    .map(checkInToPayload);

  const [comps, allSessions] = await Promise.all([
    getKidCompetitionEntriesWithMatchDetailForKid(kidId),
    getSessions(),
  ]);
  const athleteSessions = allSessions.filter((s) => String(s.kidId ?? "").trim() === kidId);
  const trainingSkillFocus = deriveCompetitionTrainingSkillFocus({
    competitionsWithMatches: comps,
    sessions: athleteSessions,
  });
  const { bucketOutcomeTrends } = deriveCompetitionBucketHistorySignals(comps);

  const decision = peekCoachTrainingFocusDecision(kidId);

  const today = todayYMD();
  const lastCompetitionWeekly = pickLastCompetitionWeeklyContext(comps, today);
  const recentCompetitions = comps
    .slice()
    .sort((a, b) => {
      const dateCmp = b.eventDate.localeCompare(a.eventDate);
      if (dateCmp !== 0) return dateCmp;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, RECENT_COMPETITIONS_CAP)
    .map(competitionToPayload);

  return {
    kidId,
    kidDisplayName: kid.name.trim() || kidId,
    standingGuidanceDraft: {
      headline: standingGuidanceDraft.headline,
      detail: standingGuidanceDraft.detail,
    },
    currentWeekWeeklyFocus: weekRow ? weeklyFocusToPayload(weekRow) : null,
    recentCheckIns,
    recentCompetitions,
    lastCompetitionWeekly,
    trainingSkillFocus,
    bucketOutcomeTrends,
    coachTrainingFocusDecision: decision
      ? {
          suggestedFocusArea: decision.suggestedFocusArea,
          finalCoachFocus: decision.finalCoachFocus,
        }
      : null,
  };
}
