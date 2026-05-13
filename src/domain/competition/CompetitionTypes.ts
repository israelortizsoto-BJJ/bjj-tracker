import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
import type {
  KidCompetitionEventStatus,
  KidCompetitionFormat,
  KidCompetitionResult,
  KidCompetitionVideoRef,
} from "../../types/coachKid";

/** Dev / trace: family editor save sequencing (read on unmount from screen). */
export const competitionFamilySaveTrace = {
  phase: "idle" as string,
};

export type FamilyCompetitionSaveTrace = {
  saveT0: number;
  isNew: boolean;
  kidId: string;
  mounted?: () => boolean;
};

export type FamilyCreateCompetitionInput = {
  surface: "family";
  kidId: string;
  tournamentName: string;
  eventDate: string;
  resultDraft: KidCompetitionResult | undefined;
  eventStatusDraft: KidCompetitionEventStatus | undefined;
  formatDraft: KidCompetitionFormat | undefined;
  promoterDraft: string;
  medalImageDraft: string | undefined;
  trace?: FamilyCompetitionSaveTrace;
};

export type FamilyUpdateCompetitionInput = {
  surface: "family";
  kidId: string;
  entryId: string;
  tournamentName: string;
  eventDate: string;
  resultDraft: KidCompetitionResult | undefined;
  eventStatusDraft: KidCompetitionEventStatus | undefined;
  formatDraft: KidCompetitionFormat | undefined;
  promoterDraft: string;
  medalImageDraft: string | undefined;
  /** Must be `false` so telemetry matches the monolithic screen. */
  trace?: FamilyCompetitionSaveTrace;
};

export type KidCreateCompetitionInput = {
  surface: "kid";
  kidId: string;
  /** From screen: `(unlinkedParentAthleteId ?? "").trim() || roster shared || undefined` */
  resolvedSharedAthleteId: string | undefined;
  tournamentName: string;
  eventDate: string;
  resultDraft: KidCompetitionResult;
  eventStatusDraft: KidCompetitionEventStatus | undefined;
  formatDraft: KidCompetitionFormat | undefined;
  promoterDraft: string;
  medalImageDraft: string | undefined;
  coachNotes: string;
  competitionVideos: KidCompetitionVideoRef[];
  matchSnapshots: CompetitionDetailMatchSnapshot[];
};

export type KidUpdateCompetitionInput = {
  surface: "kid";
  kidId: string;
  entryId: string;
  resolvedSharedAthleteId: string | undefined;
  tournamentName: string;
  eventDate: string;
  resultDraft: KidCompetitionResult;
  eventStatusDraft: KidCompetitionEventStatus | undefined;
  formatDraft: KidCompetitionFormat | undefined;
  promoterDraft: string;
  medalImageDraft: string | undefined;
  coachNotes: string;
  competitionVideos: KidCompetitionVideoRef[];
  matchSnapshots: CompetitionDetailMatchSnapshot[];
};

export type FamilySaveBlocked =
  | { kind: "resolve_miss_new" }
  | { kind: "resolve_miss_edit" }
  | { kind: "sync_api"; message: string };

export type CreateCompetitionResult =
  | { ok: true; savedCompetitionId: string }
  | { ok: false; blocked: FamilySaveBlocked };

export type UpdateCompetitionResult =
  | { ok: true; savedCompetitionId: string }
  | { ok: false; blocked: FamilySaveBlocked };

export type DeleteCompetitionInput = {
  entryId: string;
  kidId: string;
};
