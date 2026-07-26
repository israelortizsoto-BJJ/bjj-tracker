/**
 * Parent Shared Match Media upload client gate.
 * Defaults off until the worker SHARED_MATCH_MEDIA_UPLOAD_ENABLED flag is on
 * and Parent runtime certification is collected.
 */
export const sharedMatchMediaUploadClientEnabled =
  process.env.EXPO_PUBLIC_SHARED_MATCH_MEDIA_UPLOAD_CLIENT === "1";

/**
 * Parent publication is a separately controlled request after a Worker-reported
 * verified upload completion. It never enables Upload or Worker Publication.
 */
export function isSharedMatchMediaPublicationClientEnabled(value?: string): boolean {
  return value === "1";
}

export const sharedMatchMediaPublicationClientEnabled =
  isSharedMatchMediaPublicationClientEnabled(
    process.env.EXPO_PUBLIC_SHARED_MATCH_MEDIA_PUBLICATION_CLIENT,
  );

/**
 * Allows an explicit Parent replay of an already-completed upload so the
 * Worker can report its verification result. Default-off; never implied by
 * upload or publication enablement.
 */
export const sharedMatchMediaVerifiedCompletionReplayClientEnabled =
  process.env.EXPO_PUBLIC_SHARED_MATCH_MEDIA_VERIFIED_COMPLETION_REPLAY_CLIENT === "1";

/**
 * Coach editor shared-media binding remains inert until separately certified and
 * explicitly enabled. Server projection/resolution capability is still required.
 */
export const sharedMatchMediaEditorBindingClientEnabled =
  process.env.EXPO_PUBLIC_SHARED_MATCH_MEDIA_EDITOR_BINDING_CLIENT === "1";

/** Certified transport-safe multipart part size (bytes). */
export const SHARED_MATCH_MEDIA_TRANSPORT_PART_BYTES = 99_000_000;
