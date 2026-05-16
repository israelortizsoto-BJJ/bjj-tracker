import {
  CommonActions,
  StackActions,
  type NavigationProp,
  type NavigationState,
  type ParamListBase,
} from "@react-navigation/native";
import { router } from "expo-router";

import { store } from "expo-router/build/global-state/router-store";

import { InteractionManager } from "react-native";

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

/**
 * Key of the lane root stack (e.g. `this-week/_layout` Stack) so we can `popToTop` after save.
 * Without this, switching to Compete leaves competition/edit on the lane stack; returning to
 * the tab replays that screen briefly.
 */
function laneOuterStackKeyForPopToTop(
  tabNavigatorState: NavigationState | undefined,
  laneRouteName: "this-week" | "coach",
): string | null {
  if (!tabNavigatorState?.routes?.length) return null;
  const laneRoute = tabNavigatorState.routes.find((r) => r.name === laneRouteName);
  const laneState = laneRoute?.state as NavigationState | undefined;
  if (!laneState?.key) return null;
  if (!laneState.routes?.length || laneState.routes.length <= 1) return null;
  if (laneState.type !== "stack") return null;
  return laneState.key;
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
 * pop the parent/coach lane stack to root so `competition/edit` does not survive as the
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
  const laneStackKey = laneOuterStackKeyForPopToTop(tabLayerStateBefore, laneRouteName);

  const popLaneToRoot = (nav: TabSyncScreenNavigation, key: string | null) => {
    if (!key) return;
    InteractionManager.runAfterInteractions(() => {
      nav.dispatch({ ...StackActions.popToTop(), target: key });
    });
  };

  if (tabsNav) {
    tabsNav.dispatch(navAction);
    popLaneToRoot(tabsNav, laneStackKey);
  } else if (tabsFallback?.key && rootNav) {
    rootNav.dispatch({
      ...navAction,
      target: tabsFallback.key,
    });
    popLaneToRoot(rootNav as TabSyncScreenNavigation, laneStackKey);
  } else {
    logStackReset(false, activeStackBefore, laneStackScreenNames(tabLayerStateBefore, laneRouteName));
    router.replace("/compete");
    scheduleNavStateAfterSaveLog({ role: actorRole, kidId: athleteId });
    return;
  }

  queueMicrotask(() => {
    const tabLayerAfter = readTabNavigatorStateForExit(tabsNav, tabsFallback, rootNav);
    const activeStackAfter = laneStackScreenNames(tabLayerAfter, laneRouteName);
    const rootAfter = rootNav?.getRootState() as NavigationState | undefined;
    const focusedTabAfterSave = readFocusedTabFromRootState(rootAfter);

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
      routeCountBefore: 0,
      routeCountAfter: 0,
      focusedTabAfterSave,
    });

    logStackReset(Boolean(laneStackKey), activeStackBefore, activeStackAfter);
    scheduleNavStateAfterSaveLog({ role: actorRole, kidId: athleteId });
  });
}
