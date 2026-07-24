import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function source(pathFromRepoRoot: string): string {
  return readFileSync(path.join(repoRoot, pathFromRepoRoot), "utf8");
}

describe("Parent Shared Match Media upload corridor wiring", () => {
  const parentEdit = source("app/(tabs)/this-week/kid/[kidId]/competition/edit.tsx");
  const domain = source("src/domain/competition/uploadParentSharedMatchMedia.ts");
  const api = source("src/services/sharedMatchMediaUploadApi.ts");
  const publicationApi = source("src/services/sharedMatchMediaPublicationApi.ts");
  const store = source("src/storage/sharedMatchMediaUploadStore.ts");
  const flags = source("src/config/sharedMatchMediaUploadFlags.ts");
  const foundation = source("coach-sync-worker/src/sharedMatchMediaUpload.ts");

  it("Parent competition video selection enters the upload client path", () => {
    assert.match(parentEdit, /scheduleUploadParentSelectedSharedMatchMedia/);
    assert.match(parentEdit, /onVideoChange=\{/);
    assert.match(parentEdit, /Match video upload failed/);
  });

  it("upload client uses authenticated match-media multipart foundation contracts", () => {
    assert.match(api, /\/match-media\/uploads/);
    assert.match(api, /\/parts\//);
    assert.match(api, /\/complete/);
    assert.match(api, /X-MatMind-Part-SHA256/);
    assert.match(api, /SHARED_MATCH_MEDIA_TRANSPORT_PART_BYTES|transportPartBytes/);
    assert.match(api, /objectVersion/);
    assert.match(api, /upload_complete/);
    assert.match(api, /Does not verify, publish, resolve, or play/);
    assert.doesNotMatch(api, /\/media-attachment|\/verify|\/publish/);
  });

  it("keeps Parent publication independently default-off and verified-completion-only", () => {
    assert.match(flags, /EXPO_PUBLIC_SHARED_MATCH_MEDIA_PUBLICATION_CLIENT/);
    assert.match(domain, /result\.serverReportedVerified && sharedMatchMediaPublicationClientEnabled/);
    assert.match(publicationApi, /\/v1\/sessions\/\$\{encodeURIComponent\(linkToken\)\}\/match-media\/attachments/);
    assert.match(publicationApi, /expectedRevision: 0/);
    assert.match(publicationApi, /Authorization: `Bearer \$\{parentWriterSecret\}`/);
    assert.doesNotMatch(publicationApi, /deliveryUri|FilmRoom|projection/i);
  });

  it("domain persists upload_complete identity without verification or publication", () => {
    assert.match(domain, /putSharedMatchMediaUploadComplete/);
    assert.match(domain, /verification: false/);
    assert.match(domain, /publication: publication\?\.outcome \?\? false/);
    assert.match(domain, /resolveLinkedTargetForParentWriter/);
    assert.match(store, /status: "upload_complete"/);
    assert.match(store, /objectVersion/);
    assert.match(store, /matchMediaAssetId/);
    assert.match(store, /not verified, published, or playable/);
    assert.doesNotMatch(store, /resolvedUrl|deliveryUri|verifiedAt|publishedAt/);
  });

  it("foundation completion response exposes domain objectVersion", () => {
    assert.match(foundation, /objectVersion: state\.completedObject\.providerVersion/);
    assert.match(flags, /EXPO_PUBLIC_SHARED_MATCH_MEDIA_UPLOAD_CLIENT/);
    assert.match(flags, /99_000_000/);
  });

  it("domain skip paths reject remote links and missing associations without false completion", () => {
    assert.match(domain, /http_or_remote_uri/);
    assert.match(domain, /missing_associations/);
    assert.match(domain, /already_upload_complete/);
    assert.match(domain, /upload_failed/);
    assert.doesNotMatch(domain, /status:\s*"verified"|status:\s*"published"/);
  });
});
