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
  result: KidCompetitionResult;
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
