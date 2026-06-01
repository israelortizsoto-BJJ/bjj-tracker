import {
  CommonActions,
  type NavigationProp,
  type NavigationState,
  type ParamListBase,
} from "@react-navigation/native";
import { router } from "expo-router";

import { store } from "expo-router/build/global-state/router-store";

import {
  logCompeteExitStackReset,
  logCompExitStackReset,
  logCompSaveNormalized,
  readFocusedTabFromRootState,
  scheduleNavStateAfterSaveLog,
} from "./compSaveExitTelemetry";
import { logAuthorityNavigationReplayDev } from "../../identity/authorityTelemetry";

/**
 * Minimal navigation surface for tab parent walk + dispatch (compatible with Expo Router's typed `useNavigation()`).
 */
type TabSyncScreenNavigation = {
  getState(): Readonly<NavigationState> | undefined;
  getParent(): TabSyncScreenNavigation | undefined;
  dispatch: NavigationProp<ParamListBase>["dispatch"];
  canGoBack?: () => boolean;
};

function validatedTabsNavigation(
  navigation: TabSyncScreenNavigation,
): TabSyncScreenNavigation | null {
  let current: TabSyncScreenNavigation | undefined = navigation;
  let hops = 0;
  while (current && hops < 12) {
    hops += 1;
    const state = current.getState?.() as NavigationState | undefined;
    const type = state?.type;
    if ((type === "tab" || type === "expo-tab") && state?.routes?.length) {
      const names = state.routes.map((r) => r.name);
      if (names.includes("this-week") && names.includes("coach")) {
        return current;
      }
    }
    current = current.getParent?.() as TabSyncScreenNavigation | undefined;
  }
  return null;
}

function findValidatedTabsStateInTree(
  state: NavigationState | undefined,
): NavigationState | null {
  if (!state?.routes?.length) return null;
  const t = state.type;
  if ((t === "tab" || t === "expo-tab") && state.routes.length) {
    const names = state.routes.map((r) => r.name);
    if (names.includes("this-week") && names.includes("coach")) {
      return state;
    }
  }
  for (const r of state.routes) {
    const inner = r.state as NavigationState | undefined;
    const found = findValidatedTabsStateInTree(inner);
    if (found) return found;
  }
  return null;
}

function serializeNavigationStateTree(state: NavigationState | undefined): string[] {
  const lines: string[] = [];

  const visit = (current: NavigationState | undefined, indent: string) => {
    if (!current) {
      lines.push(`${indent}<no state>`);
      return;
    }

    lines.push(
      `${indent}${current.type ?? "<unknown navigator>"} key=${current.key ?? "<no key>"} index=${String(current.index ?? "<no index>")}`,
    );
    current.routes.forEach((route, routeIndex) => {
      const active = routeIndex === current.index ? "*" : "-";
      lines.push(`${indent}  ${active} ${route.name} key=${route.key}`);
      if (route.state) {
        visit(route.state as NavigationState, `${indent}    `);
      }
    });
  };

  visit(state, "");
  return lines;
}

/**
 * Stack owned by the originating lane (e.g. `this-week/_layout` Stack).
 * Competition exit normalizes this stack before focusing Compete so a retained tab cannot
 * restore `competition/edit`.
 */
function laneOuterStackForNormalization(
  tabNavigatorState: NavigationState | undefined,
  laneRouteName: "this-week" | "coach",
): NavigationState | null {
  if (!tabNavigatorState?.routes?.length) return null;
  const laneRoute = tabNavigatorState.routes.find((r) => r.name === laneRouteName);
  const laneState = laneRoute?.state as NavigationState | undefined;
  if (!laneState?.key) return null;
  if (!laneState.routes?.length) return null;
  if (laneState.type !== "stack") return null;
  return laneState;
}

function isLaneNormalizedToRoot(laneState: NavigationState | null): boolean {
  return (
    laneState?.type === "stack" &&
    laneState.index === 0 &&
    laneState.routes.length === 1 &&
    laneState.routes[0]?.name === "index"
  );
}

function laneStackScreenNames(
  tabNavigatorState: NavigationState | undefined,
  laneRouteName: "this-week" | "coach",
): string[] {
  const out: string[] = [];
  if (!tabNavigatorState?.routes?.length) return out;
  const laneRoute = tabNavigatorState.routes.find((r) => r.name === laneRouteName);
  let state = laneRoute?.state as NavigationState | undefined;
  while (state?.routes?.length) {
    const idx = typeof state.index === "number" ? state.index : state.routes.length - 1;
    const route = state.routes[idx];
    if (!route) break;
    if (state.type === "stack" && route.name) {
      out.push(route.name);
    }
    state = route.state as NavigationState | undefined;
  }
  return out;
}

function readTabNavigatorStateForExit(
  tabsNav: TabSyncScreenNavigation | null,
  tabsFallback: NavigationState | null,
  rootNav?: { getRootState(): Readonly<NavigationState> | undefined } | null,
): NavigationState | undefined {
  if (tabsNav) {
    return tabsNav.getState?.() as NavigationState | undefined;
  }
  const freshRoot = rootNav?.getRootState?.() as NavigationState | undefined;
  return findValidatedTabsStateInTree(freshRoot) ?? tabsFallback ?? undefined;
}

/**
 * After save, cancel-style back, delete, or load errors: land on the Competition tab and
 * normalize the parent/coach lane stack to root so `competition/edit` does not survive as the
 * active route when the user returns to that tab. Athlete scope is unchanged.
 */
export function exitToCompeteAfterCompetitionSave(args: {
  navigation: TabSyncScreenNavigation;
  actorRole: "parent" | "coach";
  /** Local kid id / route scope for the editor (not mutating global athlete selection). */
  athleteId: string;
  competitionId: string | null;
}): void {
  const { navigation, actorRole, athleteId, competitionId } = args;
  const riBegin = store.getRouteInfo();
  console.log("[COMP_EXIT_BEGIN]", {
    ts: Date.now(),
    pathname: String(riBegin.pathname ?? ""),
    kidId: athleteId,
    actorRole,
    competitionId,
  });
  if (__DEV__) {
    const ri = store.getRouteInfo();
    logAuthorityNavigationReplayDev("exit_to_compete_save_begin", {
      actorRole,
      athleteId,
      competitionId,
      pathname: String(ri.pathname ?? ""),
    });
  }
  logCompSaveNormalized({
    actorRole,
    athleteId,
    destination: "/compete",
    competitionId,
  });

  const rootNav = store.navigationRef?.current;
  const rootState = rootNav?.getRootState() as NavigationState | undefined;

  const navAction = CommonActions.navigate({
    name: "compete",
    merge: true,
  } as Parameters<typeof CommonActions.navigate>[0]);

  const tabsNav = validatedTabsNavigation(navigation);
  const tabsFallback = !tabsNav ? findValidatedTabsStateInTree(rootState) : null;

  const targetTab = "compete";
  const ri = store.getRouteInfo();
  const currentRoute = String(ri.pathname ?? "");
  const laneRouteName: "this-week" | "coach" = actorRole === "coach" ? "coach" : "this-week";

  const logStackReset = (resetApplied: boolean, before: string[], after: string[]) => {
    logCompExitStackReset({
      actorRole,
      currentRoute,
      targetTab,
      resetApplied,
      activeStackBefore: before,
      activeStackAfter: after,
    });
  };

  if (!rootNav || (!tabsNav && !tabsFallback?.key)) {
    const tabSnap = readTabNavigatorStateForExit(null, tabsFallback, rootNav);
    logStackReset(false, laneStackScreenNames(tabSnap, laneRouteName), []);
    router.replace("/compete");
    scheduleNavStateAfterSaveLog({ role: actorRole, kidId: athleteId });
    return;
  }

  const tabLayerStateBefore = readTabNavigatorStateForExit(tabsNav, tabsFallback, rootNav);
  const activeStackBefore = laneStackScreenNames(tabLayerStateBefore, laneRouteName);
  const laneStackBefore = laneOuterStackForNormalization(tabLayerStateBefore, laneRouteName);
  const laneStackKey = laneStackBefore?.key ?? null;

  const schedulePostDispatchTelemetry = () => {
    queueMicrotask(() => {
      const tabLayerAfter = readTabNavigatorStateForExit(tabsNav, tabsFallback, rootNav);
      const activeStackAfter = laneStackScreenNames(tabLayerAfter, laneRouteName);
      const rootAfter = rootNav?.getRootState() as NavigationState | undefined;
      const focusedTabAfterSave = readFocusedTabFromRootState(rootAfter);
      const laneStackAfter = laneOuterStackForNormalization(tabLayerAfter, laneRouteName);
      const laneNormalized = isLaneNormalizedToRoot(laneStackAfter);

      if (!laneNormalized) {
        console.warn("[COMP_LANE_NORMALIZE_FAIL]", {
          ts: Date.now(),
          pathname: currentRoute,
          kidId: athleteId,
          actorRole,
          laneRouteName,
          reason: "postcondition_not_met",
          activeStackAfter,
        });
      }

      if (__DEV__) {
        logAuthorityNavigationReplayDev("exit_to_compete_save_post_dispatch", {
          actorRole,
          athleteId,
          focusedTabAfterSave,
          activeStackAfter,
          laneStackKey: laneStackKey ?? null,
        });
      }

      logCompeteExitStackReset({
        stackNavigatorKey: laneStackKey,
        routeCountBefore: laneStackBefore?.routes.length ?? 0,
        routeCountAfter: laneStackAfter?.routes.length ?? 0,
        focusedTabAfterSave,
      });

      logStackReset(laneNormalized, activeStackBefore, activeStackAfter);
      scheduleNavStateAfterSaveLog({ role: actorRole, kidId: athleteId });
    });
  };

  const focusCompete = () => {
    console.log("[COMP_NAVIGATE_COMPETE]", {
      ts: Date.now(),
      pathname: currentRoute,
      kidId: athleteId,
    });
    if (tabsNav) {
      tabsNav.dispatch(navAction);
      schedulePostDispatchTelemetry();
      return;
    }
    if (tabsFallback?.key && rootNav) {
      rootNav.dispatch({
        ...navAction,
        target: tabsFallback.key,
      });
      schedulePostDispatchTelemetry();
    }
  };

  const normalizeLaneToRoot = (nav: TabSyncScreenNavigation): boolean => {
    if (!laneStackBefore?.key) {
      console.log("[COMP_ROOT_STATE_SNAPSHOT]", {
        tree: serializeNavigationStateTree(
          rootNav?.getRootState() as NavigationState | undefined,
        ),
      });
      console.warn("[COMP_LANE_NORMALIZE_FAIL]", {
        ts: Date.now(),
        pathname: currentRoute,
        kidId: athleteId,
        actorRole,
        laneRouteName,
        reason: "lane_stack_not_found",
      });
      return false;
    }
    if (isLaneNormalizedToRoot(laneStackBefore)) {
      console.log("[COMP_LANE_ALREADY_CLEAN]", {
        ts: Date.now(),
        pathname: currentRoute,
        kidId: athleteId,
        actorRole,
        laneRouteName,
        laneStackKey: laneStackBefore.key,
      });
      return true;
    }
    console.log("[COMP_LANE_NORMALIZE_BEGIN]", {
      ts: Date.now(),
      pathname: currentRoute,
      kidId: athleteId,
      actorRole,
      laneRouteName,
      laneStackKey: laneStackBefore.key,
      activeStackBefore,
    });
    nav.dispatch({
      ...CommonActions.reset({
        index: 0,
        routes: [{ name: "index" }],
      }),
      target: laneStackBefore.key,
    });
    const tabLayerStateAfterReset = readTabNavigatorStateForExit(tabsNav, tabsFallback, rootNav);
    const laneStackAfterReset = laneOuterStackForNormalization(
      tabLayerStateAfterReset,
      laneRouteName,
    );
    if (!isLaneNormalizedToRoot(laneStackAfterReset)) {
      console.log("[COMP_LANE_VERIFY_RETRY]", {
        ts: Date.now(),
        pathname: currentRoute,
        kidId: athleteId,
        actorRole,
        laneRouteName,
        activeStackAfter: laneStackScreenNames(tabLayerStateAfterReset, laneRouteName),
      });
      queueMicrotask(() => {
        const tabLayerStateAfterRetry = readTabNavigatorStateForExit(tabsNav, tabsFallback, rootNav);
        const laneStackAfterRetry = laneOuterStackForNormalization(
          tabLayerStateAfterRetry,
          laneRouteName,
        );
        if (!laneStackAfterRetry || !isLaneNormalizedToRoot(laneStackAfterRetry)) {
          console.warn("[COMP_LANE_VERIFY_ABORT]", {
            ts: Date.now(),
            pathname: currentRoute,
            kidId: athleteId,
            actorRole,
            laneRouteName,
            reason: "bounded_postcondition_not_met",
            activeStackAfter: laneStackScreenNames(tabLayerStateAfterRetry, laneRouteName),
          });
          return;
        }
        console.log("[COMP_LANE_VERIFY_RECOVERED]", {
          ts: Date.now(),
          pathname: currentRoute,
          kidId: athleteId,
          actorRole,
          laneRouteName,
          laneStackKey: laneStackAfterRetry.key,
        });
        focusCompete();
      });
      return false;
    }
    console.log("[COMP_LANE_NORMALIZE_SUCCESS]", {
      ts: Date.now(),
      pathname: currentRoute,
      kidId: athleteId,
      actorRole,
      laneRouteName,
      laneStackKey: laneStackBefore.key,
      expectedStackAfter: ["index"],
    });
    return true;
  };

  if (tabsNav) {
    if (!normalizeLaneToRoot(tabsNav)) return;
    focusCompete();
  } else if (tabsFallback?.key && rootNav) {
    if (!normalizeLaneToRoot(rootNav as TabSyncScreenNavigation)) return;
    focusCompete();
  } else {
    logStackReset(false, activeStackBefore, laneStackScreenNames(tabLayerStateBefore, laneRouteName));
    router.replace("/compete");
    scheduleNavStateAfterSaveLog({ role: actorRole, kidId: athleteId });
    return;
  }

}
