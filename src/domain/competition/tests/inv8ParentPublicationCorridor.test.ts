import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

/**
 * INV8 Gate B — repository certification of the Parent Compete publication site.
 *
 * Uncertainty removed:
 *   During Parent Compete focus refresh, only one bumpCoachSyncHydrationVersion
 *   call site is reachable. INV8 suppression must target that site alone.
 *
 * Runtime pairing (July 10 handoff, preserved):
 *   hydrationVersion climbed while competitionVersion stayed stable;
 *   REFRESH_END → cancelled=true → RETURN_BEFORE_LOAD_COMPETITIONS.
 */

function source(path: string): string {
  return readFileSync(path, "utf8");
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkTsFiles(full, out);
      continue;
    }
    if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      if (name.includes(".test.")) continue;
      out.push(full);
    }
  }
  return out;
}

function bumpCallSites(): Array<{ file: string; snippet: string }> {
  const sites: Array<{ file: string; snippet: string }> = [];
  for (const abs of [...walkTsFiles("src"), ...walkTsFiles("app")]) {
    const text = readFileSync(abs, "utf8");
    const rel = relative(".", abs);
    if (rel === "src/storage/coachSyncHydrationStore.ts") continue;
    let searchFrom = 0;
    while (true) {
      const idx = text.indexOf("bumpCoachSyncHydrationVersion(", searchFrom);
      if (idx < 0) break;
      sites.push({
        file: rel,
        snippet: text.slice(idx, idx + 180).replace(/\s+/g, " "),
      });
      searchFrom = idx + 1;
    }
  }
  return sites;
}

describe("INV8 Parent publication corridor (Gate B)", () => {
  it("exposes exactly two hydration bump publishers in production source", () => {
    const sites = bumpCallSites();
    assert.equal(
      sites.length,
      2,
      `expected 2 bump sites, found ${sites.length}: ${sites
        .map((s) => s.file)
        .join(", ")}`,
    );
    const files = sites.map((s) => s.file).sort();
    assert.deepEqual(files, [
      "src/storage/coachKidStore.ts",
      "src/storage/coachWeeklySyncCacheStore.ts",
    ]);
  });

  it("binds the Parent Compete corridor to the artifact-hydration bump only", () => {
    const compete = source("app/(tabs)/compete.tsx");
    const refresh = source("src/services/refreshParentWriterSessionSnapshot.ts");
    const cache = source("src/storage/coachWeeklySyncCacheStore.ts");
    const authority = source("src/identity/buildAthleteAuthoritySnapshot.ts");
    const coachKid = source("src/storage/coachKidStore.ts");

    assert.ok(
      compete.includes("refreshParentWriterSessionSnapshot"),
      "Compete Parent path must call shared Parent refresh",
    );
    assert.equal(
      compete.includes("refreshCoachWriterSessionsAndReconcileStores"),
      false,
      "Compete must not call coach reconcile publisher",
    );
    assert.equal(
      refresh.includes("refreshCoachWriterSessionsAndReconcileStores"),
      false,
      "Parent refresh service must not call coach reconcile",
    );
    assert.ok(
      refresh.includes("setCachedWeeklyForLinkToken"),
      "Parent refresh must write weekly/session cache",
    );
    assert.equal(
      refresh.includes("bumpCoachSyncHydrationVersion"),
      false,
      "Parent refresh must not bump directly; publication owns the bump",
    );

    const setCachedStart = cache.indexOf(
      "export async function setCachedWeeklyForLinkToken",
    );
    assert.ok(setCachedStart >= 0);
    const setCachedEnd = cache.indexOf(
      "export async function clearCachedWeeklyForLinkToken",
      setCachedStart,
    );
    const setCachedFn = cache.slice(setCachedStart, setCachedEnd);
    assert.ok(
      setCachedFn.includes('reason: "coach_match_breakdown_artifacts_hydrated"'),
      "corridor bump reason must remain coach_match_breakdown_artifacts_hydrated",
    );
    assert.ok(
      setCachedFn.includes("artifactSets.length > 0"),
      "bump must remain gated on non-empty artifact sets",
    );
    assert.ok(
      setCachedFn.includes("__INV8_SUPPRESS_ARTIFACT_HYDRATION_BUMP__"),
      "INV8 suppress flag must gate the artifact hydration bump site",
    );
    assert.ok(
      setCachedFn.includes('stage: "publication_suppressed"'),
      "INV8 suppress path must emit publication_suppressed probe",
    );
    assert.ok(
      setCachedFn.includes("__DEV__") &&
        setCachedFn.includes("__INV8_SUPPRESS_ARTIFACT_HYDRATION_BUMP__ === true"),
      "INV8 suppress must be __DEV__-only and default OFF (explicit === true)",
    );
    assert.equal(
      /JSON\.stringify|payloadEqual|shouldBump|skipBump|unchanged/.test(setCachedFn),
      false,
      "no payload equality gate may exist before the artifact bump (INV3)",
    );

    assert.ok(
      coachKid.includes(
        'reason: "refreshCoachWriterSessionsAndReconcileStores_complete"',
      ),
      "alternate publisher must remain the coach reconcile complete bump",
    );
    assert.ok(
      authority.includes(
        "parentRole === \"coach\" && !skipCoachWriterSessionRefresh",
      ),
      "coach reconcile publisher remains coach-role gated",
    );
  });

  it("keeps Compete focus effect subscribed to coachSyncHydrationVersion", () => {
    const compete = source("app/(tabs)/compete.tsx");
    assert.ok(
      compete.includes(
        "[athleteId, linkedKidId, coachSyncHydrationVersion, competitionVersion, deviceRole]",
      ),
      "focus effect deps must include coachSyncHydrationVersion (starvation coupling)",
    );
    assert.ok(
      compete.includes('stage: "RETURN_BEFORE_LOAD_COMPETITIONS"'),
      "INV8 bridge probe must remain available for convergence comparison",
    );
  });
});
