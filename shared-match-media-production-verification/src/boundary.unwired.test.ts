import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageRoot, "..");

function rg(pattern: string, cwd: string, globs: string[] = []): string {
  const args = ["-n", "--glob", "!**/node_modules/**", pattern];
  for (const glob of globs) {
    args.push("--glob", glob);
  }
  args.push(".");
  try {
    return execFileSync("rg", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    if (err.status === 1) return err.stdout ?? "";
    throw error;
  }
}

function collectFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) collectFiles(full, out);
    else out.push(full);
  }
  return out;
}

describe("disabled and unwired boundary", () => {
  it("package contains no production storage client, ffmpeg, or credential usage", () => {
    const srcFiles = collectFiles(path.join(packageRoot, "src")).filter(
      (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
    );
    const joined = srcFiles.map((file) => readFileSync(file, "utf8")).join("\n");
    assert.equal(/@aws-sdk|S3Client|R2Bucket|env\.MEDIA|getSignedUrl/.test(joined), false);
    assert.equal(/ffmpeg|ffprobe|createReadStream\(|createWriteStream\(/.test(joined), false);
    assert.equal(/AWS_SECRET|R2_SECRET|production credential/i.test(joined), false);
    assert.equal(/matmind-coach-media/.test(joined), false);
  });

  it("package.json has no deploy/dev/worker scripts and no wrangler dependency", () => {
    const pkg = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    assert.equal(pkg.scripts?.deploy, undefined);
    assert.equal(pkg.scripts?.dev, undefined);
    assert.ok(pkg.scripts?.test);
    assert.ok(pkg.scripts?.typecheck);
    assert.equal(pkg.dependencies, undefined);
    assert.equal(pkg.devDependencies?.wrangler, undefined);
  });

  it("durable adapter is injected-capability only and is not a runtime binding", () => {
    const adapter = readFileSync(
      path.join(packageRoot, "src/conditionalObjectVerificationRecordStore.ts"),
      "utf8",
    );
    const objects = readFileSync(
      path.join(packageRoot, "src/conditionalObjectStore.ts"),
      "utf8",
    );
    assert.match(adapter, /etagDoesNotMatch/);
    assert.match(adapter, /etagMatches/);
    assert.equal(/\benv\b/.test(adapter), false);
    assert.equal(/\benv\b/.test(objects), false);
    assert.equal(/from ["'].*coach-sync-worker/.test(adapter + objects), false);
    assert.equal(
      existsSync(path.join(packageRoot, "src/memoryVerificationRecordStore.ts")),
      false,
    );
  });

  it("upload completion and coach-sync-worker do not import the skeleton", () => {
    const hits = rg(
      "shared-match-media-production-verification|admitVerification|deriveAdmissionIdentity|matmind-shared-media-production-verification",
      repoRoot,
      [
        "coach-sync-worker/**",
        "src/domain/competition/**",
        "src/services/**",
        "src/config/**",
        "src/storage/**",
      ],
    );
    assert.equal(hits.trim(), "");
  });

  it("no new verification feature flag appears in runtime configuration", () => {
    const flagHits = rg(
      "SHARED_MATCH_MEDIA_VERIFICATION_ENABLED",
      repoRoot,
      [
        "coach-sync-worker/**",
        "src/**",
        "app.config.*",
        "wrangler.*",
        "*.toml",
        "*.jsonc",
        "*.env*",
      ],
    );
    // Flag name may appear in certification docs as name-only contract.
    // It must not appear in runtime configuration surfaces.
    assert.equal(flagHits.trim(), "");

    const skeletonSrcHits = rg(
      "SHARED_MATCH_MEDIA_VERIFICATION_ENABLED",
      path.join(packageRoot, "src"),
      ["!*.test.ts"],
    );
    // Skeleton implementation modules must not add or evaluate the flag.
    assert.equal(skeletonSrcHits.trim(), "");
  });

  it("no route, worker, queue, scheduler, or event subscriber wires admission", () => {
    const workerIndex = readFileSync(
      path.join(repoRoot, "coach-sync-worker/src/index.ts"),
      "utf8",
    );
    assert.equal(workerIndex.includes("production-verification"), false);
    assert.equal(workerIndex.includes("admitVerification"), false);
    assert.equal(workerIndex.includes("ProductionVerification"), false);

    const scheduleHits = rg(
      "admitVerification|ProductionVerificationRecord|createConditionalObjectVerificationRecordStore",
      repoRoot,
      ["coach-sync-worker/**", "src/**", "app/**", "scripts/**"],
    );
    assert.equal(scheduleHits.trim(), "");
  });

  it("privacy scan hook refuses implicit approval", async () => {
    const { createUnimplementedPrivacyScanHook } = await import("./privacyScanHook.ts");
    const hook = createUnimplementedPrivacyScanHook();
    await assert.rejects(
      () =>
        hook.evaluate({
          verificationRecordId: "pvr_x",
          admissionKeyHash: "a".repeat(64),
          policyIdentity: "unresolved",
          timeoutBudgetMs: 1,
        }),
      /No production implementation exists/,
    );
  });
});
