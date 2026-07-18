import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(pathFromRepoRoot: string): string {
  return readFileSync(new URL(`../../../../${pathFromRepoRoot}`, import.meta.url), "utf8");
}

/**
 * UX-003 source-level regression: Coach Dashboard Pull-to-Refresh must reuse
 * the existing useCoachInsights load corridor (writer reconcile → insight
 * projection), matching the certified Kids roster / Compete PTR lifecycle
 * (dedicated refreshing flag + shared load; no parallel sync path).
 */
describe("Coach Dashboard Pull-to-Refresh wiring (source)", () => {
  const hook = source("src/features/coach/useCoachInsights.ts");
  const screen = source("src/features/coach/CoachDashboardScreen.tsx");

  it("exposes a dedicated refreshing flag and onRefresh that share loadInsights", () => {
    assert.match(hook, /const \[refreshing, setRefreshing\] = useState\(false\)/);
    assert.match(hook, /const loadInsights = useCallback/);
    assert.match(hook, /const onRefresh = useCallback/);
    assert.match(hook, /setRefreshing\(true\)/);
    assert.match(hook, /await loadInsights\(\)/);
    assert.match(hook, /setRefreshing\(false\)/);
    assert.match(
      hook,
      /return \{ loading, refreshing, insights, teamFocus, onRefresh \}/,
    );
  });

  it("focus and PTR share the same loadInsights corridor (no parallel refresh path)", () => {
    assert.match(hook, /void loadInsights\(\{ isCancelled: \(\) => cancelled \}\)/);
    assert.match(hook, /await refreshCoachWriterSessionsAndReconcileStores\(\)/);
    const loadInsightsIdx = hook.indexOf("const loadInsights = useCallback");
    const refreshStoresIdx = hook.indexOf(
      "await refreshCoachWriterSessionsAndReconcileStores()",
    );
    const onRefreshIdx = hook.indexOf("const onRefresh = useCallback");
    assert.ok(loadInsightsIdx > 0, "loadInsights present");
    assert.ok(
      refreshStoresIdx > loadInsightsIdx && refreshStoresIdx < onRefreshIdx,
      "writer reconcile must live inside loadInsights, not a second PTR-only path",
    );
    assert.equal(
      hook.split("refreshCoachWriterSessionsAndReconcileStores()").length - 1,
      1,
      "exactly one reconcile call site in the hook",
    );
  });

  it("wires RefreshControl on the dashboard ScrollView to hook refreshing/onRefresh", () => {
    assert.match(screen, /RefreshControl/);
    assert.match(
      screen,
      /const \{ loading, refreshing, insights, teamFocus, onRefresh \} = useCoachInsights\(\)/,
    );
    assert.match(screen, /refreshing=\{refreshing\}/);
    assert.match(screen, /onRefresh=\{onRefresh\}/);
    assert.doesNotMatch(screen, /refreshActiveAthleteAuthority/);
  });
});
