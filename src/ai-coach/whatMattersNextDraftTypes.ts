import type { BucketOutcomeTrend } from "../lib/signals/competitionBucketHistory";
import type { LastCompetitionWeeklyContext } from "../storage/competitionStore";
import type { TrainingSkillBucket } from "./skillBucketText";
import type { CompetitionTrainingSkillFocus } from "./competitionTrainingSkillFocus";
import type {
  CoachOutcome,
  KidCompetitionEventStatus,
  KidCompetitionOutcomeKind,
  KidCompetitionResult,
} from "../types/coachKid";

/** One-kid local payload for “Help me phrase this” (Slice 1). */
export type WhatMattersNextDraftPayload = {
  kidId: string;
  kidDisplayName: string;
  standingGuidanceDraft: {
    headline: string;
    detail: string;
  };
  currentWeekWeeklyFocus: WhatMattersNextDraftWeeklyFocus | null;
  recentCheckIns: WhatMattersNextDraftCheckIn[];
  recentCompetitions: WhatMattersNextDraftCompetition[];
  /** Same source as lists: `getKidCompetitionEntriesWithMatchDetailForKid` + `pickLastCompetitionWeeklyContext`. */
  lastCompetitionWeekly: LastCompetitionWeeklyContext | null;
  /** Derived from match + session logs only; omit when ambiguous. */
  trainingSkillFocus: CompetitionTrainingSkillFocus | null;
  /** Per-bucket trajectory from labeled events + inferred event buckets (signals parity). */
  bucketOutcomeTrends: Partial<Record<TrainingSkillBucket, BucketOutcomeTrend>>;
  /**
   * In-memory coach decision after suggested focus UI (Kid detail). Omit when untouched.
   * When `finalCoachFocus` differs from `suggestedFocusArea`, drafts defer to coach copy.
   */
  coachTrainingFocusDecision?: {
    suggestedFocusArea: string;
    finalCoachFocus: string;
  } | null;
};

export type WhatMattersNextDraftWeeklyFocus = {
  title: string;
  noteOrMetadata?: string;
  templateId?: string;
  hasYoutubeUrl: boolean;
};

export type WhatMattersNextDraftCheckIn = {
  weekStartYMD: string;
  focusTitle: string;
  coachOutcome?: CoachOutcome;
  coachNotes?: string;
};

export type WhatMattersNextDraftCompetition = {
  eventDate: string;
  tournamentName: string;
  result?: KidCompetitionResult;
  eventStatus?: KidCompetitionEventStatus;
  organizationOrPromoter?: string;
  outcomeKind?: KidCompetitionOutcomeKind;
};

export type WhatMattersNextDraftResult = {
  suggestedHeadline: string;
  suggestedDetail: string;
};

export type WhatMattersNextDraftGenerator = {
  generateDraft(
    payload: WhatMattersNextDraftPayload,
  ): Promise<WhatMattersNextDraftResult>;
};
