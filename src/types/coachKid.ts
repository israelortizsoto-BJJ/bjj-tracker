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

/** Simple pilot-only tournament outcome (no bracket / match modeling). */
export type KidCompetitionResult =
  | "gold"
  | "silver"
  | "bronze"
  | "participated"
  | "dnf"
  | "other";

export type KidCompetitionEntry = {
  id: string;
  kidId: KidId;
  tournamentName: string;
  /** YYYY-MM-DD */
  eventDate: string;
  result: KidCompetitionResult;
  coachNotes?: string;
  videoUri?: string;
  videoAssetId?: string;
  createdAt: string;
  updatedAt: string;
};

