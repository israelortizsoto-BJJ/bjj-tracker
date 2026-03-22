export type KidId = string;

export type CoachOutcome = "not_yet" | "developing" | "on_track";

export type KidWeeklyFocusEntryTemplate = {
  focusType: "template";
  templateId: string;
  title: string;
  metadata?: string;
  youtubeUrl?: string;
};

export type KidWeeklyFocusEntryCustom = {
  focusType: "custom";
  title: string;
  note?: string;
  youtubeUrl?: string;
};

export type KidWeeklyFocusEntryFocus = KidWeeklyFocusEntryTemplate | KidWeeklyFocusEntryCustom;

export type KidWeeklyFocusEntry = {
  id: string;
  kidId: KidId;
  weekStartYMD: string; // YYYY-MM-DD (Monday)
  createdAt: string;
  updatedAt: string;

  // Keep these optional and pilot-only; can be expanded later.
  coachOutcome?: CoachOutcome;
  coachNotes?: string;

} & KidWeeklyFocusEntryFocus;

export type Kid = {
  id: KidId;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type KidsById = Record<KidId, Kid>;
export type KidWeeklyFocusEntries = KidWeeklyFocusEntry[];

/** Coach “standing” note for a kid; persisted until changed (not week-scoped). */
export type KidStandingGuidance = {
  headline: string;
  detail?: string;
  updatedAt: string;
};

export type KidStandingGuidanceByKidId = Record<KidId, KidStandingGuidance>;

/** Simple pilot-only tournament outcome (no bracket / match modeling). */
export type KidCompetitionResult =
  | "gold"
  | "silver"
  | "bronze"
  | "participated"
  | "dnf"
  | "other";

/** Coach-facing event lifecycle (appearance / planning); optional on stored entries. */
export type KidCompetitionEventStatus =
  | "upcoming"
  | "completed"
  | "cancelled"
  | "unknown";

/** How the match was decided, when known; optional on stored entries. */
export type KidCompetitionOutcomeKind =
  | "points"
  | "submission"
  | "decision"
  | "disqualification"
  | "medical"
  | "other"
  | "unknown";

export type KidCompetitionEntry = {
  id: string;
  kidId: KidId;
  tournamentName: string;
  /** YYYY-MM-DD */
  eventDate: string;
  result: KidCompetitionResult;
  eventStatus?: KidCompetitionEventStatus;
  organizationOrPromoter?: string;
  outcomeKind?: KidCompetitionOutcomeKind;
  coachNotes?: string;
  videoUri?: string;
  videoAssetId?: string;
  createdAt: string;
  updatedAt: string;
};

