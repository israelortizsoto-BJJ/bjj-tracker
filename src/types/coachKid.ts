export type KidId = string;

export type CoachOutcome = "not_yet" | "developing" | "on_track";

/** Coach input: whether the weekly focus is showing up in sparring (optional until set). */
export type KidWeeklyFocusSparringApplication = "not_yet" | "sometimes" | "yes";

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
  // @deprecated — derived from sparringApplication
  coachOutcome?: CoachOutcome;
  coachNotes?: string;
  sparringApplication?: KidWeeklyFocusSparringApplication;
  /**
   * Mission card link (Read together) — published independently of Study.
   * Must not be derived from `familyResourceUrl`.
   */
  missionResourceUrl?: string;
  missionResourceLabel?: string;
  /** Study-the-move / family resource link (https recommended). */
  familyResourceUrl?: string;
  /** Short button label on parent phones for Study (optional). */
  familyResourceLabel?: string;
  /**
   * Optional parent-safe summary of what the coach worked on with the kid (published with the weekly note).
   * Not for raw private 1:1 check-in notes — use coachNotes for that.
   */
  familyCoachRecapNote?: string;

} & KidWeeklyFocusEntryFocus;

export type Kid = {
  id: KidId;
  name: string;
  householdLabel?: string;
  /** When set, this roster row is tied to a parent-created athlete on the linked sync session. */
  sharedAthleteId?: string;
  /**
   * Normalized lowercase invite token for the writer session this row was last reconciled from.
   * Lets us prune stale linked rows when multiple invites exist and only some session GETs succeed.
   */
  sharedFromInviteTokenNorm?: string;
  /**
   * True when created from the parent “link athletes” flow. With shared AsyncStorage (role switching),
   * hide on the coach roster while unlinked so the row does not look like an active coach athlete.
   */
  isParentManagedChildProfile?: boolean;
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

/** Gi / No-Gi / both; optional on stored entries. */
export type KidCompetitionFormat = "gi" | "nogi" | "both";

/** Local coach competition clip (up to 3 per entry); `videoUri` / `videoAssetId` mirror slot 0. */
export type KidCompetitionVideoRef = { uri: string; assetId?: string };

export type KidCompetitionEntry = {
  /**
   * Local primary key. Rows hydrated from the worker may use `shared-comp-<workerCompetitionId>`
   * when no prior client id exists; `sharedCompetitionId` should match that suffix but may be
   * absent on legacy JSON — readers recover the worker id from this prefix when needed.
   */
  id: string;
  kidId: KidId;
  /** Present when this local row is linked to a shared athlete on a sync session. */
  sharedAthleteId?: string;
  /** Present when this row mirrors a competition stored on the sync worker. */
  sharedCompetitionId?: string;
  tournamentName: string;
  /** YYYY-MM-DD */
  eventDate: string;
  /** Omitted until the family or coach sets an outcome. */
  result?: KidCompetitionResult;
  /** UI/state lifecycle alias; `eventStatus` remains the existing storage/sync field. */
  status?: KidCompetitionEventStatus;
  eventStatus?: KidCompetitionEventStatus;
  format?: KidCompetitionFormat;
  organizationOrPromoter?: string;
  outcomeKind?: KidCompetitionOutcomeKind;
  coachNotes?: string;
  /** Up to 3 persisted clips; slot 0 is mirrored in `videoUri` / `videoAssetId`. */
  competitionVideos?: KidCompetitionVideoRef[];
  videoUri?: string;
  videoAssetId?: string;
  createdAt: string;
  updatedAt: string;
};

/** Local rows mirrored from the worker use `id` `shared-comp-<workerCompetitionId>`. */
const SHARED_COMP_LOCAL_ID_PREFIX = "shared-comp-";

/** True when this competition row is tied to the sync worker (swipe delete disabled on parent weekly list). */
export function kidCompetitionEntryIsSyncedFromWorker(entry: KidCompetitionEntry): boolean {
  const sid =
    typeof entry.sharedCompetitionId === "string" ? entry.sharedCompetitionId.trim() : "";
  if (sid) return true;
  return entry.id.startsWith(SHARED_COMP_LOCAL_ID_PREFIX);
}
