import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  SyncedMatchMediaAttachmentProjection,
  SyncedMatchMediaAttachmentProjectionSet,
} from "../types/coachWeeklySync";
import { StorageKeys } from "./storageKeys";

type AttachmentSetByAthleteId = Record<string, SyncedMatchMediaAttachmentProjectionSet>;

export type CoachMatchMediaAttachmentApplyOutcome =
  | {
      status: "written";
      sharedAthleteId: string;
      sharedCompetitionId: string;
      matchLineageKey: string;
      incomingRevision: number;
      previousRevision: number | null;
    }
  | {
      status: "noop_identical";
      sharedAthleteId: string;
      sharedCompetitionId: string;
      matchLineageKey: string;
      revision: number;
    }
  | {
      status: "preserved_equal_revision_conflict";
      sharedAthleteId: string;
      sharedCompetitionId: string;
      matchLineageKey: string;
      revision: number;
    }
  | {
      status: "rejected_stale";
      sharedAthleteId: string;
      sharedCompetitionId: string;
      matchLineageKey: string;
      incomingRevision: number;
      existingRevision: number;
    }
  | {
      status: "rejected_invalid";
      reason:
        | "empty_sharedAthleteId"
        | "invalid_attachment_shape"
        | "athlete_id_mismatch";
      sharedAthleteId: string | null;
    };

let attachmentMemory: AttachmentSetByAthleteId | null = null;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSafeRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/** Row identity for Match media attachment projection metadata. */
export function coachMatchMediaAttachmentRowKey(input: {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
}): string {
  return JSON.stringify([
    input.sharedAthleteId.trim(),
    input.sharedCompetitionId.trim(),
    input.matchLineageKey.trim(),
  ]);
}

/**
 * Persist only projection-safe attached/tombstoned metadata.
 * Strips object keys, versions, URIs, credentials, and any unknown fields.
 */
export function toProjectionSafeMatchMediaAttachment(
  value: SyncedMatchMediaAttachmentProjection,
): SyncedMatchMediaAttachmentProjection | null {
  const sharedAthleteId = value.sharedAthleteId.trim();
  const sharedCompetitionId = value.sharedCompetitionId.trim();
  const matchLineageKey = value.matchLineageKey.trim();
  const updatedAt = value.updatedAt.trim();
  if (
    !sharedAthleteId ||
    !sharedCompetitionId ||
    !matchLineageKey ||
    !updatedAt ||
    !isSafeRevision(value.revision)
  ) {
    return null;
  }

  if (value.state === "attached") {
    const matchMediaAssetId = value.matchMediaAssetId.trim();
    const publishedAt = value.publishedAt.trim();
    if (!matchMediaAssetId || !publishedAt) return null;
    return {
      sharedAthleteId,
      sharedCompetitionId,
      matchLineageKey,
      revision: value.revision,
      state: "attached",
      matchMediaAssetId,
      publishedAt,
      updatedAt,
    };
  }

  if (value.state === "tombstoned") {
    const tombstonedAt = value.tombstonedAt.trim();
    if (!tombstonedAt) return null;
    if ("matchMediaAssetId" in value) return null;
    return {
      sharedAthleteId,
      sharedCompetitionId,
      matchLineageKey,
      revision: value.revision,
      state: "tombstoned",
      tombstonedAt,
      updatedAt,
    };
  }

  return null;
}

export function isValidSyncedMatchMediaAttachmentProjection(
  value: unknown,
): value is SyncedMatchMediaAttachmentProjection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const attachment = value as Record<string, unknown>;
  if (
    !isNonEmptyString(attachment.sharedAthleteId) ||
    !isNonEmptyString(attachment.sharedCompetitionId) ||
    !isNonEmptyString(attachment.matchLineageKey) ||
    !isSafeRevision(attachment.revision) ||
    !isNonEmptyString(attachment.updatedAt)
  ) {
    return false;
  }
  if (attachment.state === "attached") {
    return (
      isNonEmptyString(attachment.matchMediaAssetId) &&
      isNonEmptyString(attachment.publishedAt)
    );
  }
  if (attachment.state === "tombstoned") {
    return (
      isNonEmptyString(attachment.tombstonedAt) &&
      !("matchMediaAssetId" in attachment)
    );
  }
  return false;
}

export function isValidSyncedMatchMediaAttachmentProjectionSet(
  value: unknown,
): value is SyncedMatchMediaAttachmentProjectionSet {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const set = value as Record<string, unknown>;
  if (
    set.schemaVersion !== 1 ||
    !isNonEmptyString(set.sharedAthleteId) ||
    !Array.isArray(set.attachments)
  ) {
    return false;
  }
  const athleteId = set.sharedAthleteId.trim();
  const identityKeys = new Set<string>();
  for (const attachment of set.attachments) {
    if (!isValidSyncedMatchMediaAttachmentProjection(attachment)) return false;
    if (attachment.sharedAthleteId.trim() !== athleteId) return false;
    const key = coachMatchMediaAttachmentRowKey(attachment);
    if (identityKeys.has(key)) return false;
    identityKeys.add(key);
  }
  return true;
}

function projectionRecordsEqual(
  left: SyncedMatchMediaAttachmentProjection,
  right: SyncedMatchMediaAttachmentProjection,
): boolean {
  if (
    left.sharedAthleteId !== right.sharedAthleteId ||
    left.sharedCompetitionId !== right.sharedCompetitionId ||
    left.matchLineageKey !== right.matchLineageKey ||
    left.revision !== right.revision ||
    left.state !== right.state ||
    left.updatedAt !== right.updatedAt
  ) {
    return false;
  }
  if (left.state === "attached" && right.state === "attached") {
    return (
      left.matchMediaAssetId === right.matchMediaAssetId &&
      left.publishedAt === right.publishedAt
    );
  }
  if (left.state === "tombstoned" && right.state === "tombstoned") {
    return left.tombstonedAt === right.tombstonedAt;
  }
  return false;
}

function normalizeMap(raw: unknown): AttachmentSetByAthleteId {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: AttachmentSetByAthleteId = {};
  for (const [athleteId, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = athleteId.trim();
    if (!id || !isValidSyncedMatchMediaAttachmentProjectionSet(value)) continue;
    if (value.sharedAthleteId.trim() !== id) continue;
    const attachments: SyncedMatchMediaAttachmentProjection[] = [];
    for (const attachment of value.attachments) {
      const safe = toProjectionSafeMatchMediaAttachment(attachment);
      if (safe) attachments.push(safe);
    }
    out[id] = { schemaVersion: 1, sharedAthleteId: id, attachments };
  }
  return out;
}

function safeParseStore(raw: string | null): AttachmentSetByAthleteId {
  if (!raw) return {};
  try {
    return normalizeMap(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

async function readStore(): Promise<AttachmentSetByAthleteId> {
  const raw = await AsyncStorage.getItem(StorageKeys.coachMatchMediaAttachmentsByAthleteId);
  const map = safeParseStore(raw);
  attachmentMemory = map;
  return map;
}

async function writeStore(map: AttachmentSetByAthleteId): Promise<void> {
  attachmentMemory = map;
  await AsyncStorage.setItem(
    StorageKeys.coachMatchMediaAttachmentsByAthleteId,
    JSON.stringify(map),
  );
}

function findAttachmentIndex(
  attachments: readonly SyncedMatchMediaAttachmentProjection[],
  rowKey: string,
): number {
  return attachments.findIndex(
    (attachment) => coachMatchMediaAttachmentRowKey(attachment) === rowKey,
  );
}

export function peekCoachMatchMediaAttachmentSet(
  sharedAthleteId: string,
): SyncedMatchMediaAttachmentProjectionSet | null {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId || !attachmentMemory) return null;
  return attachmentMemory[athleteId] ?? null;
}

export async function getCoachMatchMediaAttachmentSet(
  sharedAthleteId: string,
): Promise<SyncedMatchMediaAttachmentProjectionSet | null> {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) return null;
  const map = await readStore();
  return map[athleteId] ?? null;
}

export async function getCoachMatchMediaAttachment(input: {
  sharedAthleteId: string;
  sharedCompetitionId: string;
  matchLineageKey: string;
}): Promise<SyncedMatchMediaAttachmentProjection | null> {
  const set = await getCoachMatchMediaAttachmentSet(input.sharedAthleteId);
  if (!set) return null;
  const rowKey = coachMatchMediaAttachmentRowKey(input);
  return set.attachments.find((attachment) => coachMatchMediaAttachmentRowKey(attachment) === rowKey) ?? null;
}

/**
 * Apply one projected attachment row with revision CAS.
 * Equal-revision identical → no-op; equal-revision conflict → keep existing; stale → reject.
 */
export async function applyCoachMatchMediaAttachment(
  incoming: SyncedMatchMediaAttachmentProjection,
): Promise<CoachMatchMediaAttachmentApplyOutcome> {
  const safe = isValidSyncedMatchMediaAttachmentProjection(incoming)
    ? toProjectionSafeMatchMediaAttachment(incoming)
    : null;
  if (!safe) {
    return {
      status: "rejected_invalid",
      reason: "invalid_attachment_shape",
      sharedAthleteId:
        typeof incoming?.sharedAthleteId === "string"
          ? incoming.sharedAthleteId.trim() || null
          : null,
    };
  }

  const athleteId = safe.sharedAthleteId;
  const map = await readStore();
  const existingSet = map[athleteId] ?? {
    schemaVersion: 1 as const,
    sharedAthleteId: athleteId,
    attachments: [] as SyncedMatchMediaAttachmentProjection[],
  };
  const rowKey = coachMatchMediaAttachmentRowKey(safe);
  const existingIndex = findAttachmentIndex(existingSet.attachments, rowKey);
  const existing = existingIndex >= 0 ? existingSet.attachments[existingIndex]! : null;

  if (existing) {
    if (safe.revision < existing.revision) {
      return {
        status: "rejected_stale",
        sharedAthleteId: athleteId,
        sharedCompetitionId: safe.sharedCompetitionId,
        matchLineageKey: safe.matchLineageKey,
        incomingRevision: safe.revision,
        existingRevision: existing.revision,
      };
    }
    if (safe.revision === existing.revision) {
      if (projectionRecordsEqual(safe, existing)) {
        return {
          status: "noop_identical",
          sharedAthleteId: athleteId,
          sharedCompetitionId: safe.sharedCompetitionId,
          matchLineageKey: safe.matchLineageKey,
          revision: safe.revision,
        };
      }
      return {
        status: "preserved_equal_revision_conflict",
        sharedAthleteId: athleteId,
        sharedCompetitionId: safe.sharedCompetitionId,
        matchLineageKey: safe.matchLineageKey,
        revision: safe.revision,
      };
    }
  }

  const nextAttachments = existingSet.attachments.slice();
  if (existingIndex >= 0) {
    nextAttachments[existingIndex] = safe;
  } else {
    nextAttachments.push(safe);
  }
  map[athleteId] = {
    schemaVersion: 1,
    sharedAthleteId: athleteId,
    attachments: nextAttachments,
  };
  await writeStore(map);

  return {
    status: "written",
    sharedAthleteId: athleteId,
    sharedCompetitionId: safe.sharedCompetitionId,
    matchLineageKey: safe.matchLineageKey,
    incomingRevision: safe.revision,
    previousRevision: existing?.revision ?? null,
  };
}

/**
 * Apply each projected row. Absent matches are preserve-not-delete.
 * Empty attachment arrays are a no-op for local rows.
 */
export async function applyCoachMatchMediaAttachmentSet(
  attachmentSet: SyncedMatchMediaAttachmentProjectionSet,
): Promise<CoachMatchMediaAttachmentApplyOutcome[]> {
  const athleteId = attachmentSet.sharedAthleteId?.trim?.() ?? "";
  if (!athleteId || !isValidSyncedMatchMediaAttachmentProjectionSet(attachmentSet)) {
    return [
      {
        status: "rejected_invalid",
        reason: !athleteId ? "empty_sharedAthleteId" : "invalid_attachment_shape",
        sharedAthleteId: athleteId || null,
      },
    ];
  }
  if (attachmentSet.sharedAthleteId.trim() !== athleteId) {
    return [
      {
        status: "rejected_invalid",
        reason: "athlete_id_mismatch",
        sharedAthleteId: athleteId,
      },
    ];
  }

  const outcomes: CoachMatchMediaAttachmentApplyOutcome[] = [];
  for (const attachment of attachmentSet.attachments) {
    outcomes.push(await applyCoachMatchMediaAttachment(attachment));
  }
  return outcomes;
}

export async function removeCoachMatchMediaAttachments(
  sharedAthleteId: string,
): Promise<void> {
  const athleteId = sharedAthleteId.trim();
  if (!athleteId) return;
  const map = await readStore();
  if (!(athleteId in map)) return;
  delete map[athleteId];
  await writeStore(map);
}

/**
 * Drop attachment sets whose athlete id is outside the authoritative linked roster.
 */
export async function pruneCoachMatchMediaAttachments(
  allowedAthleteIds: ReadonlySet<string>,
): Promise<void> {
  const allowed = new Set([...allowedAthleteIds].map((id) => id.trim()).filter(Boolean));
  const map = await readStore();
  let removed = false;
  for (const id of Object.keys(map)) {
    if (!allowed.has(id)) {
      delete map[id];
      removed = true;
    }
  }
  if (!removed) return;
  await writeStore(map);
}
