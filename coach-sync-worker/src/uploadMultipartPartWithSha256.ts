/**
 * Narrow adapter for R2 multipart uploadPart with per-part { sha256 }.
 *
 * { sha256 } support is established by existing runtime certification or
 * observed behavior; it is not currently represented in the published
 * R2MultipartOptions/Workers type contract.
 *
 * Always invoke through the multipart receiver (or an explicit bind/call with
 * that receiver). Do not extract multipart.uploadPart into an unbound function.
 */

export type Sha256UploadPartOptions = { sha256: string };

export type UploadedPartResult = { partNumber: number; etag: string };

export type MultipartUploadPartHost = {
  uploadPart(
    partNumber: number,
    value: ReadableStream,
    options?: unknown,
  ): Promise<UploadedPartResult>;
};

type UploadPartWithSha256 = (
  this: MultipartUploadPartHost,
  partNumber: number,
  value: ReadableStream,
  options: Sha256UploadPartOptions,
) => Promise<UploadedPartResult>;

export function uploadMultipartPartWithSha256(
  multipart: MultipartUploadPartHost,
  partNumber: number,
  value: ReadableStream,
  options: Sha256UploadPartOptions,
): Promise<UploadedPartResult> {
  const uploadPart = multipart.uploadPart as UploadPartWithSha256;
  return uploadPart.call(multipart, partNumber, value, options);
}
