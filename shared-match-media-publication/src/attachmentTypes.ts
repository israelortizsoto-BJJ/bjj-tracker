export const MATCH_MEDIA_ATTACHMENT_STATES = [
  "attached",
  "tombstoned",
] as const;

export type MatchMediaAttachmentState =
  (typeof MATCH_MEDIA_ATTACHMENT_STATES)[number];

export type MatchAttachmentIdentity = Readonly<{
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
}>;

export type ImmutableMatchMediaIdentity = Readonly<{
  matchMediaAssetId: string;
  objectVersion: string;
}>;

type MatchMediaAttachmentBase = MatchAttachmentIdentity & {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly updatedAt: string;
};

export type AttachedMatchMediaAttachment = MatchMediaAttachmentBase &
  ImmutableMatchMediaIdentity & {
    readonly state: "attached";
    readonly publishedAt: string;
  };

export type TombstonedMatchMediaAttachment = MatchMediaAttachmentBase & {
  readonly state: "tombstoned";
  readonly tombstonedAt: string;
};

/**
 * Canonical Parent Competition attachment state.
 *
 * The tombstoned variant intentionally cannot carry an active asset identity.
 */
export type MatchMediaAttachment =
  | AttachedMatchMediaAttachment
  | TombstonedMatchMediaAttachment;

export type ParentMatchAttachmentAuthority = MatchAttachmentIdentity & {
  readonly authority: "parent";
};

/**
 * Read-only eligibility/provenance supplied by the separately owned
 * Production Verification boundary.
 *
 * This package never derives or persists Verification state.
 */
export type VerifiedMediaPublicationProvenance =
  MatchAttachmentIdentity &
    ImmutableMatchMediaIdentity & {
      readonly publicationEligible: boolean;
      readonly verificationState:
        | "verifying"
        | "verified"
        | "rejected"
        | "failed";
    };

type AttachmentMutationBase = {
  readonly target: MatchAttachmentIdentity;
  readonly authority: ParentMatchAttachmentAuthority;
  readonly expectedRevision: number;
};

export type AttachMatchMediaCommand = AttachmentMutationBase & {
  readonly type: "attach";
  readonly media: ImmutableMatchMediaIdentity;
  readonly verification: VerifiedMediaPublicationProvenance;
};

export type TombstoneMatchMediaCommand = AttachmentMutationBase & {
  readonly type: "tombstone";
};

export type MatchMediaAttachmentCommand =
  | AttachMatchMediaCommand
  | TombstoneMatchMediaCommand;

export const PUBLICATION_REASON_CODES = [
  "FIRST_ATTACHMENT",
  "IDENTICAL_ATTACHMENT_REPLAY",
  "ATTACHMENT_REPLACED",
  "ATTACHMENT_TOMBSTONED",
  "ALREADY_TOMBSTONED",
  "STALE_REVISION",
  "PARENT_AUTHORITY_REQUIRED",
  "ATHLETE_LINEAGE_MISMATCH",
  "COMPETITION_LINEAGE_MISMATCH",
  "MATCH_LINEAGE_MISMATCH",
  "MEDIA_NOT_VERIFIED",
  "MEDIA_ASSET_MISMATCH",
  "OBJECT_VERSION_MISMATCH",
  "INVALID_STATE_TRANSITION",
  "INVALID_INPUT",
  "PERSISTED_RECORD_INVALID",
  "CAS_RETRY_EXHAUSTED",
] as const;

export type PublicationReasonCode =
  (typeof PUBLICATION_REASON_CODES)[number];

export type PublicationMutationResult =
  | {
      readonly outcome: "attached" | "replaced" | "tombstoned";
      readonly reasonCode:
        | "FIRST_ATTACHMENT"
        | "ATTACHMENT_REPLACED"
        | "ATTACHMENT_TOMBSTONED";
      readonly record: MatchMediaAttachment;
    }
  | {
      readonly outcome: "idempotent";
      readonly reasonCode:
        | "IDENTICAL_ATTACHMENT_REPLAY"
        | "ALREADY_TOMBSTONED";
      readonly record: MatchMediaAttachment;
    }
  | {
      readonly outcome: "conflict";
      readonly reasonCode: "STALE_REVISION" | "CAS_RETRY_EXHAUSTED";
      readonly currentRevision: number;
      readonly current: MatchMediaAttachment | null;
    }
  | {
      readonly outcome: "denied";
      readonly reasonCode: Exclude<
        PublicationReasonCode,
        | "FIRST_ATTACHMENT"
        | "IDENTICAL_ATTACHMENT_REPLAY"
        | "ATTACHMENT_REPLACED"
        | "ATTACHMENT_TOMBSTONED"
        | "ALREADY_TOMBSTONED"
        | "STALE_REVISION"
        | "CAS_RETRY_EXHAUSTED"
      >;
      readonly current: MatchMediaAttachment | null;
    };
