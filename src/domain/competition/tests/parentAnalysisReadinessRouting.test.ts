import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

function assertParentHydrationOrder(
  file: string,
  sliceStart: string,
): void {
  const full = source(file);
  const start = full.indexOf(sliceStart);
  assert.ok(start >= 0, `${file}: missing route boundary`);
  const route = full.slice(start);
  const coordinator = route.indexOf("startCoachAnalysisReadinessRun");
  const fetch = route.indexOf(
    "session = await coachSyncFetchSession",
  );
  const cache = route.indexOf("setCachedWeeklyForLinkToken");
  const success = route.indexOf("recordSuccessfulSession");
  const finalize = route.indexOf(
    "finalize(new Date().toISOString())",
    success,
  );

  assert.ok(coordinator >= 0, `${file}: coordinator not invoked`);
  assert.ok(coordinator < fetch, `${file}: generation must start before fetch`);
  assert.ok(fetch < cache, `${file}: cache write must follow fetch`);
  assert.ok(cache < success, `${file}: success must follow cache/artifact writes`);
  assert.ok(success < finalize, `${file}: readiness must finalize after success evidence`);
  assert.ok(
    route.includes('hydrationSource: "parent_session_refresh"'),
    `${file}: Parent hydration source missing`,
  );
}

describe("Parent analysis readiness routing", () => {
  it("routes every eligible Parent full-session surface through P6 readiness", () => {
    assertParentHydrationOrder(
      "src/features/summary/SummaryScreen.tsx",
      "const refreshParentWeeklySessionSnapshot",
    );
    assertParentHydrationOrder(
      "app/(tabs)/this-week/index.tsx",
      "const loadCoachShareData",
    );
    assertParentHydrationOrder(
      "src/features/kid/KidDetailScreen.tsx",
      "const load = useCallback",
    );
    assertParentHydrationOrder(
      "app/(tabs)/this-week/parent-athletes.tsx",
      "async function verifyRemoteRosterAfterAthletePost",
    );
    assertParentHydrationOrder(
      "app/(tabs)/this-week/join.tsx",
      "const onConnect = useCallback",
    );
  });

  it("records failed full-session hydration without replacing cache fallback behavior", () => {
    for (const file of [
      "src/features/summary/SummaryScreen.tsx",
      "app/(tabs)/this-week/index.tsx",
      "src/features/kid/KidDetailScreen.tsx",
      "app/(tabs)/this-week/parent-athletes.tsx",
      "app/(tabs)/this-week/join.tsx",
    ]) {
      const text = source(file);
      assert.ok(text.includes("recordFailedLink"), `${file}: failure evidence missing`);
    }
    assert.ok(
      source("src/features/summary/SummaryScreen.tsx").includes(
        "network error, cache fallback",
      ),
    );
    assert.ok(
      source("app/(tabs)/this-week/index.tsx").includes(
        "nextWeeklyFromCache = true",
      ),
    );
  });

  it("suppresses terminal readiness commits for cancelled or superseded requests", () => {
    const summary = source("src/features/summary/SummaryScreen.tsx");
    const summaryCache = summary.indexOf(
      "await setCachedWeeklyForLinkToken(",
      summary.indexOf("const refreshParentWeeklySessionSnapshot"),
    );
    const summarySuccess = summary.indexOf(
      "readinessRun.recordSuccessfulSession",
      summaryCache,
    );
    assert.ok(
      summary.slice(summaryCache, summarySuccess).includes(
        "if (isCancelled?.()) return",
      ),
    );

    const kidDetail = source("src/features/kid/KidDetailScreen.tsx");
    const kidCache = kidDetail.indexOf(
      "await setCachedWeeklyForLinkToken(",
      kidDetail.indexOf("if (isThisWeekKidDetail)"),
    );
    const kidSuccess = kidDetail.indexOf(
      "readinessRun?.recordSuccessfulSession",
      kidCache,
    );
    assert.ok(
      kidDetail.slice(kidCache, kidSuccess).includes(
        "loadGen !== coachKidDetailLoadGenRef.current",
      ),
    );
  });

  it("keeps cache-only and forbidden workflows outside readiness routing", () => {
    for (const file of [
      "src/coachShare/coachLinkBinding.ts",
      "src/family/parentKidCompetitionDelete.ts",
      "src/identity/parentLocalAthleteCanonicalIntercept.ts",
      "app/(tabs)/this-week/manage.tsx",
    ]) {
      assert.equal(
        source(file).includes("startCoachAnalysisReadinessRun"),
        false,
        `${file}: forbidden workflow must not advance readiness`,
      );
    }
  });
});
