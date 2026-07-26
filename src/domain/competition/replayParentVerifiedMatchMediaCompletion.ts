import { sharedMatchMediaVerifiedCompletionReplayClientEnabled } from "../../config/sharedMatchMediaUploadFlags";
import { getSharedMatchMediaUploadRecord } from "../../storage/sharedMatchMediaUploadStore";
import {
  releaseSynchronousReplayAttempt,
  runOneParentVerifiedCompletionReplay,
  tryAcquireSynchronousReplayAttempt,
  type ParentVerifiedCompletionReplayIdentity,
  type ParentVerifiedCompletionReplayResult,
} from "./parentVerifiedCompletionReplayController";
import { uploadParentSelectedSharedMatchMedia } from "./uploadParentSharedMatchMedia";

export {
  releaseSynchronousReplayAttempt,
  tryAcquireSynchronousReplayAttempt,
  type ParentVerifiedCompletionReplayIdentity,
  type ParentVerifiedCompletionReplayResult,
};

function createTraceId(): string {
  return `verified-completion-replay-${Date.now().toString(36)}`;
}

/** DEV-only production integration for the one-record replay controller. */
export function replayOneParentVerifiedMatchMediaCompletion(
  input: ParentVerifiedCompletionReplayIdentity,
): Promise<ParentVerifiedCompletionReplayResult> {
  return runOneParentVerifiedCompletionReplay(input, {
    isDevelopment: () => __DEV__,
    replayEnabled: () => sharedMatchMediaVerifiedCompletionReplayClientEnabled,
    loadRecord: getSharedMatchMediaUploadRecord,
    replay: uploadParentSelectedSharedMatchMedia,
    createTraceId,
  });
}
