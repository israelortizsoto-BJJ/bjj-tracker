import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repoRoot = path.resolve(packageRoot, "..");

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const absolute = path.join(root, entry);
    if (statSync(absolute).isDirectory()) {
      files.push(...sourceFiles(absolute));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) {
      files.push(absolute);
    }
  }
  return files;
}

function combinedSource(root: string): string {
  return sourceFiles(root)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

describe("Publication domain remains disabled and unwired", () => {
  it("has no Worker, network, binary, client-local, projection, resolution, or playback capability", () => {
    const source = combinedSource(path.join(packageRoot, "src"));
    for (const forbidden of [
      /\bfetch\s*\(/,
      /\benv\./,
      /\bR2Bucket\b/,
      /\bPROOF_MEDIA\b/,
      /\bvideoUri\b/,
      /\bvideoAssetId\b/,
      /\bparentMediaRefs\b/,
      /\bPlaybackCoordinator\b/,
      /\bFilmRoom\b/,
      /\bsignedUrl\b/i,
      /\bresolveMedia\b/,
      /\brunProductionVerification\b/,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  });

  it("is not imported by Worker, client, or Production Verification runtime", () => {
    const packageName = "shared-match-media-publication";
    const worker = combinedSource(path.join(repoRoot, "coach-sync-worker", "src"));
    const client = combinedSource(path.join(repoRoot, "src"));
    const verification = combinedSource(
      path.join(repoRoot, "shared-match-media-production-verification", "src"),
    );
    assert.doesNotMatch(worker, new RegExp(packageName));
    assert.doesNotMatch(client, new RegExp(packageName));
    assert.doesNotMatch(verification, new RegExp(packageName));
  });

  it("declares no runtime, deployment, or Cloudflare dependency", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(packageRoot, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    assert.equal(manifest.dependencies, undefined);
    assert.deepEqual(Object.keys(manifest.scripts ?? {}).sort(), [
      "test",
      "typecheck",
    ]);
    assert.deepEqual(manifest.devDependencies, { typescript: "5.9.3" });
  });
});
