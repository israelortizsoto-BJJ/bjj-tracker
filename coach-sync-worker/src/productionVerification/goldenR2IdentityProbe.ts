/**
 * One-purpose, read-only operator probe for the certified Golden upload object.
 *
 * This is deliberately not an object browser: it has no caller-controlled object
 * identity, lists nothing, and only returns the upload session id after the R2
 * HEAD version matches the one certified Golden object version exactly.
 */

import { authorizeOperatorInspection } from "./operatorInspection.ts";

export const GOLDEN_MATCH_MEDIA_ASSET_ID =
  "mma_19f8b0e7-2ab2-42ac-bf7b-7da64289687e";
export const GOLDEN_MATCH_MEDIA_OBJECT_VERSION =
  "7e605a9ec2d0093bf258291f3bea8bdf";
export const GOLDEN_MATCH_MEDIA_OBJECT_KEY =
  `match-media/assets/${GOLDEN_MATCH_MEDIA_ASSET_ID}/original`;

export type GoldenR2IdentityProbeBucket = Readonly<{
  head(key: string): Promise<
    | Readonly<{
        version?: string;
        customMetadata?: Readonly<Record<string, string>>;
      }>
    | null
  >;
}>;

export type GoldenR2IdentityProbeOutcome =
  | "object_missing"
  | "object_version_mismatch"
  | "upload_session_id_missing"
  | "object_version_match";

/**
 * Performs exactly one R2 HEAD. It never calls get, put, list, or any media
 * workflow dependency. The returned session id is bound to this exact HEAD's
 * object.version by the only success branch.
 */
export async function probeGoldenR2IdentityReadOnly(
  bucket: GoldenR2IdentityProbeBucket,
): Promise<
  | Readonly<{ outcome: Exclude<GoldenR2IdentityProbeOutcome, "object_version_match"> }>
  | Readonly<{ outcome: "object_version_match"; uploadSessionId: string }>
> {
  const object = await bucket.head(GOLDEN_MATCH_MEDIA_OBJECT_KEY);
  if (!object) return { outcome: "object_missing" };
  if (object.version !== GOLDEN_MATCH_MEDIA_OBJECT_VERSION) {
    return { outcome: "object_version_mismatch" };
  }
  const uploadSessionId = object.customMetadata?.uploadSessionId ?? "";
  if (!/^mmus_[A-Za-z0-9_-]+$/.test(uploadSessionId)) {
    return { outcome: "upload_session_id_missing" };
  }
  return { outcome: "object_version_match", uploadSessionId };
}

/**
 * Authenticated internal HTTP wrapper. No body, query identity, or caller
 * supplied asset/version is accepted, preventing use as a generic R2 probe.
 */
export async function handleGoldenR2IdentityProbeHttpRequest(args: {
  readonly method: string;
  readonly authorizationHeader: string | null;
  readonly operatorSecret: string | undefined;
  readonly bucket: GoldenR2IdentityProbeBucket;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (args.method !== "POST") {
    return { status: 405, body: { error: "Method Not Allowed" } };
  }
  const auth = await authorizeOperatorInspection({
    authorizationHeader: args.authorizationHeader,
    operatorSecret: args.operatorSecret,
  });
  if (!auth.ok) {
    // Do not reveal R2 object state when the operator secret is absent or wrong.
    return { status: 401, body: { error: "Unauthorized" } };
  }
  const result = await probeGoldenR2IdentityReadOnly(args.bucket);
  return { status: 200, body: result };
}
