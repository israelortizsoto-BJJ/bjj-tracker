import { getCoachLinks } from "../../storage/coachShareStore";
import { getSharedMatchMediaUploadRecord } from "../../storage/sharedMatchMediaUploadStore";
import {
  inspectParentVerifiedCompletionReplayPrerequisites,
  type ParentVerifiedCompletionReplayPrerequisiteIdentity,
  type ParentVerifiedCompletionReplayPrerequisiteResult,
} from "./parentVerifiedCompletionReplayPrerequisiteInspector";

function hasLocalParentWriterCredentials(): Promise<boolean> {
  return getCoachLinks().then((links) =>
    links.some(
      (link) =>
        link.status === "active" &&
        Boolean(link.weeklySync?.linkToken.trim()) &&
        Boolean(link.weeklySync?.parentWriterSecret?.trim()),
    ),
  );
}

/**
 * Reads only device-local upload and link stores. It deliberately does not prove remote session authority.
 */
export function inspectOneParentVerifiedCompletionReplayPrerequisites(
  input: ParentVerifiedCompletionReplayPrerequisiteIdentity,
): Promise<ParentVerifiedCompletionReplayPrerequisiteResult> {
  return inspectParentVerifiedCompletionReplayPrerequisites(input, {
    isDevelopment: () => __DEV__,
    loadRecord: getSharedMatchMediaUploadRecord,
    hasLocalParentWriterCredentials,
  });
}

export type {
  ParentVerifiedCompletionReplayPrerequisiteIdentity,
  ParentVerifiedCompletionReplayPrerequisiteResult,
};
