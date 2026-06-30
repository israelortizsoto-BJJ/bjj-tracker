import { useFocusEffect } from "@react-navigation/native";
import { useRouter, useSegments } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import SummaryAthleteSwitcher from "../../components/summary/SummaryAthleteSwitcher";
import SummaryCompetitionCard from "../../components/summary/SummaryCompetitionCard";
import SummaryConsistencyCard from "../../components/summary/SummaryConsistencyCard";
import SummaryHeroCard from "../../components/summary/SummaryHeroCard";
import SummaryPatternsCard from "../../components/summary/SummaryPatternsCard";
import SummaryWeekCard from "../../components/summary/SummaryWeekCard";
import OperatingHeader from "../../components/operating/OperatingHeader";
import {
  deriveCompetitionTrainingSkillFocus,
  principalTrainingSkillBucketFromDerivedFocus,
} from "../../ai-coach/competitionTrainingSkillFocus";
import { labelForSubmissionTypeKey } from "@/src/features/competition/submissionTypes";
import type { KidCompetitionEntryWithMatchDetail } from "@/src/storage/competitionStore";
import {
  formatAthleteBeltRankLabel,
  formatAthleteExperienceLevelLabel,
} from "@/src/lib/athlete/athleteBeltExperience";
import { computeIdentityScore } from "@/src/lib/identity/computeIdentityScore";
import {
  aggregateCoachSignals,
  deriveCoachSignals,
} from "@/src/lib/identity/deriveCoachSignals";
import {
  deriveIdentitySuggestions,
  type IdentitySuggestion,
} from "@/src/lib/identity/deriveIdentitySuggestions";
import {
  validateIdentitySignals,
  type IdentityValidationResult,
} from "@/src/lib/identity/validateIdentitySignals";
import { deriveSummaryExplanation } from "@/src/lib/summary/deriveSummaryExplanation";
import { deriveSummaryInsights, type SummaryTrend } from "@/src/lib/summary/deriveSummaryInsights";
import {
  devCompetitionSourceMatchTotal,
  devGetCompeteTabCompetitionSnapshot,
  devLogCompetitionSourceParity,
  devLogCompetitionSummaryTrace,
  devPickLatestCompetitionEntryLikeComputeSignals,
} from "@/src/features/summary/competitionSummaryAggregationTrace";
import { canonicalCompetitionSliceFingerprint } from "@/src/features/competition/canonicalCompetitionSource";
import {
  buildSummaryViewModel,
  extractSignalSnapshot,
} from "@/src/lib/summary/buildSummaryViewModel";
import { selectFocusSystem } from "@/src/lib/summary/selectFocusSystem";
import {
  resolveWeeklyDoc,
  resolveWeeklySharedAthleteIdForParentSnapshot,
  type ParentWeeklySessionSnapshot,
} from "../../coach/resolveWeeklyDoc";
import {
  dedupeActiveCoachWriterLinks,
  parentDeviceCoachLinkedForTrustUi,
  parentStrictWeeklyLinkedCoachLinksForUi,
  sortCoachWriterLinksNewestFirst,
} from "../../coachShare/coachLinkBinding";
import { normalizeInviteLinkToken, inviteLinkTokenTail } from "../../coachShare/inviteLinkToken";
import { refreshParentWriterSessionSnapshot } from "../../services/refreshParentWriterSessionSnapshot";
import { coachSyncFetchSession } from "../../services/coachWeeklySyncApi";
import {
  getCachedWeeklyForLinkToken,
  setCachedWeeklyForLinkToken,
} from "../../storage/coachWeeklySyncCacheStore";
import { useCoachSyncHydrationVersion } from "../../storage/coachSyncHydrationStore";
import { getCoachLinks } from "../../storage/coachShareStore";
import type { CoachLink } from "../../types/coachShare";
import type { KidsById } from "../../types/coachKid";
import { resolvePrincipalBucketEvidenceLine } from "../../lib/signals/competitionBucketHistory";
import { useDeviceRole } from "../../deviceRole/DeviceRoleProvider";
import {
  filterSessionsLikeTrainingRefresh,
  normalizeSessionsLikeTraining,
} from "../../domain/sessionUtils";
import { useActiveAthlete } from "../../hooks/useActiveAthlete";
import { useAuthorityConsumerRouteTelemetry } from "../../hooks/useAuthorityConsumerRouteTelemetry";
import { useAthleteData, type SummaryFlowTraceRole } from "../../hooks/useAthleteData";
import { useSummaryCompetitionFocusInput } from "../../hooks/useSummaryCompetitionFocusInput";
import { useSignals } from "../../hooks/useSignals";
import { useActiveKidId } from "../../state/activeKidStore";
import {
  deleteAthlete,
  setActiveAthleteId,
  updateAthlete,
  type ParentAthlete,
  type ParentAthleteUpdate,
} from "../../storage/athleteStore";
import {
  getLastSummaryAction,
  setLastSummaryAction,
} from "@/src/storage/summaryActionTracking";
import {
  getLatestKidWeeklyFocusForWeek,
  startOfWeekMondayYMD,
  todayYMD,
} from "../../storage/coachKidStore";
import { duplicateSharedIdsByAthleteName, setLineageIntegrityTraceContext } from "../../identity/athleteLineageTrace";
import { LineageIntegrityDevHint } from "../../identity/LineageIntegrityDevHint";
import { runLineageIntegrityScan } from "../../identity/lineageIntegrityDetection";
import { logCoachHydrationResolveTrace } from "../../identity/coachHydrationResolveTrace";
import {
  athleteIdSetFromParent,
  athleteIdSetFromSynced,
  logHydrationPipelineWatchAthletes,
  namesByIdFromKids,
  namesByIdFromParentAthletes,
  namesByIdFromSyncedAthletes,
} from "../../identity/hydrationPipelineTrace";
import { assertSummaryOperatingRosterParityDev } from "../../identity/selectOperatingAthleteRoster";
import {
  devDeriveAuthorityChainDivergence,
  devLogAuthorityChainComparison,
  devLogAuthorityChainStage,
  weeklySlice,
} from "./authorityChainTrace";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const DISMISS_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

type SummaryRefreshType = "soft_refresh" | "parent_weekly_soft_refresh";

function logSummaryRefreshDev(
  event: "refresh_start" | "refresh_complete" | "refresh_error",
  payload: {
    role: string;
    athleteId: string;
    refreshType: SummaryRefreshType;
    message?: string;
  },
): void {
  if (!__DEV__) return;
  console.log("[SUMMARY_REFRESH]", { event, ...payload });
}

function recentSubmissionTypesSummaryLine(
  competitions: readonly KidCompetitionEntryWithMatchDetail[],
): string | null {
  if (!competitions.length) return null;
  const sorted = [...competitions].sort((a, b) => {
    const c = b.eventDate.localeCompare(a.eventDate);
    if (c !== 0) return c;
    return b.createdAt.localeCompare(a.createdAt);
  });
  for (const c of sorted) {
    const { matches } = c;
    if (!Array.isArray(matches) || matches.length === 0) continue;
    const labels: string[] = [];
    const seen = new Set<string>();
    for (const m of matches) {
      if (m.matchResult !== "win" || m.outcome !== "Submission") continue;
      const lab = labelForSubmissionTypeKey(m.submissionType ?? null);
      if (!lab || seen.has(lab)) continue;
      seen.add(lab);
      labels.push(lab);
      if (labels.length >= 4) break;
    }
    if (labels.length > 0) {
      return `Submission types (latest event): ${labels.join(" · ")}`;
    }
  }
  return null;
}

function getSuggestionKey(s: IdentitySuggestion): string {
  return `${s.type}-${String(s.suggestedValue ?? "none")}`;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "MM";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const formatSkill = (skill: string) => {
  return skill
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

function getIdentityFocus(athlete: {
  declaredSkills?: string[];
  experienceLevel?: string;
  isCompetitor?: boolean;
} | null | undefined): string {
  const skills = athlete?.declaredSkills ?? [];
  const exp = (athlete?.experienceLevel ?? "").trim().toLowerCase();
  const competitor = !!athlete?.isCompetitor;

  if (skills.length === 0) {
    if (exp === "beginner") {
      return "Focus on learning and recognizing core positions.";
    }
    if (exp === "developing") {
      return "Start identifying the techniques that feel natural to you.";
    }
    return "Refine your strongest positions and sequences.";
  }

  const topSkills = skills.slice(0, 2).map(formatSkill).join(" & ");

  if (exp === "developing") {
    return `Build sequences around your ${topSkills}.`;
  }

  if (exp === "experienced") {
    if (competitor) {
      return `Sharpen your ${topSkills} for competition performance.`;
    }
    return `Refine and optimize your ${topSkills}.`;
  }

  return `Explore and build from your ${topSkills}.`;
}

function coachWriterWeeklySnapshotFromCacheEntry(cached: {
  weekly: ParentWeeklySessionSnapshot["weekly"];
  weeklyByAthleteId: ParentWeeklySessionSnapshot["weeklyByAthleteId"];
  athletes?: ParentWeeklySessionSnapshot["athletes"];
}): ParentWeeklySessionSnapshot {
  return {
    weekly: cached.weekly,
    weeklyByAthleteId: cached.weeklyByAthleteId ?? {},
    athletes: cached.athletes ?? [],
  };
}

function coachWriterSnapshotListsAthlete(
  snapshot: ParentWeeklySessionSnapshot,
  sharedAthleteId: string,
): boolean {
  const aid = sharedAthleteId.trim();
  if (!aid) return true;
  const rosterIds = new Set(
    (snapshot.athletes ?? [])
      .map((a) => (typeof a.id === "string" ? a.id.trim() : ""))
      .filter(Boolean),
  );
  if (rosterIds.has(aid)) return true;
  const map = snapshot.weeklyByAthleteId ?? {};
  return Object.prototype.hasOwnProperty.call(map, aid);
}

function orderCoachWriterSyncLinksForAthlete(
  syncLinks: CoachLink[],
  kidsById: KidsById,
  linkedKidId: string | null | undefined,
): CoachLink[] {
  const kidRow =
    typeof linkedKidId === "string" && linkedKidId.trim()
      ? kidsById[linkedKidId.trim()]
      : undefined;
  const kidTokenKey = normalizeInviteLinkToken(kidRow?.sharedFromInviteTokenNorm ?? "");
  if (!kidTokenKey) return syncLinks;
  return [...syncLinks].sort((a, b) => {
    const aToken = normalizeInviteLinkToken(a.weeklySync?.linkToken ?? "");
    const bToken = normalizeInviteLinkToken(b.weeklySync?.linkToken ?? "");
    const aMatch = aToken === kidTokenKey ? 1 : 0;
    const bMatch = bToken === kidTokenKey ? 1 : 0;
    return bMatch - aMatch;
  });
}

function summaryEmptyInsightCopy(input: {
  experienceLevel?: string;
  isCompetitor?: boolean | undefined;
}): string | null {
  const exp = input.experienceLevel?.trim().toLowerCase();
  if (exp === "beginner") {
    return "Start logging your training to begin building your game.";
  }
  if (exp === "developing") {
    return "You've started building your game. Let's refine it.";
  }
  if (input.isCompetitor === true) {
    return "Track your matches and sharpen your performance.";
  }
  return null;
}

function summaryRuntimeIds(rows: ParentAthlete[]): string[] {
  return rows.map((a) => a.id.trim()).filter(Boolean);
}

export default function SummaryScreen() {
  const router = useRouter();
  const segments = useSegments();
  const {
    linkedKidId: summaryLinkedKidId,
    hydrationReady,
    authorityBootstrapState,
    coachOperatingAthleteChoices,
    athleteId: activeAthleteId,
    athlete,
    operatingAthleteRoster,
    kidsById,
    refreshActiveAthleteAuthority,
  } = useActiveAthlete();
  const activeKidId = useActiveKidId();
  const { role: deviceRole } = useDeviceRole();
  const coachSyncHydrationVersion = useCoachSyncHydrationVersion();
  const prevCoachSyncHydrationVersionRef = useRef(coachSyncHydrationVersion);

  const summaryTraceReady = hydrationReady && Boolean(activeAthleteId.trim());

  useAuthorityConsumerRouteTelemetry({
    routeScreen: "Summary",
    hydrationReady,
    athleteId: activeAthleteId,
    linkedKidId: summaryLinkedKidId,
    authorityBootstrapState,
    role: deviceRole,
  });

  const [appliedProfile, setAppliedProfile] = useState<ParentAthlete | null>(null);
  const [dismissedAtMap, setDismissedAtMap] = useState<Record<string, number>>({});
  const [suggestionInteractions, setSuggestionInteractions] = useState<
    Record<string, { accepted: number; dismissed: number }>
  >({});
  const [suggestionCooldownMap, setSuggestionCooldownMap] = useState<
    Record<string, number>
  >({});
  const [nowTick, setNowTick] = useState(Date.now());
  const [lastAction, setLastActionState] = useState<string | null>(null);
  const [weeklySessionSnapshot, setWeeklySessionSnapshot] =
    useState<ParentWeeklySessionSnapshot | null>(null);
  const [coachLinkRowsForTrustUi, setCoachLinkRowsForTrustUi] = useState<CoachLink[]>([]);
  /** Session-only: Recognized Skills starts collapsed for a calmer first paint. */
  const [recognizedSkillsExpanded, setRecognizedSkillsExpanded] = useState(false);
  const [summaryRefreshing, setSummaryRefreshing] = useState(false);
  const weeklySessionSourceRef = useRef<"cache" | "network" | "none">("none");
  const previousValidationRef = useRef<IdentityValidationResult | null>(null);
  const previousTrendRef = useRef<SummaryTrend | null>(null);
  const pendingDeletedAthleteIdRef = useRef<string | null>(null);
  const prevSummaryRuntimeRosterIdsRef = useRef<string>("");
  const prevAthleteIdForPrevSignalsRef = useRef(activeAthleteId);
  if (prevAthleteIdForPrevSignalsRef.current !== activeAthleteId) {
    if (__DEV__) {
      console.log("[ACTIVE_ATHLETE_RUNTIME]", {
        phase: "summary_activeAthleteId_render_change",
        callbackSource: "SummaryScreen.render",
        activeAthleteId,
        previousActiveAthleteId: prevAthleteIdForPrevSignalsRef.current || null,
        rosterIds: summaryRuntimeIds(operatingAthleteRoster),
        rosterLength: operatingAthleteRoster.length,
        selectedAthleteIds: activeAthleteId.trim() ? [activeAthleteId.trim()] : [],
        deletedAthleteId: pendingDeletedAthleteIdRef.current,
        deletedAthleteStillExists: pendingDeletedAthleteIdRef.current
          ? operatingAthleteRoster.some((a) => a.id.trim() === pendingDeletedAthleteIdRef.current)
          : null,
        activeAthletePresentInRoster: activeAthleteId.trim()
          ? operatingAthleteRoster.some((a) => a.id.trim() === activeAthleteId.trim())
          : false,
      });
    }
    prevAthleteIdForPrevSignalsRef.current = activeAthleteId;
    previousValidationRef.current = null;
    previousTrendRef.current = null;
  }

  const prevVisibleSuggestionKeysRef = useRef<Set<string>>(new Set());
  const resurfacedKeysRef = useRef<Set<string>>(new Set());
  const lastProgressionMemoryScopeRef = useRef<string | null>(null);

  useEffect(() => {
    setAppliedProfile(null);
    setDismissedAtMap({});
    setSuggestionInteractions({});
    setSuggestionCooldownMap({});
    previousValidationRef.current = null;
    previousTrendRef.current = null;
    prevVisibleSuggestionKeysRef.current = new Set();
    resurfacedKeysRef.current = new Set();
  }, [activeAthleteId]);

  const summarySwitcherAthletes = useMemo(() => {
    let next: ParentAthlete[];
    if (
      deviceRole === "coach" &&
      (authorityBootstrapState === "coach_unresolved" ||
        (authorityBootstrapState === "coach_disconnected" &&
          coachOperatingAthleteChoices.length > 0))
    ) {
      next = coachOperatingAthleteChoices;
    } else {
      next = operatingAthleteRoster;
    }
    if (__DEV__) {
      const deletedAthleteId = pendingDeletedAthleteIdRef.current;
      console.log("[SUMMARY_SWITCHER_RUNTIME]", {
        phase: "summarySwitcherAthletes_recompute",
        callbackSource: "SummaryScreen.useMemo.summarySwitcherAthletes",
        activeAthleteId: activeAthleteId.trim() || null,
        rosterIds: summaryRuntimeIds(operatingAthleteRoster),
        rosterLength: operatingAthleteRoster.length,
        selectedAthleteIds: summaryRuntimeIds(next),
        deletedAthleteId,
        deletedAthleteStillExists: deletedAthleteId
          ? next.some((a) => a.id.trim() === deletedAthleteId)
          : null,
        activeAthletePresentInRoster: activeAthleteId.trim()
          ? operatingAthleteRoster.some((a) => a.id.trim() === activeAthleteId.trim())
          : false,
        authorityBootstrapState,
        deviceRole,
      });
    }
    return next;
  }, [
    activeAthleteId,
    operatingAthleteRoster,
    authorityBootstrapState,
    coachOperatingAthleteChoices,
    deviceRole,
  ]);

  useEffect(() => {
    if (!__DEV__ || !hydrationReady) return;
    if (deviceRole === "coach") return;
    const switcherIds = summarySwitcherAthletes.map((a) => a.id);
    assertSummaryOperatingRosterParityDev(
      switcherIds,
      operatingAthleteRoster,
      "SummaryScreen.summarySwitcherAthletes",
    );
  }, [deviceRole, hydrationReady, operatingAthleteRoster, summarySwitcherAthletes]);

  useEffect(() => {
    if (!__DEV__ || !hydrationReady) return;
    const renderedIds = new Set(
      summarySwitcherAthletes.map((a) => a.id.trim()).filter(Boolean),
    );
    logHydrationPipelineWatchAthletes({
      stage: "8_summary_athlete_switcher_inputs",
      sourceSubsystem: "SummaryScreen.SummaryAthleteSwitcher",
      dataOrigin: "derived",
      kidsById,
      presentAthleteIds: athleteIdSetFromParent(summarySwitcherAthletes),
      renderedAthleteIds: renderedIds,
      namesById: namesByIdFromParentAthletes(summarySwitcherAthletes),
      allAthleteIdsInStage: summarySwitcherAthletes.map((a) => a.id),
      stageMeta: {
        deviceRole,
        authorityBootstrapState,
        activeAthleteId: activeAthleteId.trim() || null,
        switcherVisible: summarySwitcherAthletes.length > 0,
      },
    });
  }, [
    activeAthleteId,
    authorityBootstrapState,
    deviceRole,
    hydrationReady,
    kidsById,
    summarySwitcherAthletes,
  ]);

  useEffect(() => {
    if (!__DEV__ || !hydrationReady) return;
    const weeklyAthletes = weeklySessionSnapshot?.athletes;
    const writerSessions =
      weeklyAthletes && weeklyAthletes.length > 0
        ? [
            {
              linkTokenNorm: "summary_weekly_snapshot",
              athletes: weeklyAthletes,
            },
          ]
        : undefined;
    setLineageIntegrityTraceContext({
      role: deviceRole,
      activeOperatingAthleteId: activeAthleteId.trim() || null,
      parentAthletes: operatingAthleteRoster,
      operatingAthleteRoster,
      kidsById,
      writerSessions,
    });
    runLineageIntegrityScan({
      route: "SummaryScreen",
      role: deviceRole,
      activeOperatingAthleteId: activeAthleteId.trim() || null,
      parentAthletes: operatingAthleteRoster,
      operatingAthleteRoster,
      kidsById,
      writerSessions,
    });
  }, [
    activeAthleteId,
    deviceRole,
    hydrationReady,
    kidsById,
    operatingAthleteRoster,
    weeklySessionSnapshot?.athletes,
  ]);

  const applyWeeklySessionSnapshot = useCallback(
    (
      source: "cache" | "network" | "none",
      snapshot: ParentWeeklySessionSnapshot | null,
      traceMeta: {
        sourcePath: string;
        tokenTail?: string | null;
        tokenNorm?: string | null;
      },
      isCancelled?: () => boolean,
    ) => {
      if (isCancelled?.()) return;
      weeklySessionSourceRef.current = source;
      if (__DEV__ && summaryTraceReady) {
        const weeklyKeys = Object.keys(snapshot?.weeklyByAthleteId ?? {});
        devLogAuthorityChainStage("3_summary_session_hydrate", {
          dataPlane: source,
          tokenTail: traceMeta.tokenTail ?? null,
          athleteId: activeAthleteId,
          linkedKidId: summaryLinkedKidId,
          weeklyKeysAvailable: weeklyKeys,
          inviteHeadline: snapshot?.weekly?.headline?.slice(0, 120) ?? null,
          inviteSystemKey: snapshot?.weekly?.systemKey ?? null,
        });
        console.log("[SUMMARY WEEKLY TRACE] hydration.applySnapshot", {
          sourcePath: traceMeta.sourcePath,
          dataPlane: source,
          tokenTail: traceMeta.tokenTail ?? null,
          athleteId: activeAthleteId,
          linkedKidId: summaryLinkedKidId,
          weeklyKeysAvailable: weeklyKeys,
          inviteHeadline: snapshot?.weekly?.headline?.slice(0, 120) ?? null,
          inviteUpdatedAt: snapshot?.weekly?.updatedAt ?? null,
          inviteSystemKey: snapshot?.weekly?.systemKey ?? null,
          firstAthleteKey: weeklyKeys[0] ?? null,
          firstAthleteHeadline: weeklyKeys[0]
            ? snapshot?.weeklyByAthleteId?.[weeklyKeys[0]]?.headline?.slice(0, 120) ?? null
            : null,
          firstAthleteSystemKey: weeklyKeys[0]
            ? snapshot?.weeklyByAthleteId?.[weeklyKeys[0]]?.systemKey ?? null
            : null,
          at: new Date().toISOString(),
        });
        logHydrationPipelineWatchAthletes({
          stage: source === "cache" ? "5_hydration_restore" : "2_weekly_sync_ingestion",
          sourceSubsystem: "SummaryScreen.weeklySessionSnapshot.applySnapshot",
          dataOrigin: source === "cache" ? "cache" : source === "network" ? "remote" : "unknown",
          inviteTokenHint: traceMeta.tokenNorm ?? null,
          kidsById,
          presentAthleteIds: athleteIdSetFromSynced(snapshot?.athletes),
          namesById: namesByIdFromSyncedAthletes(snapshot?.athletes),
          allAthleteIdsInStage: snapshot?.athletes?.map((a) => a.id) ?? [],
          stageMeta: { tokenTail: traceMeta.tokenTail ?? null, weeklyKeysAvailable: weeklyKeys },
        });
      }
      setWeeklySessionSnapshot(snapshot);
    },
    [activeAthleteId, kidsById, summaryLinkedKidId, summaryTraceReady],
  );

  const refreshCoachWeeklySessionSnapshot = useCallback(
    async (
      isCancelled?: () => boolean,
      options?: { cacheOnly?: boolean },
    ): Promise<void> => {
      const links = await getCoachLinks();
      if (isCancelled?.()) return;
      setCoachLinkRowsForTrustUi(links);

      const syncLinks = sortCoachWriterLinksNewestFirst(
        dedupeActiveCoachWriterLinks(links).filter((l) => l.weeklySync?.linkToken?.trim()),
      );
      if (syncLinks.length === 0) {
        if (isCancelled?.()) return;
        applyWeeklySessionSnapshot(
          "none",
          null,
          {
            sourcePath:
              "SummaryScreen.refreshCoachWeeklySessionSnapshot → no writer sync links",
          },
          isCancelled,
        );
        return;
      }

      const activeAid = activeAthleteId.trim();
      const orderedLinks = orderCoachWriterSyncLinksForAthlete(
        syncLinks,
        kidsById,
        summaryLinkedKidId,
      );

      let cachedFallback: ParentWeeklySessionSnapshot | null = null;
      let cachedFallbackTokenTail: string | null = null;
      let cachedFallbackTokenNorm: string | null = null;

      for (const link of orderedLinks) {
        const token = link.weeklySync!.linkToken;
        const tokenNorm = normalizeInviteLinkToken(token);
        const tokenTail = inviteLinkTokenTail(token);
        const cached = await getCachedWeeklyForLinkToken(token);
        if (isCancelled?.()) return;
        if (!cached) continue;

        const snapshot = coachWriterWeeklySnapshotFromCacheEntry(cached);
        if (!cachedFallback) {
          cachedFallback = snapshot;
          cachedFallbackTokenTail = tokenTail;
          cachedFallbackTokenNorm = tokenNorm;
        }
        if (coachWriterSnapshotListsAthlete(snapshot, activeAid)) {
          applyWeeklySessionSnapshot(
            "cache",
            snapshot,
            {
              sourcePath:
                "SummaryScreen.refreshCoachWeeklySessionSnapshot → getCachedWeeklyForLinkToken (writer plane)",
              tokenTail,
              tokenNorm,
            },
            isCancelled,
          );
          return;
        }
      }

      if (options?.cacheOnly) {
        if (cachedFallback) {
          applyWeeklySessionSnapshot(
            "cache",
            cachedFallback,
            {
              sourcePath:
                "SummaryScreen.refreshCoachWeeklySessionSnapshot → cacheOnly fallback",
              tokenTail: cachedFallbackTokenTail,
              tokenNorm: cachedFallbackTokenNorm,
            },
            isCancelled,
          );
        } else {
          applyWeeklySessionSnapshot(
            "none",
            null,
            {
              sourcePath:
                "SummaryScreen.refreshCoachWeeklySessionSnapshot → cacheOnly miss",
            },
            isCancelled,
          );
        }
        return;
      }

      const fetchLink = orderedLinks[0];
      const fetchToken = fetchLink.weeklySync!.linkToken;
      const fetchTokenNorm = normalizeInviteLinkToken(fetchToken);
      const fetchTokenTail = inviteLinkTokenTail(fetchToken);

      try {
        const session = await coachSyncFetchSession(
          fetchToken,
          fetchLink.weeklySync!.apiBaseUrl,
        );
        if (isCancelled?.()) return;
        const nowIso = new Date().toISOString();
        await setCachedWeeklyForLinkToken(
          fetchToken,
          session.weekly,
          nowIso,
          session.weeklyByAthleteId ?? {},
          session.athletes,
          session,
          fetchTokenNorm,
        );
        applyWeeklySessionSnapshot(
          "network",
          {
            weekly: session.weekly,
            weeklyByAthleteId: session.weeklyByAthleteId ?? {},
            athletes: session.athletes,
          },
          {
            sourcePath:
              "SummaryScreen.refreshCoachWeeklySessionSnapshot → coachSyncFetchSession (writer plane)",
            tokenTail: fetchTokenTail,
            tokenNorm: fetchTokenNorm,
          },
          isCancelled,
        );
      } catch (error) {
        if (__DEV__ && summaryTraceReady) {
          console.warn("[SUMMARY WEEKLY TRACE] hydration.networkError", {
            athleteId: activeAthleteId,
            tokenNorm: fetchTokenNorm,
            tokenTail: fetchTokenTail,
            message: error instanceof Error ? error.message : String(error),
            keptCacheSnapshot: Boolean(cachedFallback),
            dataPlane: "coach_writer",
          });
        }
        if (cachedFallback) {
          applyWeeklySessionSnapshot(
            "cache",
            cachedFallback,
            {
              sourcePath:
                "SummaryScreen.refreshCoachWeeklySessionSnapshot → network error, cache fallback",
              tokenTail: cachedFallbackTokenTail,
              tokenNorm: cachedFallbackTokenNorm,
            },
            isCancelled,
          );
        } else {
          applyWeeklySessionSnapshot(
            "none",
            null,
            {
              sourcePath:
                "SummaryScreen.refreshCoachWeeklySessionSnapshot → network error, no cache",
              tokenTail: fetchTokenTail,
              tokenNorm: fetchTokenNorm,
            },
            isCancelled,
          );
        }
      }
    },
    [
      activeAthleteId,
      applyWeeklySessionSnapshot,
      kidsById,
      summaryLinkedKidId,
      summaryTraceReady,
    ],
  );

  const refreshParentWeeklySessionSnapshot = useCallback(
    async (isCancelled?: () => boolean): Promise<void> => {
      const links = await getCoachLinks();
      if (isCancelled?.()) return;
      setCoachLinkRowsForTrustUi(links);

      const weeklyLink = parentStrictWeeklyLinkedCoachLinksForUi(links)[0];
      const weeklySync = weeklyLink?.weeklySync;
      if (!weeklySync?.linkToken?.trim()) {
        if (isCancelled?.()) return;
        applyWeeklySessionSnapshot(
          "none",
          null,
          {
            sourcePath:
              "SummaryScreen.refreshParentWeeklySessionSnapshot → no parent weekly link",
          },
          isCancelled,
        );
        return;
      }

      const token = weeklySync.linkToken;
      const tokenNorm = normalizeInviteLinkToken(token);
      const tokenTail = inviteLinkTokenTail(token);

      const cached = await getCachedWeeklyForLinkToken(token);
      if (isCancelled?.()) return;
      if (cached) {
        applyWeeklySessionSnapshot(
          "cache",
          coachWriterWeeklySnapshotFromCacheEntry(cached),
          {
            sourcePath:
              "SummaryScreen.refreshParentWeeklySessionSnapshot → getCachedWeeklyForLinkToken | coachSyncFetchSession",
            tokenTail,
            tokenNorm,
          },
          isCancelled,
        );
      }

      const result = await refreshParentWriterSessionSnapshot({
        initialSharedAthleteIds: [activeAthleteId],
        isCancelled,
      });
      if (isCancelled?.()) return;

      if (result.status === "success") {
        applyWeeklySessionSnapshot(
          "network",
          {
            weekly: result.session.weekly,
            weeklyByAthleteId: result.session.weeklyByAthleteId ?? {},
            athletes: result.session.athletes,
          },
          {
            sourcePath:
              "SummaryScreen.refreshParentWeeklySessionSnapshot → getCachedWeeklyForLinkToken | coachSyncFetchSession",
            tokenTail,
            tokenNorm,
          },
          isCancelled,
        );
        return;
      }

      if (result.status === "error") {
        if (__DEV__ && summaryTraceReady) {
          console.warn("[SUMMARY WEEKLY TRACE] hydration.networkError", {
            athleteId: activeAthleteId,
            tokenNorm,
            tokenTail,
            message:
              result.error instanceof Error ? result.error.message : String(result.error),
            keptCacheSnapshot: Boolean(cached),
            dataPlane: "parent_weekly",
          });
        }
        if (!cached) {
          applyWeeklySessionSnapshot(
            "none",
            null,
            {
              sourcePath:
                "SummaryScreen.refreshParentWeeklySessionSnapshot → network error, no cache",
              tokenTail,
              tokenNorm,
            },
            isCancelled,
          );
        }
      }
    },
    [activeAthleteId, applyWeeklySessionSnapshot, summaryTraceReady],
  );

  const refreshWeeklySessionSnapshot = useCallback(
    async (
      isCancelled?: () => boolean,
      options?: { cacheOnly?: boolean },
    ): Promise<void> => {
      if (deviceRole === "coach") {
        await refreshCoachWeeklySessionSnapshot(isCancelled, options);
        return;
      }
      if (deviceRole === "parent") {
        await refreshParentWeeklySessionSnapshot(isCancelled);
      }
    },
    [
      deviceRole,
      refreshCoachWeeklySessionSnapshot,
      refreshParentWeeklySessionSnapshot,
    ],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void refreshWeeklySessionSnapshot(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [refreshWeeklySessionSnapshot]),
  );

  useEffect(() => {
    if (deviceRole !== "coach") {
      prevCoachSyncHydrationVersionRef.current = coachSyncHydrationVersion;
      return;
    }
    if (!hydrationReady) {
      prevCoachSyncHydrationVersionRef.current = coachSyncHydrationVersion;
      return;
    }
    if (prevCoachSyncHydrationVersionRef.current === coachSyncHydrationVersion) {
      return;
    }
    prevCoachSyncHydrationVersionRef.current = coachSyncHydrationVersion;

    let cancelled = false;
    void refreshCoachWeeklySessionSnapshot(() => cancelled, { cacheOnly: true });
    return () => {
      cancelled = true;
    };
  }, [
    coachSyncHydrationVersion,
    deviceRole,
    hydrationReady,
    refreshCoachWeeklySessionSnapshot,
  ]);

  useEffect(() => {
    if (deviceRole !== "coach" || !hydrationReady || !activeAthleteId.trim()) return;
    let cancelled = false;
    void refreshCoachWeeklySessionSnapshot(() => cancelled, { cacheOnly: true });
    return () => {
      cancelled = true;
    };
  }, [
    activeAthleteId,
    deviceRole,
    hydrationReady,
    refreshCoachWeeklySessionSnapshot,
  ]);

  const onSummaryRefresh = useCallback(async () => {
    const athleteIdNorm = activeAthleteId.trim();
    const refreshType: SummaryRefreshType =
      deviceRole === "parent" ? "parent_weekly_soft_refresh" : "soft_refresh";

    logSummaryRefreshDev("refresh_start", {
      role: deviceRole ?? "unknown",
      athleteId: athleteIdNorm,
      refreshType,
    });

    setSummaryRefreshing(true);
    try {
      if (deviceRole === "parent") {
        await refreshParentWeeklySessionSnapshot();
        await refreshActiveAthleteAuthority();
      } else if (deviceRole === "coach") {
        await refreshCoachWeeklySessionSnapshot();
        await refreshActiveAthleteAuthority();
      }
      logSummaryRefreshDev("refresh_complete", {
        role: deviceRole ?? "unknown",
        athleteId: athleteIdNorm,
        refreshType,
      });
    } catch (error) {
      logSummaryRefreshDev("refresh_error", {
        role: deviceRole ?? "unknown",
        athleteId: athleteIdNorm,
        refreshType,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSummaryRefreshing(false);
    }
  }, [
    activeAthleteId,
    deviceRole,
    refreshActiveAthleteAuthority,
    refreshCoachWeeklySessionSnapshot,
    refreshParentWeeklySessionSnapshot,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const rosterAthleteRow = useMemo(() => {
    const id = activeAthleteId.trim();
    const row = id ? operatingAthleteRoster.find((a) => a.id.trim() === id) ?? null : null;
    if (__DEV__) {
      const deletedAthleteId = pendingDeletedAthleteIdRef.current;
      console.log("[SUMMARY_RENDER_RUNTIME]", {
        phase: "rosterAthleteRow_recompute",
        callbackSource: "SummaryScreen.useMemo.rosterAthleteRow",
        activeAthleteId: id || null,
        rosterIds: summaryRuntimeIds(operatingAthleteRoster),
        rosterLength: operatingAthleteRoster.length,
        selectedAthleteIds: row?.id ? [row.id.trim()] : [],
        deletedAthleteId,
        deletedAthleteStillExists: deletedAthleteId
          ? operatingAthleteRoster.some((a) => a.id.trim() === deletedAthleteId)
          : null,
        activeAthletePresentInRoster: id
          ? operatingAthleteRoster.some((a) => a.id.trim() === id)
          : false,
      });
    }
    return row;
  }, [activeAthleteId, operatingAthleteRoster]);

  const athleteForSummary = useMemo(() => {
    let row: ParentAthlete | null;
    if (appliedProfile && appliedProfile.id === activeAthleteId) {
      row = appliedProfile;
    } else if (athlete) {
      row = athlete;
    } else {
      row = rosterAthleteRow;
    }
    if (__DEV__) {
      const deletedAthleteId = pendingDeletedAthleteIdRef.current;
      console.log("[SUMMARY_RENDER_RUNTIME]", {
        phase: "athleteForSummary_recompute",
        callbackSource: "SummaryScreen.useMemo.athleteForSummary",
        activeAthleteId: activeAthleteId.trim() || null,
        rosterIds: summaryRuntimeIds(operatingAthleteRoster),
        rosterLength: operatingAthleteRoster.length,
        selectedAthleteIds: row?.id ? [row.id.trim()] : [],
        deletedAthleteId,
        deletedAthleteStillExists: deletedAthleteId
          ? operatingAthleteRoster.some((a) => a.id.trim() === deletedAthleteId)
          : null,
        activeAthletePresentInRoster: activeAthleteId.trim()
          ? operatingAthleteRoster.some((a) => a.id.trim() === activeAthleteId.trim())
          : false,
        source: appliedProfile && appliedProfile.id === activeAthleteId
          ? "appliedProfile"
          : athlete
            ? "useActiveAthlete.athlete"
            : "rosterAthleteRow",
      });
    }
    return row;
  }, [appliedProfile, activeAthleteId, athlete, operatingAthleteRoster, rosterAthleteRow]);

  useEffect(() => {
    if (!__DEV__) return;
    const rosterIds = summaryRuntimeIds(operatingAthleteRoster);
    const rosterSignature = rosterIds.join(",");
    const deletedAthleteId = pendingDeletedAthleteIdRef.current;
    console.log("[SUMMARY_RENDER_RUNTIME]", {
      phase: "render_commit",
      callbackSource: "SummaryScreen.useEffect.render",
      activeAthleteId: activeAthleteId.trim() || null,
      rosterIds,
      rosterLength: rosterIds.length,
      selectedAthleteIds: summaryRuntimeIds(summarySwitcherAthletes),
      deletedAthleteId,
      deletedAthleteStillExists: deletedAthleteId
        ? rosterIds.includes(deletedAthleteId)
        : null,
      activeAthletePresentInRoster: activeAthleteId.trim()
        ? rosterIds.includes(activeAthleteId.trim())
        : false,
      rosterLengthChanged: prevSummaryRuntimeRosterIdsRef.current !== rosterSignature,
    });
    prevSummaryRuntimeRosterIdsRef.current = rosterSignature;
  });

  const activeAthleteName =
    athleteForSummary?.name?.trim() || rosterAthleteRow?.name?.trim() || "";

  const canonicalSharedAthleteIdForDelete = useMemo(() => {
    const activeId = activeAthleteId.trim();
    if (activeId.startsWith("shared_ath_")) return activeId;
    const selectedKidId =
      typeof activeKidId === "string" && activeKidId.trim() ? activeKidId.trim() : "";
    if (selectedKidId) {
      const sid = kidsById[selectedKidId]?.sharedAthleteId?.trim() ?? "";
      if (sid) return sid;
    }
    const linkedKidId =
      typeof summaryLinkedKidId === "string" && summaryLinkedKidId.trim()
        ? summaryLinkedKidId.trim()
        : "";
    if (!linkedKidId) return null;
    const sid = kidsById[linkedKidId]?.sharedAthleteId?.trim() ?? "";
    return sid || null;
  }, [activeAthleteId, activeKidId, kidsById, summaryLinkedKidId]);

  useEffect(() => {
    if (!__DEV__) return;
    if (!hydrationReady || !activeAthleteId.trim()) return;
    console.log("[SUMMARY_SELECTOR_STATE]", {
      activeAthleteId: activeAthleteId.trim() || null,
      summaryLinkedKidId:
        typeof summaryLinkedKidId === "string" && summaryLinkedKidId.trim()
          ? summaryLinkedKidId.trim()
          : null,
      selectedAthleteName: activeAthleteName.trim() || null,
      sharedAthleteId: activeAthleteId.trim() || null,
    });
  }, [
    hydrationReady,
    activeAthleteId,
    summaryLinkedKidId,
    activeAthleteName,
  ]);

  const handleApplySuggestion = useCallback(
    async (suggestion: IdentitySuggestion) => {
      const base = athleteForSummary;
      if (!base?.id || !suggestion?.type) return;

      const patch: ParentAthleteUpdate = {};

      if (suggestion.type === "skill" && typeof suggestion.suggestedValue === "string") {
        const existing = base.declaredSkills ?? [];
        if (!existing.includes(suggestion.suggestedValue)) {
          patch.declaredSkills = [...existing, suggestion.suggestedValue];
        }
      }

      if (suggestion.type === "competitor") {
        patch.isCompetitor = true;
      }

      if (suggestion.type === "experience" && typeof suggestion.suggestedValue === "string") {
        patch.experienceLevel = suggestion.suggestedValue;
      }

      if (Object.keys(patch).length === 0) return;

      const updated = await updateAthlete(base.id, patch);
      if (updated) {
        setAppliedProfile(updated);
        setSuggestionInteractions((prev) => {
          const key = getSuggestionKey(suggestion);
          const entry = prev[key] ?? { accepted: 0, dismissed: 0 };
          return {
            ...prev,
            [key]: {
              ...entry,
              accepted: entry.accepted + 1,
            },
          };
        });
      }
    },
    [athleteForSummary],
  );

  const handleDismissSuggestion = useCallback((suggestion: IdentitySuggestion) => {
    setDismissedAtMap((prev) => ({
      ...prev,
      [getSuggestionKey(suggestion)]: Date.now(),
    }));
    setSuggestionInteractions((prev) => {
      const key = getSuggestionKey(suggestion);
      const entry = prev[key] ?? { accepted: 0, dismissed: 0 };
      return {
        ...prev,
        [key]: {
          ...entry,
          dismissed: entry.dismissed + 1,
        },
      };
    });
  }, []);

  const handleSelectAthlete = useCallback(async (id: string) => {
    await setActiveAthleteId(id);
  }, []);

  const deleteActiveAthlete = useCallback(async () => {
    const deletedAthleteId = activeAthleteId.trim() || null;
    pendingDeletedAthleteIdRef.current = deletedAthleteId;
    if (__DEV__) {
      console.log("[SUMMARY_RENDER_RUNTIME]", {
        phase: "delete_before_dispatch",
        callbackSource: "SummaryScreen.deleteActiveAthlete",
        activeAthleteId,
        rosterIds: summaryRuntimeIds(operatingAthleteRoster),
        rosterLength: operatingAthleteRoster.length,
        selectedAthleteIds: activeAthleteId.trim() ? [activeAthleteId.trim()] : [],
        deletedAthleteId,
        deletedAthleteStillExists: deletedAthleteId
          ? operatingAthleteRoster.some((a) => a.id.trim() === deletedAthleteId)
          : null,
        activeAthletePresentInRoster: activeAthleteId.trim()
          ? operatingAthleteRoster.some((a) => a.id.trim() === activeAthleteId.trim())
          : false,
      });
      console.log("[DELETE_CANONICAL_HANDOFF]", {
        activeAthleteId,
        activeKidId: activeKidId ?? null,
        summaryLinkedKidId:
          typeof summaryLinkedKidId === "string" && summaryLinkedKidId.trim()
            ? summaryLinkedKidId.trim()
            : null,
        resolvedSharedAthleteId: canonicalSharedAthleteIdForDelete,
      });
    }
    const ok = await deleteAthlete({
      athleteId: activeAthleteId,
      canonicalSharedAthleteId: canonicalSharedAthleteIdForDelete,
    });
    if (__DEV__) {
      console.log("[SUMMARY_RENDER_RUNTIME]", {
        phase: "delete_after_completion",
        callbackSource: "SummaryScreen.deleteActiveAthlete",
        activeAthleteId,
        rosterIds: summaryRuntimeIds(operatingAthleteRoster),
        rosterLength: operatingAthleteRoster.length,
        selectedAthleteIds: activeAthleteId.trim() ? [activeAthleteId.trim()] : [],
        deletedAthleteId,
        deletedAthleteStillExists: deletedAthleteId
          ? operatingAthleteRoster.some((a) => a.id.trim() === deletedAthleteId)
          : null,
        activeAthletePresentInRoster: activeAthleteId.trim()
          ? operatingAthleteRoster.some((a) => a.id.trim() === activeAthleteId.trim())
          : false,
        deleteResult: ok,
      });
    }
    return ok;
  }, [
    activeAthleteId,
    activeKidId,
    canonicalSharedAthleteIdForDelete,
    operatingAthleteRoster,
    summaryLinkedKidId,
  ]);

  const handleOpenManageAthlete = useCallback(() => {
    if (!activeAthleteId.trim()) return;

    const athleteName =
      athleteForSummary?.name?.trim() || rosterAthleteRow?.name?.trim() || "Athlete";

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Edit Profile", `Delete ${athleteName}`, "Cancel"],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
          title: "Manage Athlete",
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) {
            router.push("/summary/profile");
          }
          if (buttonIndex === 1) {
            const ok = await deleteActiveAthlete();
            if (ok) router.replace("/summary");
          }
        },
      );
    } else {
      Alert.alert("Manage Athlete", undefined, [
        {
          text: "Edit Profile",
          onPress: () => router.push("/summary/profile"),
        },
        {
          text: `Delete ${athleteName}`,
          style: "destructive",
          onPress: async () => {
            const ok = await deleteActiveAthlete();
            if (ok) router.replace("/summary");
          },
        },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }, [
    activeAthleteId,
    athleteForSummary?.name,
    deleteActiveAthlete,
    rosterAthleteRow?.name,
    router,
  ]);

  const summaryFlowTraceRole: SummaryFlowTraceRole =
    deviceRole === "coach" ? "coach" : deviceRole === "parent" ? "parent" : "unknown";

  const parentCoachLinkedTrust = useMemo(
    () => deviceRole === "parent" && parentDeviceCoachLinkedForTrustUi(coachLinkRowsForTrustUi),
    [coachLinkRowsForTrustUi, deviceRole],
  );
  const parentWeeklySyncChannelActive = useMemo(
    () =>
      deviceRole === "parent" &&
      parentStrictWeeklyLinkedCoachLinksForUi(coachLinkRowsForTrustUi).length > 0,
    [coachLinkRowsForTrustUi, deviceRole],
  );

  const linkedKidForAthleteData =
    typeof summaryLinkedKidId === "string" && summaryLinkedKidId.trim()
      ? summaryLinkedKidId.trim()
      : null;
  const { sessions: sessionsRaw, competitions } = useAthleteData(
    activeAthleteId,
    linkedKidForAthleteData,
    summaryFlowTraceRole,
    "SummaryScreen",
  );

  const competitionSliceFingerprint = useMemo(
    () => canonicalCompetitionSliceFingerprint(competitions),
    [competitions],
  );

  useEffect(() => {
    if (!summaryTraceReady) return;
    console.log("[COMP_SYNC_TRACE] SummaryScreen", {
      activeAthleteId: activeAthleteId.trim(),
      competitionSnapshotInputCount: competitions?.length ?? 0,
    });
  }, [activeAthleteId, competitions, summaryTraceReady]);

  const sessions = useMemo(() => {
    return filterSessionsLikeTrainingRefresh(
      normalizeSessionsLikeTraining(sessionsRaw),
      {
        deviceRole,
        athleteId: activeAthleteId.trim(),
        linkedKidId:
          typeof summaryLinkedKidId === "string" && summaryLinkedKidId.trim()
            ? summaryLinkedKidId.trim()
            : undefined,
      },
    );
  }, [sessionsRaw, deviceRole, activeAthleteId, summaryLinkedKidId]);

  const identityScore = computeIdentityScore({
    beltRank: athleteForSummary?.beltRank,
    declaredSkills: athleteForSummary?.declaredSkills,
    sessionCount: sessions?.length ?? 0,
    competitionCount: competitions?.length ?? 0,
  });

  const identityFocus = getIdentityFocus(athleteForSummary);

  const declaredInput =
    athleteForSummary &&
    ((athleteForSummary.experienceLevel ?? "").trim() !== "" ||
      typeof athleteForSummary.isCompetitor === "boolean")
      ? {
          experienceLevel: athleteForSummary.experienceLevel,
          isCompetitor: athleteForSummary.isCompetitor,
        }
      : undefined;
  const signals = useSignals({
    athleteId: activeAthleteId.trim() || null,
    kidId: summaryLinkedKidId,
    declaredInput,
    sessions: sessionsRaw,
    competitions,
  });
  const previousCompetitionRenderRef = useRef<{
    wins: number;
    losses: number;
    totalMatches: number;
    winRate: number | null;
    submissionRate: number | null;
    averageMatchTime: string | null;
  } | null>(null);
  const weeklySessionCountForSummary = signals.frequency.weeklySessionCount;

  useEffect(() => {
    if (!__DEV__) return;
    const current = {
      wins: signals.competition.record.wins,
      losses: signals.competition.record.losses,
      totalMatches: signals.competition.totalMatches,
      winRate: signals.competition.winRate,
      submissionRate: signals.competition.submissionRate,
      averageMatchTime: signals.competition.averageMatchTime,
    };
    const previous = previousCompetitionRenderRef.current;
    console.log("[COACH_SUMMARY_AGGREGATE_TRACE]", {
      stage: "summary_vm_recompute",
      deviceRole,
      athleteId: activeAthleteId.trim() || null,
      previousRecord: previous ? { wins: previous.wins, losses: previous.losses } : null,
      renderedRecord: { wins: current.wins, losses: current.losses },
      previousTotals: previous,
      renderedTotals: current,
    });
    previousCompetitionRenderRef.current = current;
  }, [
    activeAthleteId,
    deviceRole,
    signals.competition.record.wins,
    signals.competition.record.losses,
    signals.competition.totalMatches,
    signals.competition.winRate,
    signals.competition.submissionRate,
    signals.competition.averageMatchTime,
  ]);

  useEffect(() => {
    if (!__DEV__ || !summaryTraceReady) return;
    const proofCount =
      deviceRole === "coach" ? signals.frequency.weeklySessionCount : null;
    const localSessionCount = sessions.length;
    const localCurrentWeekSessionCount = signals.frequency.weeklySessionCount;
    const finalSessionCount = signals.frequency.weeklySessionCount;
    const source =
      deviceRole === "coach"
        ? finalSessionCount !== localSessionCount
          ? "summary_signals_proof_or_overlay"
          : "summary_signals_local"
        : "summary_parent_local";
    console.log("[SUMMARY_PROOF_CONSUME]", {
      athleteId: activeAthleteId.trim(),
      proofCount: deviceRole === "coach" ? proofCount : null,
      localSessionCount,
      finalSessionCount,
      source,
      vmSessionCount: sessions.length,
      consistencyWeekCount: signals.consistency.currentWeekCount,
    });
    console.log("[SUMMARY_SIGNALS_INPUT]", {
      athleteId: activeAthleteId.trim(),
      sessionCount: signals.frequency.weeklySessionCount,
      localScopedSessionCount: sessions.length,
      localCurrentWeekSessionCount,
      dominantSystems: {
        dominantObservedSystem: signals.dominantObservedSystem,
        systemsTopSystem: signals.systems.topSystem,
        patternsTopSystem: signals.patterns.topSystem,
      },
    });
  }, [
    activeAthleteId,
    deviceRole,
    sessions.length,
    signals.consistency.currentWeekCount,
    signals.frequency.weeklySessionCount,
    signals.dominantObservedSystem,
    signals.systems.topSystem,
    signals.patterns.topSystem,
    summaryTraceReady,
  ]);

  useEffect(() => {
    if (!__DEV__) return;
    if (!activeAthleteId.trim()) return;
    const aid = activeAthleteId.trim();
    const lk =
      typeof summaryLinkedKidId === "string" && summaryLinkedKidId.trim()
        ? summaryLinkedKidId.trim()
        : "";
    const compete = devGetCompeteTabCompetitionSnapshot();
    const summaryLatest = devPickLatestCompetitionEntryLikeComputeSignals(competitions);
    const summaryLatestId =
      summaryLatest?.id != null ? String(summaryLatest.id).trim() || null : null;
    const summarySourceMatches = devCompetitionSourceMatchTotal(competitions);
    const scopeMatchesCompeteTelemetry =
      !!compete && compete.athleteId === aid && (compete.linkedKidId ?? "") === (lk || "");
    const parityCompetitionCount =
      !compete || compete.visibleCompetitionCount === competitions.length;
    const parityMatchRows =
      !compete || compete.visibleMatchCount === summarySourceMatches;
    const parityLatestId =
      !compete ||
      (compete.latestCompetitionId ?? null) === (summaryLatestId ?? null);
    devLogCompetitionSourceParity({
      route: "Summary",
      sharedAthleteId: aid,
      linkedKidId: lk || null,
      sourceLineage: "useAthleteData → loadCanonicalAthleteCompetitionSlice (Compete parity)",
      competeTotals: compete
        ? {
            visibleCompetitionCount: compete.visibleCompetitionCount,
            visibleMatchCount: compete.visibleMatchCount,
            latestCompetitionId: compete.latestCompetitionId ?? null,
            dataPipeline: compete.dataPipeline,
          }
        : null,
      summaryPlane: {
        competitionRowCount: competitions.length,
        sourceMatchRows: summarySourceMatches,
        latestCompetitionId: summaryLatestId,
        competitionSliceFingerprint,
      },
      signalsCompetition: {
        competitionCount: signals.competition.competitionCount,
        totalMatches: signals.competition.totalMatches,
        winRate: signals.competition.winRate,
        podiumCountLast30Days: signals.competition.podiumCountLast30Days,
        podiumCountLast90Days: signals.competition.podiumCountLast90Days,
        /** May differ from raw match-row sum when `computeSignals` applies completion filters. */
        totalMatchesVsSourceMatchRows: signals.competition.totalMatches === summarySourceMatches,
      },
      parity: {
        hasCompeteDevSnapshot: !!compete,
        scopeMatchesCompeteTelemetry,
        competitionCountVsCompete: parityCompetitionCount,
        matchRowsVsCompete: parityMatchRows,
        latestIdVsCompete: parityLatestId,
        overall:
          !compete
            ? null
            : scopeMatchesCompeteTelemetry &&
              parityCompetitionCount &&
              parityMatchRows &&
              parityLatestId,
      },
    });
  }, [
    activeAthleteId,
    summaryLinkedKidId,
    competitions,
    competitionSliceFingerprint,
    signals,
  ]);

  const beltLabel = formatAthleteBeltRankLabel(athleteForSummary?.beltRank);
  const experienceLabel = formatAthleteExperienceLevelLabel(athleteForSummary?.experienceLevel);
  const hasIdentityHeader = Boolean(beltLabel && experienceLabel);
  const summaryOperatingHeaderMeta = useMemo(() => {
    if (hasIdentityHeader) {
      return `${beltLabel} / ${experienceLabel}`;
    }
    if (deviceRole === "parent" && parentWeeklySyncChannelActive) {
      return "Coach linked • Weekly sync active";
    }
    if (deviceRole === "parent" && parentCoachLinkedTrust) {
      return "Coach linked";
    }
    return "Add belt & experience";
  }, [
    beltLabel,
    deviceRole,
    experienceLabel,
    hasIdentityHeader,
    parentCoachLinkedTrust,
    parentWeeklySyncChannelActive,
  ]);
  const declaredSkills = athleteForSummary?.declaredSkills ?? [];

  const personalizedEmptyInsight = useMemo(() => {
    if (signals.hasData) return null;
    return summaryEmptyInsightCopy({
      experienceLevel: athleteForSummary?.experienceLevel,
      isCompetitor: athleteForSummary?.isCompetitor,
    });
  }, [signals.hasData, athleteForSummary?.experienceLevel, athleteForSummary?.isCompetitor]);

  const hasRealData = signals.hasData === true;

  const coachSignals = useMemo(() => {
    const coachNotes =
      competitions?.flatMap((c) => {
        const text = typeof c.coachNotes === "string" ? c.coachNotes.trim() : "";
        return text.length > 0 ? [text] : [];
      }) ?? [];
    const coachSignalList = deriveCoachSignals(coachNotes);
    return aggregateCoachSignals(coachSignalList);
  }, [competitions]);

  const validation = useMemo(() => {
    return validateIdentitySignals({
      declaredSkills: athleteForSummary?.declaredSkills,
      isCompetitor: athleteForSummary?.isCompetitor,
      experienceLevel: athleteForSummary?.experienceLevel,
      signals,
      coachSignals,
      sessionCount: sessions?.length ?? 0,
      competitionCount: competitions?.length ?? 0,
    });
  }, [
    athleteForSummary?.declaredSkills,
    athleteForSummary?.isCompetitor,
    athleteForSummary?.experienceLevel,
    signals,
    coachSignals,
    sessions?.length,
    competitionSliceFingerprint,
  ]);

  const summaryInsights = useMemo(() => {
    const sorted = [...sessions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return deriveSummaryInsights({
      signals,
      identityScore: identityScore.score,
      phase: identityScore.phase,
      identityFocus,
      sessions: sorted,
      coachSignals,
    });
  }, [
    sessions,
    signals,
    identityScore.score,
    identityScore.phase,
    identityFocus,
    coachSignals,
  ]);

  useEffect(() => {
    previousValidationRef.current = validation;
  }, [validation]);

  useEffect(() => {
    previousTrendRef.current = summaryInsights.trend;
  }, [summaryInsights.trend]);

  const identitySuggestions = useMemo(
    () =>
      deriveIdentitySuggestions({
        declaredSkills: athleteForSummary?.declaredSkills,
        isCompetitor: athleteForSummary?.isCompetitor,
        experienceLevel: athleteForSummary?.experienceLevel,
        signals,
        coachSignals,
        validation,
        sessionCount: sessions?.length ?? 0,
        competitionCount: competitions?.length ?? 0,
      }),
    [
      athleteForSummary?.declaredSkills,
      athleteForSummary?.isCompetitor,
      athleteForSummary?.experienceLevel,
      signals,
      coachSignals,
      validation,
      sessions?.length,
      competitionSliceFingerprint,
    ],
  );

  const suggestionsAfterDismissCooldown = useMemo(() => {
    const now = nowTick;
    const prevVal = previousValidationRef.current;
    const prevTrend = previousTrendRef.current;

    const validationChanged =
      prevVal != null &&
      (prevVal.skills !== validation.skills ||
        prevVal.competitor !== validation.competitor ||
        prevVal.experience !== validation.experience);

    const trendChanged = prevTrend != null && prevTrend !== summaryInsights.trend;

    return identitySuggestions.filter((s) => {
      const key = getSuggestionKey(s);
      const lastDismissedAt = dismissedAtMap[key] ?? 0;
      const isCoolingDown = now - lastDismissedAt < DISMISS_COOLDOWN_MS;
      const overrideCondition = validationChanged || trendChanged || s.confidence >= 0.85;

      console.log("SUGGESTION STATE", {
        key,
        dismissedAt: dismissedAtMap[key],
        now,
        isCoolingDown,
      });

      if (isCoolingDown && !overrideCondition) return false;

      return true;
    });
  }, [identitySuggestions, dismissedAtMap, nowTick, validation, summaryInsights.trend]);

  const cooldownEligibleSuggestions = useMemo(() => {
    const now = nowTick;

    return suggestionsAfterDismissCooldown.filter((s) => {
      const key = getSuggestionKey(s);

      const lastShown = suggestionCooldownMap[key] ?? 0;
      const isCoolingDown = lastShown > 0 && now - lastShown < COOLDOWN_MS;

      const isNew = suggestionCooldownMap[key] == null;

      const prevVal = previousValidationRef.current;
      const prevTrend = previousTrendRef.current;

      const validationChanged =
        prevVal != null &&
        (prevVal.skills !== validation.skills ||
          prevVal.competitor !== validation.competitor ||
          prevVal.experience !== validation.experience);

      const trendChanged = prevTrend != null && prevTrend !== summaryInsights.trend;

      if (isNew) return true;
      if (validationChanged) return true;
      if (trendChanged) return true;

      return !isCoolingDown;
    });
  }, [suggestionsAfterDismissCooldown, suggestionCooldownMap, nowTick, validation, summaryInsights.trend]);

  const finalSuggestions = useMemo(() => {
    const weightedSuggestions = cooldownEligibleSuggestions.map((s) => {
      const key = getSuggestionKey(s);
      const interaction = suggestionInteractions[key];

      if (!interaction) return s;

      let adjustedConfidence = s.confidence;
      let adjustedPriority = s.priority;

      if (interaction.accepted > 0) {
        adjustedConfidence += 0.05 * interaction.accepted;
        adjustedPriority += 0.5;
      }

      if (interaction.dismissed > 0) {
        adjustedConfidence -= 0.05 * interaction.dismissed;
        adjustedPriority -= 0.5;
      }

      return {
        ...s,
        confidence: Math.max(0, Math.min(adjustedConfidence, 1)),
        priority: adjustedPriority,
      };
    });

    return weightedSuggestions
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.confidence - a.confidence;
      })
      .slice(0, 2);
  }, [cooldownEligibleSuggestions, suggestionInteractions]);

  const currentSuggestionKeys = new Set(finalSuggestions.map(getSuggestionKey));
  const resurfacedKeys = new Set<string>();
  currentSuggestionKeys.forEach((key) => {
    const wasDismissed = dismissedAtMap[key];
    const isNowVisible = currentSuggestionKeys.has(key);

    if (wasDismissed && isNowVisible) {
      resurfacedKeys.add(key);
    }
  });
  resurfacedKeysRef.current = resurfacedKeys;

  const eligibleSuggestionKeysSignature = useMemo(
    () => [...cooldownEligibleSuggestions].map(getSuggestionKey).sort().join("\u0001"),
    [cooldownEligibleSuggestions],
  );

  /** Stamp cooldown when a suggestion leaves the eligible set (avoids flicker from stamping on every render). */
  useEffect(() => {
    const currentKeys = new Set(cooldownEligibleSuggestions.map((s) => getSuggestionKey(s)));
    const prevKeys = prevVisibleSuggestionKeysRef.current;

    setSuggestionCooldownMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of prevKeys) {
        if (!currentKeys.has(key)) {
          next[key] = Date.now();
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    prevVisibleSuggestionKeysRef.current = currentKeys;
  }, [eligibleSuggestionKeysSignature, cooldownEligibleSuggestions]);

  const explanation = useMemo(
    () =>
      deriveSummaryExplanation({
        identityScore: identityScore.score,
        phase: identityScore.phase,
        beltRank: athleteForSummary?.beltRank,
        declaredSkills: athleteForSummary?.declaredSkills,
        sessionCount: sessions?.length ?? 0,
        competitionCount: competitions?.length ?? 0,
        signals,
        trend: summaryInsights.trend,
      }),
    [
      athleteForSummary?.beltRank,
      athleteForSummary?.declaredSkills,
      competitionSliceFingerprint,
      identityScore.phase,
      identityScore.score,
      sessions?.length,
      signals,
      summaryInsights.trend,
    ],
  );

  const hybridConfidence = useMemo(
    () =>
      hasRealData
        ? {
            ...signals,
            blendedFocus: summaryInsights.focus ?? undefined,
            focusMode: summaryInsights.focusMode,
            trend: summaryInsights.trend,
            trendFeedback: summaryInsights.trendFeedback,
            postSessionFeedback: summaryInsights.postSessionFeedback,
          }
        : {
            hasData: true as const,
            isIdentityBased: true as const,
            confidenceScore: identityScore.score,
            phase: identityScore.phase,
            identityFocus,
            blendedFocus: summaryInsights.focus ?? undefined,
            focusMode: summaryInsights.focusMode,
            trend: summaryInsights.trend,
            trendFeedback: summaryInsights.trendFeedback,
            postSessionFeedback: summaryInsights.postSessionFeedback,
          },
    [
      hasRealData,
      identityFocus,
      identityScore.phase,
      identityScore.score,
      signals,
      summaryInsights.focus,
      summaryInsights.focusMode,
      summaryInsights.postSessionFeedback,
      summaryInsights.trend,
      summaryInsights.trendFeedback,
    ],
  );

  const resolvedWeeklySharedAthleteId = useMemo(() => {
    if (!weeklySessionSnapshot) return null;
    return resolveWeeklySharedAthleteIdForParentSnapshot(
      activeAthleteId,
      kidsById,
      weeklySessionSnapshot,
    );
  }, [activeAthleteId, kidsById, weeklySessionSnapshot]);

  useEffect(() => {
    if (!__DEV__ || !summaryTraceReady) return;
    devLogAuthorityChainStage("4_resolve_weekly_shared_athlete_id", {
      parentAthleteId: activeAthleteId,
      linkedKidId: summaryLinkedKidId,
      resolvedWeeklySharedAthleteId,
      weeklyKeysAvailable: Object.keys(weeklySessionSnapshot?.weeklyByAthleteId ?? {}),
      slotForResolvedId: resolvedWeeklySharedAthleteId
        ? weeklySessionSnapshot?.weeklyByAthleteId?.[resolvedWeeklySharedAthleteId] ?? null
        : null,
    });
  }, [
    activeAthleteId,
    resolvedWeeklySharedAthleteId,
    summaryLinkedKidId,
    summaryTraceReady,
    weeklySessionSnapshot,
  ]);

  const weeklySyncDoc = useMemo(() => {
    const weeklyKeysAvailable = Object.keys(weeklySessionSnapshot?.weeklyByAthleteId ?? {});
    const hasWeeklyByAthleteId = weeklyKeysAvailable.length > 0;
    const weeklyKeySyncedNames = namesByIdFromSyncedAthletes(weeklySessionSnapshot?.athletes);
    const weeklyKeyKidNames = kidsById ? namesByIdFromKids(kidsById) : new Map<string, string>();
    const weeklyKeyRosterNames = namesByIdFromParentAthletes(operatingAthleteRoster);
    const weeklyKeyMappings = weeklyKeysAvailable.map((sharedAthleteId) => ({
      sharedAthleteId,
      athleteName:
        weeklyKeySyncedNames.get(sharedAthleteId)?.trim() ||
        weeklyKeyKidNames.get(sharedAthleteId)?.trim() ||
        weeklyKeyRosterNames.get(sharedAthleteId)?.trim() ||
        null,
    }));
    const weeklyDuplicateNameSharedIds = duplicateSharedIdsByAthleteName(weeklyKeyMappings);
    const weeklyContainmentBroken = Object.keys(weeklyDuplicateNameSharedIds).length > 0;
    if (summaryTraceReady) {
      console.log("[ATHLETE TRACE][SUMMARY]", {
      athleteName: activeAthleteName.trim() || null,
      activeAthleteId: activeAthleteId.trim() || null,
      selectedAthleteId: activeAthleteId.trim() || null,
      sharedAthleteId: activeAthleteId.trim() || null,
      linkedKidId:
        typeof summaryLinkedKidId === "string" && summaryLinkedKidId.trim()
          ? summaryLinkedKidId.trim()
          : null,
      resolvedWeeklySharedAthleteId: resolvedWeeklySharedAthleteId ?? null,
      hasWeeklyByAthleteId,
      weeklyKeysAvailable,
      weeklyKeyMappings,
      weeklyDuplicateNameSharedIds,
      weeklyContainmentBroken,
      routeSegment: segments.join("/"),
      screen: "summary",
      });
    }
    const doc = weeklySessionSnapshot
      ? resolveWeeklyDoc(weeklySessionSnapshot, resolvedWeeklySharedAthleteId)
      : null;
    if (__DEV__ && summaryTraceReady) {
      const sid = resolvedWeeklySharedAthleteId;
      const slot =
        sid && weeklySessionSnapshot?.weeklyByAthleteId
          ? weeklySessionSnapshot.weeklyByAthleteId[sid]
          : undefined;
      const invite = weeklySessionSnapshot?.weekly ?? null;
      let resolvedDocSource: "weeklyByAthleteId" | "invite.weekly" | "unknown" | "none" = "none";
      if (doc) {
        if (
          sid &&
          slot != null &&
          slot.headline === doc.headline &&
          slot.updatedAt === doc.updatedAt
        ) {
          resolvedDocSource = "weeklyByAthleteId";
        } else if (
          invite != null &&
          invite.headline === doc.headline &&
          invite.updatedAt === doc.updatedAt
        ) {
          resolvedDocSource = "invite.weekly";
        } else {
          resolvedDocSource = "unknown";
        }
      }
      devLogAuthorityChainStage("5_resolve_weekly_doc", {
        resolvedWeeklySharedAthleteId: sid,
        resolvedDocSource,
        headline: doc?.headline?.slice(0, 120) ?? null,
        systemKey: doc?.systemKey ?? null,
        slotHeadline: slot?.headline?.slice(0, 120) ?? null,
        slotSystemKey: slot?.systemKey ?? null,
        slotIsNull: sid ? slot === null : null,
        slotMissingKey: sid ? !(sid in (weeklySessionSnapshot?.weeklyByAthleteId ?? {})) : null,
      });
      console.log("[SUMMARY WEEKLY TRACE] resolveWeeklyDoc+snapshot", {
        path: "SummaryScreen.weeklySyncDoc useMemo → resolveWeeklyDoc(session, resolvedWeeklySharedAthleteId)",
        athleteId: activeAthleteId,
        linkedKidId: summaryLinkedKidId,
        resolvedWeeklySharedAthleteId: sid,
        resolvedDocSource,
        snapshotHydration: weeklySessionSourceRef.current,
        headline: doc?.headline?.slice(0, 120) ?? null,
        weeklyUpdatedAt: doc?.updatedAt ?? null,
        systemKey: doc?.systemKey ?? null,
        weeklyKeysAvailable: Object.keys(weeklySessionSnapshot?.weeklyByAthleteId ?? {}),
        slotHeadline: slot?.headline?.slice(0, 120) ?? null,
        slotSystemKey: slot?.systemKey ?? null,
        inviteHeadline: invite?.headline?.slice(0, 120) ?? null,
        inviteSystemKey: invite?.systemKey ?? null,
        at: new Date().toISOString(),
      });
    }
    return doc;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- [ATHLETE TRACE][SUMMARY]: log reads name/segments without widening weekly doc memo
  }, [
    activeAthleteId,
    resolvedWeeklySharedAthleteId,
    summaryLinkedKidId,
    summaryTraceReady,
    weeklySessionSnapshot,
  ]);

  const coachWeeklyForSummary = useMemo(() => {
    const built =
      weeklySyncDoc
        ? {
            headline: weeklySyncDoc.headline,
            body: weeklySyncDoc.body,
            systemKey: weeklySyncDoc.systemKey ?? null,
          }
        : null;
    if (__DEV__ && summaryTraceReady) {
      devLogAuthorityChainStage("6_coach_weekly_for_summary", {
        builtFromWeeklySyncDoc: Boolean(weeklySyncDoc),
        headline: built?.headline?.slice(0, 120) ?? null,
        systemKey: built?.systemKey ?? null,
        resolvedWeeklySharedAthleteId,
        weekStartYMD: weeklySyncDoc?.weekStartYMD ?? null,
        coachWeeklyWillBeNull: built == null,
      });
      console.log("[SYSTEMKEY TRACE SUMMARY]", {
        traceStage: "10_SummaryScreen_coachWeeklyForSummary",
        headline: built?.headline?.slice(0, 120) ?? null,
        systemKey: built?.systemKey ?? null,
        athleteId: resolvedWeeklySharedAthleteId ?? null,
        weekStartYMD: weeklySyncDoc?.weekStartYMD ?? null,
        keyExistsOnObject:
          built != null && Object.prototype.hasOwnProperty.call(built, "systemKey"),
        source: "weeklySyncDoc → coachWeeklyForSummary_useMemo",
      });
    }
    return built;
  }, [summaryTraceReady, weeklySyncDoc, resolvedWeeklySharedAthleteId]);

  useEffect(() => {
    if (!__DEV__ || !summaryTraceReady) return;
    const kidId =
      typeof summaryLinkedKidId === "string" && summaryLinkedKidId.trim()
        ? summaryLinkedKidId.trim()
        : null;
    if (!kidId && !activeAthleteId) return;

    void (async () => {
      const weekStart = startOfWeekMondayYMD(todayYMD());
      const localRow = kidId
        ? await getLatestKidWeeklyFocusForWeek(kidId, weekStart)
        : null;
      const coachTitle = localRow?.title?.trim() ?? null;
      const parentDocSlice = weeklySlice(weeklySyncDoc);
      const coachWeeklySlice = weeklySlice(
        coachWeeklyForSummary
          ? {
              headline: coachWeeklyForSummary.headline,
              systemKey: coachWeeklyForSummary.systemKey,
              weekStartYMD: weeklySyncDoc?.weekStartYMD,
              updatedAt: weeklySyncDoc?.updatedAt,
            }
          : null,
      );

      devLogAuthorityChainStage("9_coach_dashboard_local_weekly", {
        kidId,
        selector: "coachKidStore.getLatestKidWeeklyFocusForWeek",
        weeklyFocusTitle: coachTitle,
        weeklyFocusSystemKey: localRow?.systemKey?.trim() ?? null,
      });

      devLogAuthorityChainComparison({
        parentAthleteId: activeAthleteId?.trim() || null,
        linkedKidId: kidId,
        resolvedWeeklySharedAthleteId,
        coachDashboard: {
          selector: "coachKidStore.getLatestKidWeeklyFocusForWeek",
          weeklyFocusTitle: coachTitle,
          weeklyFocusSystemKey: localRow?.systemKey?.trim() ?? null,
        },
        parentSummary: {
          selector: "resolveWeeklyDoc(weeklySessionSnapshot, resolvedWeeklySharedAthleteId)",
          hydrationSource: weeklySessionSourceRef.current,
          weeklySyncDoc: parentDocSlice,
          coachWeeklyForSummary: coachWeeklySlice,
        },
        divergence: devDeriveAuthorityChainDivergence(coachTitle, parentDocSlice),
      });
    })();
  }, [
    activeAthleteId,
    coachWeeklyForSummary,
    resolvedWeeklySharedAthleteId,
    summaryLinkedKidId,
    summaryTraceReady,
    weeklySyncDoc,
  ]);

  const progressionMemoryWeekStart = weeklySyncDoc?.weekStartYMD ?? null;
  const progressionMemorySystemKey = weeklySyncDoc?.systemKey ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!activeAthleteId) {
      setLastActionState(null);
      lastProgressionMemoryScopeRef.current = null;
      return;
    }

    const scopeTicket = `${activeAthleteId}|${progressionMemoryWeekStart ?? ""}|${progressionMemorySystemKey ?? ""}`;
    if (lastProgressionMemoryScopeRef.current !== scopeTicket) {
      lastProgressionMemoryScopeRef.current = scopeTicket;
      setLastActionState(null);
    }

    void (async () => {
      const val = await getLastSummaryAction(
        activeAthleteId,
        progressionMemoryWeekStart,
        progressionMemorySystemKey,
      );
      if (!cancelled) setLastActionState(val);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeAthleteId,
    progressionMemoryWeekStart,
    progressionMemorySystemKey,
  ]);

  const summaryV2ViewModel = useMemo(() => {
    if (__DEV__) {
      console.log("[SUMMARY_FLOW_TRACE] 3_sessions_entering_summary_builder", {
        flow: summaryFlowTraceRole,
        activeAthleteId,
        linkedKidId: summaryLinkedKidId,
        sessionCountAfterTrainingScopeFilter: sessions.length,
        sampleLineage: sessions.slice(0, 5).map((s) => ({
          id: s.id,
          sharedAthleteId: (s.sharedAthleteId ?? "").trim() || null,
          kidId: (s.kidId ?? "").trim() || null,
          trainingLoggedByRole: s.trainingLoggedByRole ?? null,
        })),
      });
    }
    const signals = hybridConfidence;
    const identityBased =
      "isIdentityBased" in signals && signals.isIdentityBased === true;
    const hasData = identityBased ? true : signals.hasData;
    const confidence = identityBased ? signals.confidenceScore : signals.confidence;
    const topSystem = identityBased ? null : signals.patterns.topSystem;
    const topTechnique = identityBased ? null : signals.patterns.topTechnique;
    const focus = topSystem || topTechnique;
    let focusText: string | null | undefined = focus;
    if (identityBased && signals.identityFocus) {
      focusText = signals.identityFocus;
    }
    if (signals.blendedFocus?.trim()) {
      focusText = signals.blendedFocus.trim();
    }
    const identityFocusForVm = identityBased ? signals.identityFocus : focusText;
    const snapForSelect = extractSignalSnapshot(signals);
    const coachSystemKeyForVm = coachWeeklyForSummary?.systemKey?.trim() || null;
    const selectedSystemKey = selectFocusSystem({
      coachSystem: coachSystemKeyForVm,
      signalSystem: snapForSelect.topSystem,
      identityFocus: identityFocusForVm,
    });
    if (__DEV__) {
      console.log("[SUMMARY DUAL VM AUDIT] SummaryScreen.pre-buildSummaryViewModel", {
        athleteId: activeAthleteId,
        weeklyHeadline: weeklySyncDoc?.headline?.slice(0, 120) ?? null,
        weeklySystemKey: weeklySyncDoc?.systemKey ?? null,
        coachWeekly: coachWeeklyForSummary,
        resolvedWeeklyDoc: weeklySyncDoc,
        selectedSystemKey,
      });
    }
    console.log("[SUMMARY_RECOMPUTE]", {
      athleteId: activeAthleteId,
      competitionCount: competitions?.length ?? 0,
      sessionCount: weeklySessionCountForSummary,
      identityScore: identityScore.score,
    });
    const vm = buildSummaryViewModel({
      signals,
      identityScore: confidence,
      phase: identityBased ? signals.phase : hasData ? "experienced" : "cold",
      identityFocus: identityFocusForVm,
      coachWeekly: coachWeeklyForSummary,
      lastAction: lastAction,
      sessionCount: weeklySessionCountForSummary,
      competitionCount: competitions?.length ?? 0,
      devSummaryFlowTraceRole: summaryFlowTraceRole,
      devOperatorAthleteId: activeAthleteId,
    });
    if (__DEV__) {
      const hybrid = hybridConfidence;
      const hybridCompetition =
        "competition" in hybrid && hybrid.competition ? hybrid.competition : null;
      devLogCompetitionSummaryTrace({
        stage: "SummaryScreen.summaryV2ViewModel_useMemo_post_buildSummaryViewModel",
        memoSelectorChain:
          "summaryV2ViewModel useMemo → hybridConfidence (signals + insights) → extractSignalSnapshot → selectFocusSystem → buildSummaryViewModel",
        useAthleteDataCompetitionLength: competitions?.length ?? 0,
        hybridConfidenceCompetitionCount: hybridCompetition?.competitionCount ?? null,
        hybridConfidenceTotalMatches: hybridCompetition?.totalMatches ?? null,
      });
    }
    return vm;
  }, [
    activeAthleteId,
    coachWeeklyForSummary,
    competitionSliceFingerprint,
    hybridConfidence,
    identityScore.score,
    lastAction,
    sessions,
    weeklySessionCountForSummary,
    summaryFlowTraceRole,
    summaryLinkedKidId,
    weeklySessionSnapshot,
    weeklySyncDoc,
  ]);

  useEffect(() => {
    if (!activeAthleteId) return;
    if (summaryV2ViewModel.stepKey) {
      void setLastSummaryAction(
        activeAthleteId,
        progressionMemoryWeekStart,
        progressionMemorySystemKey,
        summaryV2ViewModel.stepKey,
      );
    }
  }, [
    activeAthleteId,
    progressionMemoryWeekStart,
    progressionMemorySystemKey,
    summaryV2ViewModel?.stepKey,
  ]);

  const { entries: focusCompetitionEntries } = useSummaryCompetitionFocusInput({
    deviceRole,
    sharedAthleteId: activeAthleteId,
    legacyCompetitions: competitions,
    competitionSliceFingerprint,
    hydrationVersion: coachSyncHydrationVersion,
    weeklySessionSnapshot,
  });

  const competitionSkillFocus = useMemo(
    () =>
      activeAthleteId
        ? deriveCompetitionTrainingSkillFocus({
            competitionsWithMatches: focusCompetitionEntries,
            sessions,
          })
        : null,
    [activeAthleteId, focusCompetitionEntries, sessions],
  );

  const competitionSkillFocusHint =
    competitionSkillFocus?.eligibleForSummaryLine &&
    competitionSkillFocus.highConfidence &&
    competitionSkillFocus.summaryLabel
      ? competitionSkillFocus.summaryLabel
      : undefined;

  const recentSubmissionTypesLine = useMemo(
    () => recentSubmissionTypesSummaryLine(competitions),
    [competitions],
  );

  const principalFocusBucket = useMemo(
    () => principalTrainingSkillBucketFromDerivedFocus(competitionSkillFocus),
    [competitionSkillFocus],
  );

  const bucketFocusEvidenceLine = useMemo(
    () =>
      resolvePrincipalBucketEvidenceLine(
        principalFocusBucket,
        signals.competition.bucketOutcomeTrends,
      ),
    [principalFocusBucket, signals.competition.bucketOutcomeTrends],
  );

  if (!hydrationReady) {
    return (
      <View style={styles.bootScreen}>
        <ActivityIndicator size="large" color="#c7f36b" />
      </View>
    );
  }

  if (__DEV__ && deviceRole === "coach") {
    const kid = summaryLinkedKidId ? kidsById[summaryLinkedKidId] : undefined;
    logCoachHydrationResolveTrace("summary_hydration", {
      sharedAthleteId: activeAthleteId.trim() || null,
      resolvedAthleteId: activeAthleteId.trim() || null,
      authorityBootstrapState: authorityBootstrapState ?? null,
      linkedKidId: summaryLinkedKidId,
      inviteId: kid?.sharedFromInviteTokenNorm?.trim() || null,
      projectionExists: operatingAthleteRoster.some((a) => a.id.trim() === activeAthleteId.trim()),
      coachProjectionExists: operatingAthleteRoster.length > 0,
      nullReturnReason: !activeAthleteId.trim()
        ? authorityBootstrapState === "ready"
          ? "ready_bootstrap_but_empty_oai"
          : `bootstrap_${authorityBootstrapState ?? "unknown"}`
        : null,
      extra: { rosterLen: operatingAthleteRoster.length },
    });
  }

  if (
    deviceRole === "coach" &&
    (authorityBootstrapState === "coach_unresolved" ||
      (authorityBootstrapState === "coach_disconnected" &&
        coachOperatingAthleteChoices.length > 0))
  ) {
    return (
      <SafeAreaView style={styles.ctaScreen} edges={["top"]}>
        <Text style={styles.ctaTitle}>Summary</Text>
        <Text style={styles.ctaSubtitle}>
          {authorityBootstrapState === "coach_disconnected"
            ? "Coach roster could not be refreshed from the server. Choose an athlete from your locally linked roster to continue."
            : "Several athletes are linked on this coach device. Choose one for Summary and weekly alignment."}
        </Text>
        <View style={styles.selectorSection}>
          <SummaryAthleteSwitcher
            activeAthleteId={activeAthleteId}
            athletes={summarySwitcherAthletes}
            onChange={handleSelectAthlete}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (deviceRole === "coach" && authorityBootstrapState === "coach_disconnected") {
    return (
      <SafeAreaView style={styles.ctaScreen} edges={["top"]}>
        <Text style={styles.ctaTitle}>Summary</Text>
        <Text style={styles.ctaSubtitle}>
          Linked coach invites are active, but the roster could not be refreshed. Check your connection and open Summary again to retry.
        </Text>
      </SafeAreaView>
    );
  }

  if (deviceRole === "parent" && authorityBootstrapState === "parent_unresolved") {
    return (
      <SafeAreaView style={styles.ctaScreen} edges={["top"]}>
        <Text style={styles.ctaTitle}>Summary</Text>
        <Text style={styles.ctaSubtitle}>
          Several athletes are linked on this device. Choose one for Summary and weekly alignment.
        </Text>
        <View style={styles.selectorSection}>
          <SummaryAthleteSwitcher
            activeAthleteId={activeAthleteId}
            athletes={summarySwitcherAthletes}
            onChange={handleSelectAthlete}
          />
        </View>
      </SafeAreaView>
    );
  }

  const parentRuntimeEmpty =
    deviceRole === "parent" &&
    (operatingAthleteRoster.length === 0 || authorityBootstrapState === "empty");

  if (parentRuntimeEmpty) {
    if (
      __DEV__ &&
      operatingAthleteRoster.length > 0 &&
      authorityBootstrapState !== "empty"
    ) {
      console.error(
        "[authority/invariant] parent Summary must not render empty CTA when operating roster is non-empty and bootstrap is not empty",
        {
          rosterLen: operatingAthleteRoster.length,
          authorityBootstrapState,
        },
      );
    }
    return (
      <SafeAreaView style={styles.ctaScreen} edges={["top"]}>
        <Text style={styles.ctaTitle}>Summary</Text>
        <Text style={styles.ctaSubtitle}>
          Add an athlete on this device to see training insights here.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/summary/add-athlete")}
          style={({ pressed }) => [styles.ctaBtn, pressed ? styles.ctaBtnPressed : null]}
        >
          <Text style={styles.ctaBtnText}>Create Athlete</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (deviceRole === "coach" && authorityBootstrapState === "empty") {
    return (
      <SafeAreaView style={styles.ctaScreen} edges={["top"]}>
        <Text style={styles.ctaTitle}>Summary</Text>
        <Text style={styles.ctaSubtitle}>
          No linked athletes on this coach device yet. When a parent accepts a link, roster rows appear here.
        </Text>
      </SafeAreaView>
    );
  }

  if (!activeAthleteId.trim()) {
    if (
      deviceRole === "parent" &&
      operatingAthleteRoster.length > 0 &&
      authorityBootstrapState === "ready"
    ) {
      if (__DEV__) {
        console.error(
          "[authority/invariant] parent Summary resolved OAI missing while roster ready — showing picker",
          { rosterLen: operatingAthleteRoster.length },
        );
      }
      return (
        <SafeAreaView style={styles.ctaScreen} edges={["top"]}>
          <Text style={styles.ctaTitle}>Summary</Text>
          <Text style={styles.ctaSubtitle}>
            Choose an athlete on this device to continue.
          </Text>
          <View style={styles.selectorSection}>
            <SummaryAthleteSwitcher
              activeAthleteId={activeAthleteId}
              athletes={summarySwitcherAthletes}
              onChange={handleSelectAthlete}
            />
          </View>
        </SafeAreaView>
      );
    }
    if (__DEV__ && deviceRole === "parent") {
      if (operatingAthleteRoster.length > 0 && authorityBootstrapState !== "empty") {
        console.error(
          "[authority/invariant] parent Summary must not render Create Athlete CTA when operating roster is non-empty and bootstrap is not empty",
          { authorityBootstrapState, rosterLen: operatingAthleteRoster.length },
        );
      }
    }
    return (
      <SafeAreaView style={styles.ctaScreen} edges={["top"]}>
        <Text style={styles.ctaTitle}>Summary</Text>
        <Text style={styles.ctaSubtitle}>
          Add an athlete on this device to see training insights here.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/summary/add-athlete")}
          style={({ pressed }) => [styles.ctaBtn, pressed ? styles.ctaBtnPressed : null]}
        >
          <Text style={styles.ctaBtnText}>Create Athlete</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
    <ScrollView
      style={styles.screenInner}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={summaryRefreshing}
          onRefresh={onSummaryRefresh}
          tintColor="#c7f36b"
          colors={["#c7f36b"]}
        />
      }
    >
      <OperatingHeader
        mode="athlete"
        semanticLead
        eyebrow="Summary / Identity"
        title="A mirror of the athlete"
        athlete={{
          name: activeAthleteName || "Athlete",
          initials: initialsFromName(activeAthleteName),
          meta: summaryOperatingHeaderMeta,
          identityHighlight: true,
        }}
        actions={[
          {
            label: "Athlete actions",
            icon: "⋯",
            onPress: handleOpenManageAthlete,
          },
          {
            label: "Add athlete",
            icon: "+",
            onPress: () => router.push("/summary/add-athlete"),
          },
          {
            label: "Device profile and settings",
            icon: "⚙",
            accessibilityLabel: "Device profile and settings",
            onPress: () => router.push("/profile"),
          },
        ]}
      />

      <LineageIntegrityDevHint />

      <View style={styles.identityScoreRow}>
        <Text style={styles.identityScoreText}>
          Identity score · {identityScore.score}
        </Text>
      </View>

      {summarySwitcherAthletes.length > 0 ? (
        <View style={styles.selectorSection}>
          <SummaryAthleteSwitcher
            activeAthleteId={activeAthleteId}
            athletes={summarySwitcherAthletes}
            onChange={handleSelectAthlete}
          />
        </View>
      ) : null}

      <View style={styles.skillsSection}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: recognizedSkillsExpanded }}
          accessibilityLabel={
            recognizedSkillsExpanded ? "Collapse recognized skills" : "Expand recognized skills"
          }
          hitSlop={8}
          onPress={() => {
            if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
              UIManager.setLayoutAnimationEnabledExperimental(true);
            }
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setRecognizedSkillsExpanded((v) => !v);
          }}
          style={[
            styles.skillsHeaderRow,
            recognizedSkillsExpanded ? styles.skillsHeaderRowExpanded : null,
          ]}
        >
          <Text style={styles.skillsTitle}>Recognized Skills</Text>
          <Text style={styles.skillsChevron} importantForAccessibility="no">
            {recognizedSkillsExpanded ? "▼" : "▶"}
          </Text>
        </Pressable>
        {recognizedSkillsExpanded ? (
          declaredSkills.length > 0 ? (
            <View style={styles.skillsRow}>
              {declaredSkills.map((skill) => (
                <View key={skill} style={styles.skillChip}>
                  <Text style={styles.skillText}>{formatSkill(skill)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.skillsEmpty}>
              Add skills to help us understand your game
            </Text>
          )
        ) : null}
      </View>

      <View style={styles.section}>
        <SummaryHeroCard
          signals={hybridConfidence}
          lastAction={lastAction}
          coachWeekly={coachWeeklyForSummary}
          sessionCount={weeklySessionCountForSummary}
          competitionCount={competitions?.length ?? 0}
          devDualVmAudit={
            __DEV__
              ? {
                  athleteId: activeAthleteId,
                  resolvedWeeklyDoc: weeklySyncDoc,
                }
              : undefined
          }
          emptyInsightCopy={personalizedEmptyInsight}
          identityReason={explanation.identityReason}
          signalReason={explanation.signalReason}
          nextAction={explanation.nextAction}
          identityValidation={validation}
          identitySuggestions={finalSuggestions}
          resurfacedSuggestionKeys={resurfacedKeysRef.current}
          onApplySuggestion={handleApplySuggestion}
          onDismissSuggestion={handleDismissSuggestion}
          suggestionProfile={{
            declaredSkills: athleteForSummary?.declaredSkills,
            isCompetitor: athleteForSummary?.isCompetitor,
            experienceLevel: athleteForSummary?.experienceLevel,
          }}
        />
      </View>

      <View style={styles.section}>
        <SummaryWeekCard
          weeklySessionCount={signals.frequency.weeklySessionCount}
          topTechniques={signals.techniques.topTechniques}
        />
      </View>

      <View style={styles.section}>
        <SummaryPatternsCard
          gear={signals.gear}
          topSystem={signals.patterns.topSystem}
          topTechnique={signals.patterns.topTechnique}
          topTechniques={signals.techniques.topTechniques}
        />
      </View>

      <View style={styles.section}>
        <SummaryConsistencyCard
          weeklySessionCount={signals.consistency.currentWeekCount}
          streak={signals.consistency.streak}
        />
      </View>

      <View style={styles.lastSection}>
        <SummaryCompetitionCard
          averageMatchTime={signals.competition.averageMatchTime}
          competitionCount={signals.competition.competitionCount}
          fastestSubmission={signals.competition.fastestSubmission}
          lastCompetitionDate={signals.competition.lastCompetitionDate}
          lastCompetitionResult={signals.competition.lastCompetitionResult}
          lastCompetitionLosses={signals.competition.lastCompetitionLosses}
          lastCompetitionMatchCount={signals.competition.lastCompetitionMatchCount}
          lastCompetitionName={signals.competition.lastCompetitionName}
          lastCompetitionWins={signals.competition.lastCompetitionWins}
          podiumCountLast30Days={signals.competition.podiumCountLast30Days}
          podiumCountLast90Days={signals.competition.podiumCountLast90Days}
          record={signals.competition.record}
          recentSubmissionTypesLine={recentSubmissionTypesLine ?? undefined}
          submissionRate={signals.competition.submissionRate}
          totalMatches={signals.competition.totalMatches}
          winRate={signals.competition.winRate}
          winStyle={signals.competition.winStyle}
          placementTrend={signals.competition.placementTrend}
          skillFocusHint={competitionSkillFocusHint}
          bucketFocusEvidenceLine={bucketFocusEvidenceLine ?? undefined}
        />
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    backgroundColor: "#0b0f12",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaScreen: {
    flex: 1,
    backgroundColor: "#0b0f12",
    padding: 24,
    justifyContent: "center",
  },
  ctaTitle: {
    color: "#f9fafb",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 12,
  },
  ctaSubtitle: {
    color: "#9ca3af",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 28,
  },
  ctaBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#c7f36b",
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaBtnPressed: {
    opacity: 0.88,
  },
  ctaBtnText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  screen: {
    flex: 1,
    backgroundColor: "#0b0f12",
  },
  screenInner: {
    flex: 1,
    backgroundColor: "#0b0f12",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  headerTitle: {
    flex: 1,
    color: "#f9fafb",
    fontSize: 18,
    fontWeight: "800",
  },
  headerMeta: {
    color: "#6b7280",
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerMenuBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  headerMenuBtnPressed: {
    opacity: 0.82,
  },
  headerMenuGlyph: {
    color: "#9ca3af",
    fontSize: 22,
    fontWeight: "700",
    marginTop: -4,
    letterSpacing: 1,
  },
  headerAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAddBtnPressed: {
    opacity: 0.82,
  },
  headerAddGlyph: {
    color: "#c7f36b",
    fontSize: 26,
    fontWeight: "700",
    marginTop: -2,
  },
  identityScoreRow: {
    marginTop: 8,
    paddingVertical: 5,
    paddingHorizontal: 2,
    borderRadius: 8,
  },
  identityScoreText: {
    color: "#777f89",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  selectorSection: {
    marginBottom: 18,
    paddingTop: 2,
  },
  skillsSection: {
    marginTop: 13,
    paddingTop: 1,
  },
  skillsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  skillsHeaderRowExpanded: {
    marginBottom: 8,
  },
  skillsTitle: {
    color: "#a9b0b8",
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  skillsChevron: {
    color: "#a9b0b8",
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  skillChip: {
    borderWidth: 1,
    borderColor: "rgba(236, 241, 245, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#171b20",
  },
  skillText: {
    color: "#c7cdd5",
    fontSize: 12,
    fontWeight: "800",
  },
  skillsEmpty: {
    color: "#666",
    fontSize: 12,
  },
  section: {
    marginBottom: 30,
  },
  lastSection: {
    marginBottom: 0,
  },
});
