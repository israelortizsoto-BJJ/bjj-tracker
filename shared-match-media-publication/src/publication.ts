import {
  attachmentRecordKey,
  type MatchMediaAttachmentRecordStore,
} from "./attachmentStore.ts";
import type {
  AttachMatchMediaCommand,
  MatchAttachmentIdentity,
  MatchMediaAttachment,
  MatchMediaAttachmentCommand,
  PublicationMutationResult,
  PublicationReasonCode,
} from "./attachmentTypes.ts";

export const MAX_PUBLICATION_CAS_ATTEMPTS = 8;

export type PublicationDependencies = {
  readonly store: MatchMediaAttachmentRecordStore;
  readonly now: () => Date;
};

type DeniedReason = Extract<
  PublicationReasonCode,
  | "PARENT_AUTHORITY_REQUIRED"
  | "ATHLETE_LINEAGE_MISMATCH"
  | "COMPETITION_LINEAGE_MISMATCH"
  | "MATCH_LINEAGE_MISMATCH"
  | "MEDIA_NOT_VERIFIED"
  | "MEDIA_ASSET_MISMATCH"
  | "OBJECT_VERSION_MISMATCH"
  | "INVALID_STATE_TRANSITION"
  | "INVALID_INPUT"
  | "PERSISTED_RECORD_INVALID"
>;

type Evaluation =
  | { readonly kind: "write"; readonly record: MatchMediaAttachment }
  | { readonly kind: "result"; readonly result: PublicationMutationResult };

function normalizeIdentity(
  identity: MatchAttachmentIdentity,
): MatchAttachmentIdentity | null {
  const sharedAthleteId = identity.sharedAthleteId.trim();
  const sharedCompetitionId = identity.sharedCompetitionId.trim();
  const matchLineageKey = identity.matchLineageKey.trim();
  if (!sharedAthleteId || !sharedCompetitionId || !matchLineageKey) {
    return null;
  }
  return { sharedAthleteId, sharedCompetitionId, matchLineageKey };
}

function denied(
  reasonCode: DeniedReason,
  current: MatchMediaAttachment | null,
): Evaluation {
  return {
    kind: "result",
    result: { outcome: "denied", reasonCode, current },
  };
}

function lineageMismatch(
  expected: MatchAttachmentIdentity,
  actual: MatchAttachmentIdentity,
): DeniedReason | null {
  if (expected.sharedAthleteId !== actual.sharedAthleteId) {
    return "ATHLETE_LINEAGE_MISMATCH";
  }
  if (expected.sharedCompetitionId !== actual.sharedCompetitionId) {
    return "COMPETITION_LINEAGE_MISMATCH";
  }
  if (expected.matchLineageKey !== actual.matchLineageKey) {
    return "MATCH_LINEAGE_MISMATCH";
  }
  return null;
}

function validateAttachProvenance(
  command: AttachMatchMediaCommand,
  target: MatchAttachmentIdentity,
  current: MatchMediaAttachment | null,
): Evaluation | null {
  const matchMediaAssetId = command.media.matchMediaAssetId.trim();
  const objectVersion = command.media.objectVersion.trim();
  if (!matchMediaAssetId || !objectVersion) {
    return denied("INVALID_INPUT", current);
  }
  if (
    !command.verification.publicationEligible ||
    command.verification.verificationState !== "verified"
  ) {
    return denied("MEDIA_NOT_VERIFIED", current);
  }

  const verifiedIdentity = normalizeIdentity(command.verification);
  if (!verifiedIdentity) {
    return denied("INVALID_INPUT", current);
  }
  const mismatch = lineageMismatch(target, verifiedIdentity);
  if (mismatch) return denied(mismatch, current);

  if (command.verification.matchMediaAssetId.trim() !== matchMediaAssetId) {
    return denied("MEDIA_ASSET_MISMATCH", current);
  }
  if (command.verification.objectVersion.trim() !== objectVersion) {
    return denied("OBJECT_VERSION_MISMATCH", current);
  }
  return null;
}

/** Strict, capability-free decoder for authoritative attachment record reads. */
export function decodeMatchMediaAttachmentRecord(raw: string): MatchMediaAttachment | null {
  try {
    const parsed = JSON.parse(raw) as MatchMediaAttachment;
    const identity = normalizeIdentity(parsed);
    if (
      parsed?.schemaVersion !== 1 ||
      (parsed.state !== "attached" && parsed.state !== "tombstoned") ||
      !Number.isSafeInteger(parsed.revision) ||
      parsed.revision < 1 ||
      !identity ||
      parsed.sharedAthleteId !== identity.sharedAthleteId ||
      parsed.sharedCompetitionId !== identity.sharedCompetitionId ||
      parsed.matchLineageKey !== identity.matchLineageKey ||
      typeof parsed.updatedAt !== "string" ||
      !parsed.updatedAt.trim()
    ) {
      return null;
    }
    if (
      parsed.state === "attached" &&
      (!parsed.matchMediaAssetId?.trim() ||
        parsed.matchMediaAssetId !== parsed.matchMediaAssetId.trim() ||
        !parsed.objectVersion?.trim() ||
        parsed.objectVersion !== parsed.objectVersion.trim() ||
        !parsed.publishedAt?.trim())
    ) {
      return null;
    }
    if (parsed.state === "tombstoned") {
      if (
        !parsed.tombstonedAt?.trim() ||
        "matchMediaAssetId" in parsed ||
        "objectVersion" in parsed
      ) {
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

function serializeRecord(record: MatchMediaAttachment): string {
  return JSON.stringify(record);
}

/**
 * Pure domain evaluation for one attachment mutation against the current state.
 * It performs no persistence and has no upload, Verification, R2, or runtime capability.
 */
export function evaluateMatchMediaAttachmentMutation(
  current: MatchMediaAttachment | null,
  command: MatchMediaAttachmentCommand,
  now: Date,
): Evaluation {
  const target = normalizeIdentity(command.target);
  const authorityIdentity = normalizeIdentity(command.authority);
  if (
    !target ||
    !authorityIdentity ||
    !Number.isSafeInteger(command.expectedRevision) ||
    command.expectedRevision < 0 ||
    Number.isNaN(now.getTime())
  ) {
    return denied("INVALID_INPUT", current);
  }
  if (command.authority.authority !== "parent") {
    return denied("PARENT_AUTHORITY_REQUIRED", current);
  }
  const authorityMismatch = lineageMismatch(target, authorityIdentity);
  if (authorityMismatch) return denied(authorityMismatch, current);

  if (current) {
    const persistedIdentity = normalizeIdentity(current);
    if (!persistedIdentity || lineageMismatch(target, persistedIdentity)) {
      return denied("PERSISTED_RECORD_INVALID", current);
    }
  }

  if (command.type === "attach") {
    const provenanceFailure = validateAttachProvenance(command, target, current);
    if (provenanceFailure) return provenanceFailure;

    const media = {
      matchMediaAssetId: command.media.matchMediaAssetId.trim(),
      objectVersion: command.media.objectVersion.trim(),
    };
    if (
      current?.state === "attached" &&
      current.matchMediaAssetId === media.matchMediaAssetId &&
      current.objectVersion === media.objectVersion
    ) {
      return {
        kind: "result",
        result: {
          outcome: "idempotent",
          reasonCode: "IDENTICAL_ATTACHMENT_REPLAY",
          record: current,
        },
      };
    }
    if (
      current?.state === "attached" &&
      current.matchMediaAssetId === media.matchMediaAssetId &&
      current.objectVersion !== media.objectVersion
    ) {
      return denied("OBJECT_VERSION_MISMATCH", current);
    }
    if (current?.state === "tombstoned") {
      return denied("INVALID_STATE_TRANSITION", current);
    }
    const currentRevision = current?.revision ?? 0;
    if (command.expectedRevision !== currentRevision) {
      return {
        kind: "result",
        result: {
          outcome: "conflict",
          reasonCode: "STALE_REVISION",
          currentRevision,
          current,
        },
      };
    }

    const nowIso = now.toISOString();
    return {
      kind: "write",
      record: {
        schemaVersion: 1,
        ...target,
        revision: currentRevision + 1,
        state: "attached",
        ...media,
        publishedAt: nowIso,
        updatedAt: nowIso,
      },
    };
  }

  if (current?.state === "tombstoned") {
    return {
      kind: "result",
      result: {
        outcome: "idempotent",
        reasonCode: "ALREADY_TOMBSTONED",
        record: current,
      },
    };
  }
  if (!current) {
    return denied("INVALID_STATE_TRANSITION", null);
  }
  if (command.expectedRevision !== current.revision) {
    return {
      kind: "result",
      result: {
        outcome: "conflict",
        reasonCode: "STALE_REVISION",
        currentRevision: current.revision,
        current,
      },
    };
  }

  const nowIso = now.toISOString();
  return {
    kind: "write",
    record: {
      schemaVersion: 1,
      ...target,
      revision: current.revision + 1,
      state: "tombstoned",
      tombstonedAt: nowIso,
      updatedAt: nowIso,
    },
  };
}

/**
 * Persist a Publication mutation using the injected durable CAS boundary.
 *
 * A conditional-write race is reread and reevaluated. The winner therefore
 * converges to idempotency or the loser receives the current revision without a
 * partial mutation.
 */
export async function mutateMatchMediaAttachment(
  command: MatchMediaAttachmentCommand,
  dependencies: PublicationDependencies,
): Promise<PublicationMutationResult> {
  const target = normalizeIdentity(command.target);
  if (!target) {
    return {
      outcome: "denied",
      reasonCode: "INVALID_INPUT",
      current: null,
    };
  }
  const key = attachmentRecordKey(target);

  for (let attempt = 0; attempt < MAX_PUBLICATION_CAS_ATTEMPTS; attempt += 1) {
    const versioned = await dependencies.store.getVersioned(key);
    const current = versioned ? decodeMatchMediaAttachmentRecord(versioned.value) : null;
    if (versioned && !current) {
      return {
        outcome: "denied",
        reasonCode: "PERSISTED_RECORD_INVALID",
        current: null,
      };
    }

    const evaluation = evaluateMatchMediaAttachmentMutation(
      current,
      command,
      dependencies.now(),
    );
    if (evaluation.kind === "result") return evaluation.result;

    const serialized = serializeRecord(evaluation.record);
    const written = versioned
      ? await dependencies.store.compareAndSwap(
          key,
          versioned.version,
          serialized,
        )
      : await dependencies.store.putIfAbsent(key, serialized);
    if (!written) continue;

    const outcome =
      evaluation.record.state === "tombstoned"
        ? "tombstoned"
        : current
          ? "replaced"
          : "attached";
    const reasonCode =
      outcome === "tombstoned"
        ? "ATTACHMENT_TOMBSTONED"
        : outcome === "replaced"
          ? "ATTACHMENT_REPLACED"
          : "FIRST_ATTACHMENT";
    return { outcome, reasonCode, record: evaluation.record };
  }

  const latest = await dependencies.store.getVersioned(key);
  const current = latest ? decodeMatchMediaAttachmentRecord(latest.value) : null;
  return {
    outcome: "conflict",
    reasonCode: "CAS_RETRY_EXHAUSTED",
    currentRevision: current?.revision ?? 0,
    current,
  };
}
