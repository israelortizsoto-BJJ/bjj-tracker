import {
  CommonActions,
  StackActions,
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
 * Root stack navigator for the operational lane tab (`this-week` or `coach`):
 * walk from the screen up until the parent is the tab navigator; the owning stack
 * is either that direct child (if it is a stack) or the deepest stack seen below it.
 */
function laneRootStackNavigatorFromScreen(
  screenNav: TabSyncScreenNavigation,
  tabsNav: TabSyncScreenNavigation,
): TabSyncScreenNavigation | null {
  let lastStackOnPath: TabSyncScreenNavigation | undefined;
  let cur: TabSyncScreenNavigation | undefined = screenNav;
  for (let h = 0; h < 24 && cur; h += 1) {
    const state = cur.getState?.() as NavigationState | undefined;
    if (state?.type === "stack") {
      lastStackOnPath = cur;
    }
    const parent = cur.getParent?.() as TabSyncScreenNavigation | undefined;
    if (parent === tabsNav) {
      if (state?.type === "stack") {
        return cur;
      }
      return lastStackOnPath ?? null;
    }
    cur = parent;
  }
  return null;
}

/**
 * After save, cancel-style back, delete, or load errors: always land on the Competition tab.
 * Athlete scope stays in existing global/store state; this only switches the focused tab.
 */
export function exitToCompeteAfterCompetitionSave(args: {
  navigation: TabSyncScreenNavigation;
  actorRole: "parent" | "coach";
  /** Local kid id / route scope for the editor (not mutating global athlete selection). */
  athleteId: string;
  competitionId: string | null;
}): void {
  const { navigation, actorRole, athleteId, competitionId } = args;
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

  const laneStackNav =
    tabsNav != null ? laneRootStackNavigatorFromScreen(navigation, tabsNav) : null;
  const laneStateBefore = laneStackNav?.getState?.() as NavigationState | undefined;
  const stackNavigatorKey = laneStateBefore?.key ?? null;
  const routeCountBefore = laneStateBefore?.routes?.length ?? 0;
  const shouldPopLaneStack =
    routeCountBefore > 1 ||
    (typeof laneStackNav?.canGoBack === "function" && laneStackNav.canGoBack());

  let popToTopOk = false;
  if (laneStackNav && shouldPopLaneStack) {
    try {
      laneStackNav.dispatch(StackActions.popToTop());
      popToTopOk = true;
    } catch {
      popToTopOk = false;
    }
  }

  if (tabsNav) {
    tabsNav.dispatch(navAction);
  } else if (tabsFallback?.key && rootNav) {
    rootNav.dispatch({
      ...navAction,
      target: tabsFallback.key,
    });
  } else {
    logStackReset(false, activeStackBefore, laneStackScreenNames(tabLayerStateBefore, laneRouteName));
    router.replace("/compete");
    scheduleNavStateAfterSaveLog({ role: actorRole, kidId: athleteId });
    return;
  }

  queueMicrotask(() => {
    const tabLayerAfter = readTabNavigatorStateForExit(tabsNav, tabsFallback, rootNav);
    const activeStackAfter = laneStackScreenNames(tabLayerAfter, laneRouteName);
    const laneStateAfter = laneStackNav?.getState?.() as NavigationState | undefined;
    const routeCountAfter = laneStateAfter?.routes?.length ?? 0;
    const rootAfter = rootNav?.getRootState() as NavigationState | undefined;
    const focusedTabAfterSave = readFocusedTabFromRootState(rootAfter);

    logCompeteExitStackReset({
      stackNavigatorKey,
      routeCountBefore,
      routeCountAfter,
      focusedTabAfterSave,
    });

    const resetApplied =
      popToTopOk &&
      (routeCountAfter < routeCountBefore ||
        activeStackBefore.length === 0 ||
        activeStackAfter.length < activeStackBefore.length);
    logStackReset(resetApplied, activeStackBefore, activeStackAfter);
    scheduleNavStateAfterSaveLog({ role: actorRole, kidId: athleteId });
  });
}
