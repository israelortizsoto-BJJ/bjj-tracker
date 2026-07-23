/**
 * Parent Shared Match Media upload client gate.
 * Defaults off until the worker SHARED_MATCH_MEDIA_UPLOAD_ENABLED flag is on
 * and Parent runtime certification is collected.
 */
export const sharedMatchMediaUploadClientEnabled =
  process.env.EXPO_PUBLIC_SHARED_MATCH_MEDIA_UPLOAD_CLIENT === "1";

/** Certified transport-safe multipart part size (bytes). */
export const SHARED_MATCH_MEDIA_TRANSPORT_PART_BYTES = 99_000_000;
