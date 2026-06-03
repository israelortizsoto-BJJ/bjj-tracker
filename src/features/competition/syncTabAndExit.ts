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
import { logSaveLifecycleTrace } from "./saveLifecycleTrace";

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
  /** Trace-only — canonical/shared competition id when known at call site. */
  sharedCompetitionId?: string | null;
  /** Trace-only — editor saving flag when known at call site. */
  saving?: boolean;
}): void {
  const { navigation, actorRole, athleteId, competitionId, sharedCompetitionId, saving } = args;
  const lifecycleCtx = {
    competitionId,
    sharedCompetitionId: sharedCompetitionId ?? null,
    ...(saving !== undefined ? { saving } : {}),
  };
  const logSyncStep = (
    point: "syncTabAndExit_step_before" | "syncTabAndExit_step_after",
    stepName: string,
    extra: Record<string, unknown> = {},
  ) => {
    logSaveLifecycleTrace(point, {
      ...lifecycleCtx,
      stepName,
      ...extra,
    });
  };
  const logLaneNormalizeBypass = (reason: string) => {
    logSaveLifecycleTrace("syncTabAndExit_lane_normalize_bypass", {
      ...lifecycleCtx,
      reason,
      laneRouteName,
      laneStackKey,
    });
  };
  logSaveLifecycleTrace("syncTabAndExit_enter", lifecycleCtx);
  logSyncStep("syncTabAndExit_step_before", "read_route_info_begin");
  const riBegin = store.getRouteInfo();
  logSyncStep("syncTabAndExit_step_after", "read_route_info_begin", {
    pathname: String(riBegin.pathname ?? ""),
  });
  console.log("[COMP_EXIT_BEGIN]", {
    ts: Date.now(),
    pathname: String(riBegin.pathname ?? ""),
    kidId: athleteId,
    actorRole,
    competitionId,
  });
  if (__DEV__) {
    logSyncStep("syncTabAndExit_step_before", "dev_read_route_info_for_replay");
    const ri = store.getRouteInfo();
    logSyncStep("syncTabAndExit_step_after", "dev_read_route_info_for_replay", {
      pathname: String(ri.pathname ?? ""),
    });
    logSyncStep("syncTabAndExit_step_before", "dev_log_authority_replay_begin");
    logAuthorityNavigationReplayDev("exit_to_compete_save_begin", {
      actorRole,
      athleteId,
      competitionId,
      pathname: String(ri.pathname ?? ""),
    });
    logSyncStep("syncTabAndExit_step_after", "dev_log_authority_replay_begin");
  }
  logSyncStep("syncTabAndExit_step_before", "log_comp_save_normalized");
  logCompSaveNormalized({
    actorRole,
    athleteId,
    destination: "/compete",
    competitionId,
  });
  logSyncStep("syncTabAndExit_step_after", "log_comp_save_normalized");

  logSyncStep("syncTabAndExit_step_before", "read_root_navigation_ref");
  const rootNav = store.navigationRef?.current;
  logSyncStep("syncTabAndExit_step_after", "read_root_navigation_ref", {
    hasRootNav: Boolean(rootNav),
  });
  logSyncStep("syncTabAndExit_step_before", "read_root_state");
  const rootState = rootNav?.getRootState() as NavigationState | undefined;
  logSyncStep("syncTabAndExit_step_after", "read_root_state", {
    rootStateType: rootState?.type ?? null,
    rootRouteCount: rootState?.routes?.length ?? 0,
  });

  logSyncStep("syncTabAndExit_step_before", "create_compete_nav_action");
  const navAction = CommonActions.navigate({
    name: "compete",
    merge: true,
  } as Parameters<typeof CommonActions.navigate>[0]);
  logSyncStep("syncTabAndExit_step_after", "create_compete_nav_action");

  logSyncStep("syncTabAndExit_step_before", "validate_tabs_navigation");
  const tabsNav = validatedTabsNavigation(navigation);
  logSyncStep("syncTabAndExit_step_after", "validate_tabs_navigation", {
    hasTabsNav: Boolean(tabsNav),
  });
  logSyncStep("syncTabAndExit_step_before", "find_tabs_fallback");
  const tabsFallback = !tabsNav ? findValidatedTabsStateInTree(rootState) : null;
  logSyncStep("syncTabAndExit_step_after", "find_tabs_fallback", {
    hasTabsFallback: Boolean(tabsFallback),
    tabsFallbackKey: tabsFallback?.key ?? null,
  });

  const targetTab = "compete";
  logSyncStep("syncTabAndExit_step_before", "read_current_route_info");
  const ri = store.getRouteInfo();
  logSyncStep("syncTabAndExit_step_after", "read_current_route_info", {
    pathname: String(ri.pathname ?? ""),
  });
  logSyncStep("syncTabAndExit_step_before", "derive_lane_route");
  const currentRoute = String(ri.pathname ?? "");
  const laneRouteName: "this-week" | "coach" = actorRole === "coach" ? "coach" : "this-week";
  logSyncStep("syncTabAndExit_step_after", "derive_lane_route", {
    laneRouteName,
    targetTab,
  });

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
    logSyncStep("syncTabAndExit_step_before", "fallback_read_tab_snapshot");
    const tabSnap = readTabNavigatorStateForExit(null, tabsFallback, rootNav);
    logSyncStep("syncTabAndExit_step_after", "fallback_read_tab_snapshot", {
      tabSnapType: tabSnap?.type ?? null,
    });
    logSyncStep("syncTabAndExit_step_before", "fallback_log_stack_reset");
    logStackReset(false, laneStackScreenNames(tabSnap, laneRouteName), []);
    logSyncStep("syncTabAndExit_step_after", "fallback_log_stack_reset");
    logSaveLifecycleTrace("syncTabAndExit_before_navigation", {
      ...lifecycleCtx,
      navOp: "router_replace_compete_fallback",
    });
    router.replace("/compete");
    logSaveLifecycleTrace("syncTabAndExit_after_navigation", {
      ...lifecycleCtx,
      navOp: "router_replace_compete_fallback",
    });
    scheduleNavStateAfterSaveLog({ role: actorRole, kidId: athleteId });
    return;
  }

  logSyncStep("syncTabAndExit_step_before", "read_tab_layer_state_before");
  const tabLayerStateBefore = readTabNavigatorStateForExit(tabsNav, tabsFallback, rootNav);
  logSyncStep("syncTabAndExit_step_after", "read_tab_layer_state_before", {
    tabLayerType: tabLayerStateBefore?.type ?? null,
    tabLayerRouteCount: tabLayerStateBefore?.routes?.length ?? 0,
  });
  logSyncStep("syncTabAndExit_step_before", "read_active_stack_before");
  const activeStackBefore = laneStackScreenNames(tabLayerStateBefore, laneRouteName);
  logSyncStep("syncTabAndExit_step_after", "read_active_stack_before", {
    activeStackBefore,
  });
  logSyncStep("syncTabAndExit_step_before", "read_lane_stack_before");
  const laneStackBefore = laneOuterStackForNormalization(tabLayerStateBefore, laneRouteName);
  logSyncStep("syncTabAndExit_step_after", "read_lane_stack_before", {
    laneStackKey: laneStackBefore?.key ?? null,
    laneRouteCount: laneStackBefore?.routes?.length ?? 0,
  });
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
    logSyncStep("syncTabAndExit_step_before", "focus_compete_log_begin");
    console.log("[COMP_NAVIGATE_COMPETE]", {
      ts: Date.now(),
      pathname: currentRoute,
      kidId: athleteId,
    });
    logSyncStep("syncTabAndExit_step_after", "focus_compete_log_begin");
    if (tabsNav) {
      logSaveLifecycleTrace("syncTabAndExit_before_navigation", {
        ...lifecycleCtx,
        navOp: "dispatch_focus_compete_tabs_nav",
      });
      tabsNav.dispatch(navAction);
      logSaveLifecycleTrace("syncTabAndExit_after_navigation", {
        ...lifecycleCtx,
        navOp: "dispatch_focus_compete_tabs_nav",
      });
      schedulePostDispatchTelemetry();
      return;
    }
    if (tabsFallback?.key && rootNav) {
      logSaveLifecycleTrace("syncTabAndExit_before_navigation", {
        ...lifecycleCtx,
        navOp: "dispatch_focus_compete_root_nav",
      });
      rootNav.dispatch({
        ...navAction,
        target: tabsFallback.key,
      });
      logSaveLifecycleTrace("syncTabAndExit_after_navigation", {
        ...lifecycleCtx,
        navOp: "dispatch_focus_compete_root_nav",
      });
      schedulePostDispatchTelemetry();
    }
  };

  const normalizeLaneToRoot = (nav: TabSyncScreenNavigation): boolean => {
    logSyncStep("syncTabAndExit_step_before", "normalize_check_lane_stack_key", {
      laneRouteName,
    });
    if (!laneStackBefore?.key) {
      logSyncStep("syncTabAndExit_step_after", "normalize_check_lane_stack_key", {
        hasLaneStackKey: false,
      });
      logSyncStep("syncTabAndExit_step_before", "normalize_serialize_root_state_missing_lane");
      console.log("[COMP_ROOT_STATE_SNAPSHOT]", {
        tree: serializeNavigationStateTree(
          rootNav?.getRootState() as NavigationState | undefined,
        ),
      });
      logSyncStep("syncTabAndExit_step_after", "normalize_serialize_root_state_missing_lane");
      logSyncStep("syncTabAndExit_step_before", "normalize_warn_lane_stack_not_found");
      console.warn("[COMP_LANE_NORMALIZE_FAIL]", {
        ts: Date.now(),
        pathname: currentRoute,
        kidId: athleteId,
        actorRole,
        laneRouteName,
        reason: "lane_stack_not_found",
      });
      logSyncStep("syncTabAndExit_step_after", "normalize_warn_lane_stack_not_found");
      return false;
    }
    logSyncStep("syncTabAndExit_step_after", "normalize_check_lane_stack_key", {
      hasLaneStackKey: true,
      laneStackKey: laneStackBefore.key,
    });
    logSyncStep("syncTabAndExit_step_before", "normalize_check_already_root");
    if (isLaneNormalizedToRoot(laneStackBefore)) {
      logSyncStep("syncTabAndExit_step_after", "normalize_check_already_root", {
        alreadyRoot: true,
      });
      logSyncStep("syncTabAndExit_step_before", "normalize_log_already_clean");
      console.log("[COMP_LANE_ALREADY_CLEAN]", {
        ts: Date.now(),
        pathname: currentRoute,
        kidId: athleteId,
        actorRole,
        laneRouteName,
        laneStackKey: laneStackBefore.key,
      });
      logSyncStep("syncTabAndExit_step_after", "normalize_log_already_clean");
      return true;
    }
    logSyncStep("syncTabAndExit_step_after", "normalize_check_already_root", {
      alreadyRoot: false,
    });
    logSyncStep("syncTabAndExit_step_before", "normalize_log_begin");
    console.log("[COMP_LANE_NORMALIZE_BEGIN]", {
      ts: Date.now(),
      pathname: currentRoute,
      kidId: athleteId,
      actorRole,
      laneRouteName,
      laneStackKey: laneStackBefore.key,
      activeStackBefore,
    });
    logSyncStep("syncTabAndExit_step_after", "normalize_log_begin");
    logSaveLifecycleTrace("syncTabAndExit_before_navigation", {
      ...lifecycleCtx,
      navOp: "dispatch_lane_stack_reset",
    });
    nav.dispatch({
      ...CommonActions.reset({
        index: 0,
        routes: [{ name: "index" }],
      }),
      target: laneStackBefore.key,
    });
    logSaveLifecycleTrace("syncTabAndExit_after_navigation", {
      ...lifecycleCtx,
      navOp: "dispatch_lane_stack_reset",
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
    logSyncStep("syncTabAndExit_step_before", "call_normalize_lane_tabs_nav");
    if (!normalizeLaneToRoot(tabsNav)) {
      logSyncStep("syncTabAndExit_step_after", "call_normalize_lane_tabs_nav", {
        normalized: false,
      });
      if (laneStackKey) return;
      logLaneNormalizeBypass("missing_lane_stack");
    } else {
      logSyncStep("syncTabAndExit_step_after", "call_normalize_lane_tabs_nav", {
        normalized: true,
      });
    }
    logSyncStep("syncTabAndExit_step_before", "call_focus_compete_tabs_nav");
    focusCompete();
    logSyncStep("syncTabAndExit_step_after", "call_focus_compete_tabs_nav");
  } else if (tabsFallback?.key && rootNav) {
    logSyncStep("syncTabAndExit_step_before", "call_normalize_lane_root_nav");
    if (!normalizeLaneToRoot(rootNav as TabSyncScreenNavigation)) {
      logSyncStep("syncTabAndExit_step_after", "call_normalize_lane_root_nav", {
        normalized: false,
      });
      if (laneStackKey) return;
      logLaneNormalizeBypass("missing_lane_stack");
    } else {
      logSyncStep("syncTabAndExit_step_after", "call_normalize_lane_root_nav", {
        normalized: true,
      });
    }
    logSyncStep("syncTabAndExit_step_before", "call_focus_compete_root_nav");
    focusCompete();
    logSyncStep("syncTabAndExit_step_after", "call_focus_compete_root_nav");
  } else {
    logSyncStep("syncTabAndExit_step_before", "no_tabs_log_stack_reset");
    logStackReset(false, activeStackBefore, laneStackScreenNames(tabLayerStateBefore, laneRouteName));
    logSyncStep("syncTabAndExit_step_after", "no_tabs_log_stack_reset");
    logSaveLifecycleTrace("syncTabAndExit_before_navigation", {
      ...lifecycleCtx,
      navOp: "router_replace_compete_no_tabs",
    });
    router.replace("/compete");
    logSaveLifecycleTrace("syncTabAndExit_after_navigation", {
      ...lifecycleCtx,
      navOp: "router_replace_compete_no_tabs",
    });
    scheduleNavStateAfterSaveLog({ role: actorRole, kidId: athleteId });
    return;
  }

  logSaveLifecycleTrace("syncTabAndExit_after_navigation", {
    ...lifecycleCtx,
    navOp: "exit_function_complete",
  });
}
