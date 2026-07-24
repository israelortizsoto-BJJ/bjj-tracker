import {
  sharedMatchMediaPublicationClientEnabled,
  sharedMatchMediaUploadClientEnabled,
} from "../../config/sharedMatchMediaUploadFlags";
import { resolveLinkedTargetForParentWriter } from "../../family/parentKidCompetitionDelete";
import {
  uploadParentSharedMatchMediaVideo,
  type SharedMatchMediaUploadCompleteResult,
  type SharedMatchMediaUploadDependencies,
} from "../../services/sharedMatchMediaUploadApi";
import {
  publishParentMatchMediaAttachment,
  type ParentMatchMediaPublicationDependencies,
  type ParentMatchMediaPublicationResult,
} from "../../services/sharedMatchMediaPublicationApi";
import {
  getSharedMatchMediaUploadRecord,
  putSharedMatchMediaUploadComplete,
  type SharedMatchMediaUploadRecord,
} from "../../storage/sharedMatchMediaUploadStore";

export type ParentSharedMatchMediaUploadOutcome =
  | {
      ok: true;
      skipped?: undefined;
      result: SharedMatchMediaUploadCompleteResult;
      record: SharedMatchMediaUploadRecord;
      publication?: ParentMatchMediaPublicationResult | { outcome: "failed"; message: string };
    }
  | {
      ok: false;
      skipped: true;
      reason:
        | "client_flag_off"
        | "missing_associations"
        | "http_or_remote_uri"
        | "no_parent_writer_target"
        | "already_upload_complete";
      message: string;
    }
  | {
      ok: false;
      skipped?: false;
      reason: "upload_failed";
      message: string;
    };

function logUpload(stage: string, payload: Record<string, unknown>): void {
  console.log("[SHARED_MATCH_MEDIA_UPLOAD]", { stage, ...payload });
}

export type ParentSharedMatchMediaUploadRequest = {
  localUri: string | null | undefined;
  sharedAthleteId: string | null | undefined;
  sharedCompetitionId: string | null | undefined;
  matchLineageKey: string | null | undefined;
  force?: boolean;
  dependencies?: Partial<SharedMatchMediaUploadDependencies>;
  publicationDependencies?: Partial<ParentMatchMediaPublicationDependencies>;
};

/**
 * Parent-selected local match video → authenticated Shared Match Media foundation →
 * transport-safe multipart → upload_complete with immutable asset identity + object version.
 *
 * Does not verify, publish, resolve, or change playback/transcript systems.
 */
export async function uploadParentSelectedSharedMatchMedia(
  input: ParentSharedMatchMediaUploadRequest,
): Promise<ParentSharedMatchMediaUploadOutcome> {
  if (!sharedMatchMediaUploadClientEnabled && !input.force) {
    return {
      ok: false,
      skipped: true,
      reason: "client_flag_off",
      message: "Shared Match Media upload client flag is off.",
    };
  }

  const localUri = typeof input.localUri === "string" ? input.localUri.trim() : "";
  const sharedAthleteId =
    typeof input.sharedAthleteId === "string" ? input.sharedAthleteId.trim() : "";
  const sharedCompetitionId =
    typeof input.sharedCompetitionId === "string" ? input.sharedCompetitionId.trim() : "";
  const matchLineageKey =
    typeof input.matchLineageKey === "string" ? input.matchLineageKey.trim() : "";

  if (!localUri) {
    return {
      ok: false,
      skipped: true,
      reason: "missing_associations",
      message: "No local match video selected.",
    };
  }
  if (/^https?:\/\//i.test(localUri)) {
    return {
      ok: false,
      skipped: true,
      reason: "http_or_remote_uri",
      message: "Remote video links are not Shared Match Media uploads.",
    };
  }
  if (!sharedAthleteId || !sharedCompetitionId || !matchLineageKey) {
    return {
      ok: false,
      skipped: true,
      reason: "missing_associations",
      message:
        "Shared Match Media upload requires linked athlete, competition, and match identity.",
    };
  }

  const existing = await getSharedMatchMediaUploadRecord({
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
  });
  if (
    existing?.status === "upload_complete" &&
    existing.localSourceUri === localUri &&
    existing.matchMediaAssetId &&
    existing.objectVersion
  ) {
    logUpload("already_upload_complete", {
      sharedAthleteId,
      sharedCompetitionId,
      matchLineageKey,
      matchMediaAssetId: existing.matchMediaAssetId,
    });
    return {
      ok: false,
      skipped: true,
      reason: "already_upload_complete",
      message: "Match video already reached upload_complete for this local source.",
    };
  }

  const target = await resolveLinkedTargetForParentWriter(sharedAthleteId);
  if (!target) {
    return {
      ok: false,
      skipped: true,
      reason: "no_parent_writer_target",
      message: "No Parent writer session is available for Shared Match Media upload.",
    };
  }

  logUpload("UPLOAD_BEGIN", {
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
    hasLocalUri: true,
  });

  try {
    const result = await uploadParentSharedMatchMediaVideo({
      linkToken: target.linkToken,
      parentWriterSecret: target.parentWriterSecret,
      localUri,
      associations: { sharedAthleteId, sharedCompetitionId, matchLineageKey },
      apiBaseUrlOverride: target.apiBaseUrl,
      dependencies: input.dependencies,
    });

    // Only persist after explicit upload_complete with identity + object version.
    const record = await putSharedMatchMediaUploadComplete({
      sharedAthleteId: result.sharedAthleteId,
      sharedCompetitionId: result.sharedCompetitionId,
      matchLineageKey: result.matchLineageKey,
      matchMediaAssetId: result.matchMediaAssetId,
      objectVersion: result.objectVersion,
      uploadSessionId: result.uploadSessionId,
      completedByteCount: result.completedByteCount,
      completedAt: result.completedAt,
      declaredMimeType: result.declaredMimeType,
      declaredByteCount: result.declaredByteCount,
      localSourceUri: result.localSourceUri,
    });

    let publication:
      | ParentMatchMediaPublicationResult
      | { outcome: "failed"; message: string }
      | undefined;
    if (result.serverReportedVerified && sharedMatchMediaPublicationClientEnabled) {
      try {
        publication = await publishParentMatchMediaAttachment({
          linkToken: target.linkToken,
          parentWriterSecret: target.parentWriterSecret,
          sharedAthleteId: record.sharedAthleteId,
          sharedCompetitionId: record.sharedCompetitionId,
          matchLineageKey: record.matchLineageKey,
          matchMediaAssetId: record.matchMediaAssetId,
          objectVersion: record.objectVersion,
          expectedRevision: 0,
          apiBaseUrlOverride: target.apiBaseUrl,
          dependencies: input.publicationDependencies,
        });
      } catch (error) {
        publication = {
          outcome: "failed",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }

    logUpload("UPLOAD_COMPLETE", {
      sharedAthleteId,
      sharedCompetitionId,
      matchLineageKey,
      matchMediaAssetId: record.matchMediaAssetId,
      objectVersion: record.objectVersion,
      status: record.status,
      verification: false,
      publication: publication?.outcome ?? false,
    });

    return { ok: true, result, record, ...(publication ? { publication } : {}) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logUpload("UPLOAD_FAILED", {
      sharedAthleteId,
      sharedCompetitionId,
      matchLineageKey,
      error: message,
    });
    return {
      ok: false,
      reason: "upload_failed",
      message,
    };
  }
}

/**
 * Fire-and-forget Parent video selection → upload client entry.
 * Failures are visible via onFailure; never records false completion.
 */
export function scheduleUploadParentSelectedSharedMatchMedia(
  input: ParentSharedMatchMediaUploadRequest,
  hooks?: {
    onFailure?: (message: string) => void;
    onComplete?: (record: SharedMatchMediaUploadRecord) => void;
  },
): void {
  void (async () => {
    const outcome = await uploadParentSelectedSharedMatchMedia(input);
    if (outcome.ok) {
      hooks?.onComplete?.(outcome.record);
      return;
    }
    if (outcome.skipped) {
      logUpload("UPLOAD_SKIPPED", {
        reason: outcome.reason,
        message: outcome.message,
      });
      return;
    }
    hooks?.onFailure?.(outcome.message);
  })();
}
