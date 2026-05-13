import type { Href } from "expo-router";
import type { NavigationState } from "@react-navigation/native";

// Post-save reads must not rely on the competition screen's hooks (it unmounts on replace).
import { store } from "expo-router/build/global-state/router-store";

/** Lane for save-exit sync (tab names from `app/(tabs)/_layout.tsx` plus compete). */
export type CompSaveExitLane = "this-week" | "coach" | "compete";

/** Post-save / exit contract: Competition tab owns the lifecycle (QA). */
export function logCompSaveNormalized(payload: {
  actorRole: "parent" | "coach";
  athleteId: string;
  destination: "/compete";
  competitionId: string | null;
}): void {
  console.log("[COMP_SAVE_NORMALIZED]", {
    actorRole: payload.actorRole,
    athleteId: payload.athleteId,
    destination: payload.destination,
    competitionId: payload.competitionId,
  });
}

export function hrefForCompSaveLog(href: Href | null | undefined): string | null {
  if (href == null) return null;
  if (typeof href === "string") return href;
  try {
    return JSON.stringify(href);
  } catch {
    return String(href);
  }
}

export function logCompSaveExit(payload: {
  actorRole: "parent" | "coach";
  pathname: string;
  exitHref: string | null;
  finalReplaceTarget: string;
  segments: readonly string[];
}): void {
  console.log("[COMP_SAVE_EXIT]", {
    actorRole: payload.actorRole,
    pathname: payload.pathname,
    exitHref: payload.exitHref,
    finalReplaceTarget: payload.finalReplaceTarget,
    segments: [...payload.segments],
  });
}

export function logCompSaveRouteState(payload: {
  pathname: string;
  segments: readonly string[];
  canGoBack: boolean;
  role: "parent" | "coach";
  kidId: string;
}): void {
  console.log("[COMP_SAVE_ROUTE_STATE]", {
    pathname: payload.pathname,
    segments: [...payload.segments],
    canGoBack: payload.canGoBack,
    role: payload.role,
    kidId: payload.kidId,
  });
}

export function logTabSyncExit(payload: {
  lane: CompSaveExitLane;
  exitHref: string | null;
  focusedTabBefore: string | null;
  focusedTabAfter: string | null;
  pathname: string;
  segments: readonly string[];
  mode: "common_actions_navigate" | "router_replace_fallback";
}): void {
  console.log("[TAB_SYNC_EXIT]", {
    lane: payload.lane,
    exitHref: payload.exitHref,
    focusedTabBefore: payload.focusedTabBefore,
    focusedTabAfter: payload.focusedTabAfter,
    pathname: payload.pathname,
    segments: [...payload.segments],
    mode: payload.mode,
  });
}

export function readFocusedTabFromRootState(root: NavigationState | undefined): string | null {
  if (!root) return null;
  if ((root.type === "tab" || root.type === "expo-tab") && typeof root.index === "number") {
    return root.routes[root.index]?.name ?? null;
  }
  if (!root.routes?.length) return null;
  const idx = typeof root.index === "number" ? root.index : 0;
  const child = root.routes[idx]?.state as NavigationState | undefined;
  return readFocusedTabFromRootState(child);
}

/** Deepest navigator along the focused branch — `routes.length` (stack depth signal). */
function historyLengthFromRootState(root: NavigationState | undefined): number {
  if (!root?.routes?.length) return 0;
  const idx = typeof root.index === "number" ? root.index : 0;
  const child = root.routes[idx]?.state as NavigationState | undefined;
  if (child) return historyLengthFromRootState(child);
  return root.routes.length;
}

/** Focused-branch stack screen names (outer → inner), for post-save QA. */
function activeStackRouteNamesFromRoot(root: NavigationState | undefined): string[] {
  const out: string[] = [];
  let state = root;
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

/** Final QA line: lane stack reset + Compete focus (post-save). */
export function logCompeteExitStackReset(payload: {
  stackNavigatorKey: string | null;
  routeCountBefore: number;
  routeCountAfter: number;
  focusedTabAfterSave: string | null;
}): void {
  console.log("[COMPETE_EXIT_STACK_RESET]", {
    stackNavigatorKey: payload.stackNavigatorKey,
    routeCountBefore: payload.routeCountBefore,
    routeCountAfter: payload.routeCountAfter,
    focusedTabAfterSave: payload.focusedTabAfterSave,
  });
}

/** After competition save exit: lane stack (this-week vs coach) was popped before focusing Compete. */
export function logCompExitStackReset(payload: {
  actorRole: "parent" | "coach";
  currentRoute: string;
  targetTab: string;
  resetApplied: boolean;
  activeStackBefore: string[];
  activeStackAfter: string[];
}): void {
  console.log("[COMP_EXIT_STACK_RESET]", {
    actorRole: payload.actorRole,
    currentRoute: payload.currentRoute,
    targetTab: payload.targetTab,
    resetApplied: payload.resetApplied,
    activeStackBefore: [...payload.activeStackBefore],
    activeStackAfter: [...payload.activeStackAfter],
  });
}

/**
 * Post-`router.replace` navigator snapshot. Delayed samples read Expo Router global route
 * info (still updates after the edit screen unmounts) plus root navigation state.
 */
export function scheduleNavStateAfterSaveLog(args: {
  role: "parent" | "coach";
  kidId: string;
}): void {
  const { role, kidId } = args;
  const sample = (delayMs: number) => {
    setTimeout(() => {
      try {
        const ri = store.getRouteInfo();
        const root = store.navigationRef?.current?.getRootState() as
          | NavigationState
          | undefined;
        const canGoBack =
          typeof store.navigationRef?.current?.canGoBack === "function"
            ? store.navigationRef.current.canGoBack()
            : false;
        console.log("[NAV_STATE_AFTER_SAVE]", {
          pathname: String(ri.pathname ?? ""),
          segments: [...(ri.segments ?? [])],
          focusedTab: readFocusedTabFromRootState(root),
          activeStack: activeStackRouteNamesFromRoot(root),
          canGoBack,
          historyLength: historyLengthFromRootState(root),
          role,
          kidId,
        });
      } catch (e) {
        console.warn("[NAV_STATE_AFTER_SAVE_FAILED]", e);
      }
    }, delayMs);
  };
  sample(0);
  sample(120);
}
