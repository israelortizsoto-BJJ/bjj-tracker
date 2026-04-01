import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Alert,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import {
  Swipeable,
  TouchableOpacity as GestureTouchableOpacity,
} from "react-native-gesture-handler";

import {
  getAssignmentsById,
  getCoachLinks,
  getCoachesById,
  getCompletionReceiptsQueue,
  getCoachPilotPreviewItems,
  getPackEnrollments,
  getPacksById,
  setAssignmentsById as persistAssignmentsById,
  setCoachesById as persistCoachesById,
  setCompletionReceiptsQueue as persistCompletionReceiptsQueue,
  setCoachPilotPreviewItems,
} from "../../../src/storage/coachShareStore";
import {
  getCachedWeeklyForLinkToken,
  setCachedWeeklyForLinkToken,
} from "../../../src/storage/coachWeeklySyncCacheStore";
import {
  getLastSeenUpdatedAt,
  setLastSeenUpdatedAt,
} from "../../../src/storage/parentWeeklyLastSeenStore";
import { isDev } from "../../../src/config/runtime";
import {
  activeCoachLinksForParentLinkedUi,
  buildDevParentWeeklyLinkedStateTrace,
  parentKidCoherentlyLinkedToInviteToken,
  parentStrictWeeklyLinkedCoachLinksForUi,
} from "../../../src/coachShare/coachLinkBinding";
import { normalizeInviteLinkToken } from "../../../src/coachShare/inviteLinkToken";
import { coachSyncFetchSession } from "../../../src/services/coachWeeklySyncApi";
import type { SyncedWeeklyMessagePayload } from "../../../src/types/coachWeeklySync";
import type { CoachPilotPreviewItem } from "../../../src/storage/coachShareStore";
import type {
  AssignmentMap,
  CoachIdentityMap,
  CoachLink,
  CompletionReceipt,
  PackEnrollment,
  ProgramPackMap,
} from "../../../src/types/coachShare";
import {
  familyCompetitionChipForEntry,
  familyCompetitionPromoterFormatLine,
  familyCompetitionResultLabel,
  formatFamilyCompetitionDate,
  formatFamilyCompetitionMonthHeading,
  groupFamilyCompetitionEntriesByMonth,
  kidDisplayNameForId,
  partitionFamilyCompetitionEntries,
  resolveFamilyCompetitionKidId,
  shouldShowFamilyCompetitionResult,
} from "../../../src/family/coachShareCompetitionBuckets";
import { useDeviceRole } from "../../../src/deviceRole/DeviceRoleProvider";
import {
  clearFamilyCompetitionSelectedKidId,
  getFamilyCompetitionSelectedKidId,
  getKidsById,
  setFamilyCompetitionSelectedKidId,
  todayYMD,
} from "../../../src/storage/coachKidStore";
import { StorageKeys } from "../../../src/storage/storageKeys";
import { deleteParentKidCompetitionEntry } from "../../../src/family/parentKidCompetitionDelete";
import { getKidCompetitionEntriesForKid } from "../../../src/storage/kidCompetitionStore";
import type { Session } from "../../../src/types";
import {
  kidCompetitionEntryIsSyncedFromWorker,
  type Kid,
  type KidCompetitionEntry,
  type KidId,
  type KidsById,
} from "../../../src/types/coachKid";
import {
  familyResourceUrlForLinking,
} from "../../../src/coach/familyResourceUrl";
import { buildReadTogetherStoryCards } from "../../../src/family/readTogetherStoryCards";
import { ReadTogetherStoryModal } from "../../../src/family/ReadTogetherStoryModal";

// Build 7 light visual system — calm shell, braver family-facing cards (indigo / lavender / warm cream / soft coral)
const UI = {
  screenBg: "#f3f2f8",
  bgCard: "#fefdff",
  bgCardActive: "#e8e4ff",
  bgHero: "#fff5ec",
  heroBlob1: "rgba(99, 102, 241, 0.14)",
  heroBlob2: "rgba(236, 72, 153, 0.12)",
  border: "#e5e7eb",
  heroBorder: "#e8d4ec",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  primaryFill: "#4f46e5",
  primaryFillPressed: "#4338ca",
  primaryTextOnFill: "#ffffff",
  deleteBg: "#dc2626",
  deleteText: "#ffffff",
  rowMutedBg: "#f9fafb",
  monthBannerBg: "#e8e4f7",
  monthBannerPressed: "#d8d0f0",
  monthListWellBg: "#f3f0ff",
  monthGroupBorder: "#dcd6f0",
  competitionRowBg: "#faf8ff",
  competitionRowBorder: "#e4dff5",
  nextUpcomingFill: "#e0e7ff",
  nextUpcomingBorder: "#818cf8",
  familySectionBg: "#fffaf7",
  familySectionBorder: "#eadcf0",
  addCompetitionBg: "#ede9fe",
  addCompetitionBgPressed: "#ddd6fe",
  addCompetitionBorder: "#c4b5fd",
  progressRail: "#e5e7eb",
  progressRailActive: "#c7d2fe",
  progressDotInactive: "#f3f4f6",
  progressDotActive: "#c7d2fe",
};

/** Richer chip fills for competition rows (labels stable from `familyCompetitionChipForEntry`). */
function familyFacingCompetitionChipStyle(chip: {
  label: string;
  backgroundColor: string;
  textColor: string;
}): { backgroundColor: string; textColor: string } {
  switch (chip.label) {
    case "Coming up":
      return { backgroundColor: "#c7d2fe", textColor: "#312e81" };
    case "Past event":
      return { backgroundColor: "#ede9fe", textColor: "#5b21b6" };
    case "Completed":
      return { backgroundColor: "#bfdbfe", textColor: "#1e3a8a" };
    case "Cancelled":
      return { backgroundColor: "#fed7aa", textColor: "#9a3412" };
    default:
      return { backgroundColor: chip.backgroundColor, textColor: chip.textColor };
  }
}

const CARD_RADIUS = 16;
const SECTION_LABEL = { fontSize: 11, letterSpacing: 1.2, color: "#6b7280", fontWeight: "600" as const };

/** Dev parent weekly: resolve family-competition kid only within kids coherent with the active redeemed weekly invite token. */
function resolveParentWeeklyInviteFilteredFamilyCompKidId(
  kidsById: KidsById,
  storedKidId: string | null | undefined,
  coachLinks: CoachLink[],
  activeInviteTokenNorm: string,
): KidId | null {
  const allowed = Object.values(kidsById)
    .filter(
      (k): k is Kid =>
        Boolean(k?.id) &&
        parentKidCoherentlyLinkedToInviteToken(k, activeInviteTokenNorm, coachLinks),
    )
    .sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }),
    );
  if (allowed.length === 0) return null;
  if (allowed.length === 1) return allowed[0]!.id;
  const trimmed = storedKidId?.trim();
  if (trimmed && allowed.some((k) => k.id === trimmed)) return trimmed;
  return allowed[0]!.id;
}

function Section({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "family";
}) {
  const surface =
    tone === "family"
      ? { backgroundColor: UI.familySectionBg, borderColor: UI.familySectionBorder }
      : { backgroundColor: UI.bgCard, borderColor: UI.border };
  return (
    <View
      style={{
        marginTop: 18,
        padding: 18,
        borderRadius: CARD_RADIUS,
        borderWidth: 1,
        borderColor: surface.borderColor,
        backgroundColor: surface.backgroundColor,
      }}
    >
      <Text style={[SECTION_LABEL, { marginBottom: 10 }]}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

type FamilyCompetitionLoadState = {
  todayYMD: string;
  kidId: string | null;
  kidName: string | null;
  multiKidOnRoster: boolean;
  upcoming: KidCompetitionEntry[];
  recent: KidCompetitionEntry[];
};

type ParentWeeklyPracticeSummary = {
  sessionCountThisWeek: number;
  latestSession: Session | null;
};

const INITIAL_FAMILY_COMPETITION: FamilyCompetitionLoadState = {
  todayYMD: "",
  kidId: null,
  kidName: null,
  multiKidOnRoster: false,
  upcoming: [],
  recent: [],
};

const INITIAL_PRACTICE_SUMMARY: ParentWeeklyPracticeSummary = {
  sessionCountThisWeek: 0,
  latestSession: null,
};

function startOfWeekMondayYMD(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  date.setDate(date.getDate() - diffToMonday);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function readSessionsSafe(raw: string | null): Session[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Session[]) : [];
  } catch {
    return [];
  }
}

function sessionSummaryTitle(session: Session): string {
  const system = (session.system ?? "").trim();
  const technique = (session.technique ?? "").trim();
  if (system && technique) return `${system} · ${technique}`;
  return technique || system || "Practice session";
}

export default function CoachesScreen() {
  const { role } = useDeviceRole();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  /** Dev-only: raw AsyncStorage row counts (long-press title). */
  const [showDebugData, setShowDebugData] = useState(false);
  const [weeklyStoryOpen, setWeeklyStoryOpen] = useState(false);
  const [weeklyStoryStep, setWeeklyStoryStep] = useState(0);
  const [coachLinks, setCoachLinks] = useState<CoachLink[]>([]);
  const [coachesById, setCoachesById] = useState<CoachIdentityMap>({});
  const [packsById, setPacksById] = useState<ProgramPackMap>({});
  const [packEnrollments, setPackEnrollments] = useState<PackEnrollment[]>([]);
  const [assignmentsById, setAssignmentsById] = useState<AssignmentMap>({});
  const [completionReceiptsQueue, setCompletionReceiptsQueue] = useState<
    CompletionReceipt[]
  >([]);
  const [pilotPreviewItems, setPilotPreviewItemsState] = useState<CoachPilotPreviewItem[]>([]);
  const [familyCompetition, setFamilyCompetition] = useState<FamilyCompetitionLoadState>(
    INITIAL_FAMILY_COMPETITION,
  );
  const [weeklySyncDoc, setWeeklySyncDoc] = useState<SyncedWeeklyMessagePayload | null>(null);
  const [weeklySyncFetchFailed, setWeeklySyncFetchFailed] = useState(false);
  const [weeklySyncFetchedAt, setWeeklySyncFetchedAt] = useState<string | null>(null);
  const [weeklySyncFromCache, setWeeklySyncFromCache] = useState(false);
  const [weeklySyncNetworkOk, setWeeklySyncNetworkOk] = useState(false);
  /** Dev + parent: show after successful weekly fetch when `weekly.updatedAt` is newer than local last-seen. */
  const [showNewCoachUpdateBanner, setShowNewCoachUpdateBanner] = useState(false);
  const [practiceSummary, setPracticeSummary] = useState<ParentWeeklyPracticeSummary>(
    INITIAL_PRACTICE_SUMMARY,
  );
  const [kidsByIdState, setKidsByIdState] = useState<KidsById>({});
  /** Invalidates in-flight `loadCoachShareData` family competition writes so delete wins over stale reloads. */
  const applyFamilyCompGenRef = useRef(0);

  const computeParentKidScopedState = useCallback(
    async (kidId: string | null, loadedKidsById: KidsById, today: string) => {
      const rosterCount = Object.keys(loadedKidsById).length;
      let nextFamily: FamilyCompetitionLoadState = {
        todayYMD: today,
        kidId,
        kidName: kidId ? kidDisplayNameForId(loadedKidsById, kidId) : null,
        multiKidOnRoster: rosterCount > 1,
        upcoming: [],
        recent: [],
      };
      if (kidId) {
        const compEntries = await getKidCompetitionEntriesForKid(kidId);
        const part = partitionFamilyCompetitionEntries(compEntries, today);
        nextFamily = {
          ...nextFamily,
          upcoming: part.upcoming,
          recent: part.recent,
        };
      }

      const rawSessions = await AsyncStorage.getItem(StorageKeys.sessions);
      const allSessions = readSessionsSafe(rawSessions).map((s) => ({
        ...s,
        date: s.date || today,
      }));
      let scopedSessions = kidId
        ? allSessions.filter((s) => (s.kidId ?? "").trim() === kidId)
        : allSessions.filter((s) => !(s.kidId ?? "").trim());
      if (role === "parent" && kidId) {
        scopedSessions = scopedSessions.filter((s) => s.trainingLoggedByRole !== "coach");
      }
      const weekStart = startOfWeekMondayYMD(today);
      const thisWeekSessions = scopedSessions
        .filter((s) => s.date >= weekStart && s.date <= today)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      const latestSessionOverall = scopedSessions
        .slice()
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0] ?? null;
      const nextPracticeSummary: ParentWeeklyPracticeSummary = {
        sessionCountThisWeek: thisWeekSessions.length,
        latestSession: latestSessionOverall,
      };

      return { nextFamily, nextPracticeSummary };
    },
    [role],
  );

  const loadCoachShareData = useCallback(async () => {
    setReady(false);

    const [
      loadedCoachLinks,
      loadedCoachesByIdInitial,
      loadedPacksById,
      loadedPackEnrollments,
      loadedAssignmentsById,
      loadedCompletionReceiptsQueue,
      loadedPilotPreviewItems,
      loadedKidsById,
      storedFamilyCompKidId,
    ] = await Promise.all([
      getCoachLinks(),
      getCoachesById(),
      getPacksById(),
      getPackEnrollments(),
      getAssignmentsById(),
      getCompletionReceiptsQueue(),
      getCoachPilotPreviewItems(),
      getKidsById(),
      getFamilyCompetitionSelectedKidId(),
    ]);

    let loadedCoachesById = loadedCoachesByIdInitial;

    let nextShowNewCoachUpdateBanner = false;

    const linksForParentWeeklyFetch =
      role === "parent"
        ? parentStrictWeeklyLinkedCoachLinksForUi(loadedCoachLinks)
        : loadedCoachLinks.filter((l) => l.status === "active");
    const activeWeeklySyncLink =
      role === "parent"
        ? linksForParentWeeklyFetch[0]
        : linksForParentWeeklyFetch.find((l) => l.weeklySync);
    let nextWeeklyDoc: SyncedWeeklyMessagePayload | null = null;
    let nextWeeklyFetchFailed = false;
    let nextWeeklyFetchedAt: string | null = null;
    let nextWeeklyFromCache = false;
    let nextWeeklyNetworkOk = false;

    if (activeWeeklySyncLink?.weeklySync) {
      try {
        const session = await coachSyncFetchSession(
          activeWeeklySyncLink.weeklySync.linkToken,
          activeWeeklySyncLink.weeklySync.apiBaseUrl,
        );
        if (__DEV__) {
          const recap = (session.weekly?.familyCoachRecapNote ?? "").trim();
          console.log("[bjj-parent-weekly-sync-doc]", {
            familyResourceUrl: (session.weekly?.familyResourceUrl ?? "").trim() || null,
            familyResourceLabel: (session.weekly?.familyResourceLabel ?? "").trim() || null,
            fetchedFamilyCoachRecapNoteLen: recap.length,
          });
        }
        nextWeeklyDoc = session.weekly;
        nextWeeklyFetchFailed = false;
        nextWeeklyFromCache = false;
        nextWeeklyNetworkOk = true;
        const nowIso = new Date().toISOString();
        nextWeeklyFetchedAt = nowIso;
        await setCachedWeeklyForLinkToken(
          activeWeeklySyncLink.weeklySync.linkToken,
          session.weekly,
          nowIso,
        );
        const c = session.coach;
        const merged: typeof loadedCoachesById = {
          ...loadedCoachesById,
          [c.id]: {
            id: c.id,
            displayName: c.displayName,
            academyName: c.academyName,
            createdAt: loadedCoachesById[c.id]?.createdAt ?? nowIso,
            updatedAt: nowIso,
          },
        };
        loadedCoachesById = merged;
        await persistCoachesById(merged);
        if (isDev() && role === "parent" && session.weekly?.updatedAt) {
          const lastSeen = await getLastSeenUpdatedAt(activeWeeklySyncLink.weeklySync.linkToken);
          if (lastSeen === null || session.weekly.updatedAt > lastSeen) {
            nextShowNewCoachUpdateBanner = true;
          }
        }
      } catch {
        nextWeeklyFetchFailed = true;
        nextWeeklyNetworkOk = false;
        const cached = await getCachedWeeklyForLinkToken(
          activeWeeklySyncLink.weeklySync.linkToken,
        );
        nextWeeklyDoc = cached?.weekly ?? null;
        nextWeeklyFetchedAt = cached?.fetchedAt ?? null;
        nextWeeklyFromCache = true;
      }
    }

    setWeeklySyncDoc(nextWeeklyDoc);
    setWeeklySyncFetchFailed(nextWeeklyFetchFailed);
    setWeeklySyncFetchedAt(nextWeeklyFetchedAt);
    setWeeklySyncFromCache(nextWeeklyFromCache);
    setWeeklySyncNetworkOk(nextWeeklyNetworkOk);
    setShowNewCoachUpdateBanner(nextShowNewCoachUpdateBanner);

    const today = todayYMD();
    const strictWeeklyForParent =
      role === "parent" ? parentStrictWeeklyLinkedCoachLinksForUi(loadedCoachLinks) : [];
    const activeWeeklyInviteTokenNorm =
      isDev() && role === "parent" && strictWeeklyForParent[0]?.weeklySync?.linkToken
        ? normalizeInviteLinkToken(strictWeeklyForParent[0].weeklySync.linkToken)
        : "";
    const rosterKidId =
      isDev() && role === "parent" && activeWeeklyInviteTokenNorm
        ? resolveParentWeeklyInviteFilteredFamilyCompKidId(
            loadedKidsById,
            storedFamilyCompKidId,
            loadedCoachLinks,
            activeWeeklyInviteTokenNorm,
          )
        : resolveFamilyCompetitionKidId(loadedKidsById, storedFamilyCompKidId);
    if (storedFamilyCompKidId) {
      if (!rosterKidId) {
        await clearFamilyCompetitionSelectedKidId();
      } else if (
        !loadedKidsById[storedFamilyCompKidId] ||
        storedFamilyCompKidId !== rosterKidId
      ) {
        await setFamilyCompetitionSelectedKidId(rosterKidId);
      }
    }
    const compApplyGen = ++applyFamilyCompGenRef.current;
    const { nextFamily, nextPracticeSummary } = await computeParentKidScopedState(
      rosterKidId,
      loadedKidsById,
      today,
    );

    setFamilyCompetition((prev) => {
      if (compApplyGen !== applyFamilyCompGenRef.current) return prev;
      return nextFamily;
    });
    setPracticeSummary(nextPracticeSummary);
    setKidsByIdState(loadedKidsById);

    setCoachLinks(loadedCoachLinks);
    setCoachesById(loadedCoachesById);
    setPacksById(loadedPacksById);
    setPackEnrollments(loadedPackEnrollments);
    setAssignmentsById(loadedAssignmentsById);
    setCompletionReceiptsQueue(loadedCompletionReceiptsQueue);
    setPilotPreviewItemsState(loadedPilotPreviewItems);
    setReady(true);
  }, [computeParentKidScopedState, role]);

  useFocusEffect(
    useCallback(() => {
      void loadCoachShareData();
    }, [loadCoachShareData]),
  );

  useEffect(() => {
    if (!__DEV__ || role !== "parent") return;
    const trace = buildDevParentWeeklyLinkedStateTrace(coachLinks);
    console.log("[mm:autoRelink]", {
      step: "parent_weekly_screen",
      ...trace,
    });
  }, [coachLinks, role]);

  const familyUpcomingMonthGroups = useMemo(
    () =>
      groupFamilyCompetitionEntriesByMonth(familyCompetition.upcoming, {
        monthOrder: "asc",
        entryOrder: "asc",
      }),
    [familyCompetition.upcoming],
  );
  const familyRecentMonthGroups = useMemo(
    () =>
      groupFamilyCompetitionEntriesByMonth(familyCompetition.recent, {
        monthOrder: "desc",
        entryOrder: "desc",
      }),
    [familyCompetition.recent],
  );

  const nextFamilyUpcomingEntryId = useMemo(
    () =>
      familyCompetition.upcoming.length > 0
        ? familyCompetition.upcoming[0]!.id
        : null,
    [familyCompetition.upcoming],
  );

  const nextUpcomingCompetitionEntry =
    familyCompetition.upcoming.length > 0 ? familyCompetition.upcoming[0]! : null;

  const nextUpcomingCompetitionChip = useMemo(() => {
    if (!nextUpcomingCompetitionEntry) return null;
    const chipBase = familyCompetitionChipForEntry(
      nextUpcomingCompetitionEntry,
      familyCompetition.todayYMD,
    );
    return {
      ...chipBase,
      ...familyFacingCompetitionChipStyle(chipBase),
    };
  }, [nextUpcomingCompetitionEntry, familyCompetition.todayYMD]);

  const nextUpcomingCompetitionPromoterFmt = useMemo(() => {
    if (!nextUpcomingCompetitionEntry) return null;
    return familyCompetitionPromoterFormatLine(nextUpcomingCompetitionEntry, 72);
  }, [nextUpcomingCompetitionEntry]);

  const nextUpcomingCompetitionDateLabel = useMemo(() => {
    if (!nextUpcomingCompetitionEntry) return null;
    return formatFamilyCompetitionDate(nextUpcomingCompetitionEntry.eventDate);
  }, [nextUpcomingCompetitionEntry]);

  const [familyUpcomingMonthsExpanded, setFamilyUpcomingMonthsExpanded] = useState(
    () => new Set<string>(),
  );
  const [familyRecentMonthsExpanded, setFamilyRecentMonthsExpanded] = useState(
    () => new Set<string>(),
  );

  // Parent-focused redesign: keep the competition calendar collapsed by default
  // (we show a dedicated "Next competition" card instead).
  const [competitionCalendarExpanded, setCompetitionCalendarExpanded] = useState(false);

  useEffect(() => {
    if (!familyUpcomingMonthGroups.length) return;
    if (role === "parent" && !competitionCalendarExpanded) return;
    setFamilyUpcomingMonthsExpanded((prev) => {
      if (prev.size > 0) return prev;
      const cur = familyCompetition.todayYMD.slice(0, 7);
      const hasCur = familyUpcomingMonthGroups.some((g) => g.monthKey === cur);
      return new Set([hasCur ? cur : familyUpcomingMonthGroups[0]!.monthKey]);
    });
  }, [familyUpcomingMonthGroups, familyCompetition.todayYMD, role, competitionCalendarExpanded]);

  useEffect(() => {
    if (!familyRecentMonthGroups.length) return;
    if (role === "parent" && !competitionCalendarExpanded) return;
    setFamilyRecentMonthsExpanded((prev) => {
      if (prev.size > 0) return prev;
      const cur = familyCompetition.todayYMD.slice(0, 7);
      const hasCur = familyRecentMonthGroups.some((g) => g.monthKey === cur);
      return new Set([hasCur ? cur : familyRecentMonthGroups[0]!.monthKey]);
    });
  }, [familyRecentMonthGroups, familyCompetition.todayYMD, role, competitionCalendarExpanded]);

  const toggleFamilyUpcomingMonth = useCallback((monthKey: string) => {
    setFamilyUpcomingMonthsExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }, []);

  const toggleFamilyRecentMonth = useCallback((monthKey: string) => {
    setFamilyRecentMonthsExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }, []);

  const allCoaches = Object.values(coachesById);
  const allPacks = Object.values(packsById);
  const allAssignments = Object.values(assignmentsById);

  const activeCoachLinks =
    role === "parent"
      ? activeCoachLinksForParentLinkedUi(coachLinks)
      : coachLinks.filter((link) => link.status === "active");
  const isLinked = activeCoachLinks.length > 0;
  const weeklySyncLink =
    role === "parent"
      ? parentStrictWeeklyLinkedCoachLinksForUi(coachLinks)[0]
      : activeCoachLinks.find((l) => l.weeklySync);
  const useWeeklySyncHero = Boolean(weeklySyncLink);

  useEffect(() => {
    if (!isDev() || role !== "parent" || !ready) return;
    if (!weeklySyncDoc?.updatedAt || !weeklySyncNetworkOk) return;
    const raw = weeklySyncLink?.weeklySync?.linkToken;
    if (!raw?.trim()) return;
    void setLastSeenUpdatedAt(raw, weeklySyncDoc.updatedAt);
  }, [
    ready,
    role,
    weeklySyncDoc,
    weeklySyncNetworkOk,
    weeklySyncLink?.weeklySync?.linkToken,
    weeklySyncDoc?.updatedAt,
  ]);

  const firstCoach = allCoaches[0];
  const firstPack = allPacks[0];

  const assignedAssignments = allAssignments.filter(
    (assignment) => assignment.status === "assigned",
  );
  const currentAssignment = assignedAssignments[0] ?? allAssignments[0];

  const currentCoachFromAssignment = currentAssignment
    ? coachesById[currentAssignment.coachId]
    : undefined;
  const weeklySyncCoach =
    weeklySyncLink && coachesById[weeklySyncLink.coachId]
      ? coachesById[weeklySyncLink.coachId]
      : undefined;
  const currentCoach = weeklySyncCoach ?? currentCoachFromAssignment ?? firstCoach;

  const currentPackFromAssignment = currentAssignment
    ? packsById[currentAssignment.packId]
    : undefined;
  const currentPack = currentPackFromAssignment ?? firstPack;

  const currentModule =
    currentAssignment && currentPack?.modules
      ? currentPack.modules.find(
          (module) => module.id === currentAssignment.moduleId,
        )
      : undefined;

  const currentAssignmentAssignedDate =
    currentAssignment && currentAssignment.assignedAt
      ? new Date(currentAssignment.assignedAt)
      : undefined;

  const completedCurrentAssignment =
    currentAssignment?.status === "completed" ? currentAssignment : undefined;

  const latestCompletionReceipt =
    completionReceiptsQueue.length > 0
      ? completionReceiptsQueue[completionReceiptsQueue.length - 1]
      : undefined;

  const completionSourceAssignment =
    completedCurrentAssignment ??
    (latestCompletionReceipt
      ? assignmentsById[latestCompletionReceipt.assignmentId]
      : undefined);

  const completionCompletedAtIso =
    completedCurrentAssignment?.completedAt ??
    latestCompletionReceipt?.completedAt ??
    completionSourceAssignment?.completedAt;

  const completionCompletedAtDate = completionCompletedAtIso
    ? new Date(completionCompletedAtIso)
    : undefined;

  const completionPack =
    completionSourceAssignment && packsById[completionSourceAssignment.packId]
      ? packsById[completionSourceAssignment.packId]
      : undefined;

  const completionModule =
    completionSourceAssignment && completionPack?.modules
      ? completionPack.modules.find(
          (module) => module.id === completionSourceAssignment.moduleId,
        )
      : undefined;

  const completionAssignmentTitle =
    completionSourceAssignment?.title ??
    currentAssignment?.title ??
    "Assignment completed";

  const hasCompletionSummary =
    Boolean(completedCurrentAssignment) || Boolean(latestCompletionReceipt);

  const handleMarkCurrentAssignmentComplete = useCallback(async () => {
    if (!currentAssignment || currentAssignment.status !== "assigned") {
      return;
    }

    const nowIso = new Date().toISOString();

    const updatedAssignment = {
      ...currentAssignment,
      status: "completed" as const,
      completedAt: nowIso,
    };

    const updatedAssignmentsById: AssignmentMap = {
      ...assignmentsById,
      [currentAssignment.id]: updatedAssignment,
    };

    const newReceipt: CompletionReceipt = {
      id: `local-${Date.now()}`,
      assignmentId: currentAssignment.id,
      enrollmentId: currentAssignment.enrollmentId,
      packId: currentAssignment.packId,
      moduleId: currentAssignment.moduleId,
      coachId: currentAssignment.coachId,
      parentProfileId: currentAssignment.parentProfileId,
      completedAt: nowIso,
    };

    const updatedCompletionReceiptsQueue = [
      ...completionReceiptsQueue,
      newReceipt,
    ];

    await Promise.all([
      persistAssignmentsById(updatedAssignmentsById),
      persistCompletionReceiptsQueue(updatedCompletionReceiptsQueue),
    ]);

    setAssignmentsById(updatedAssignmentsById);
    setCompletionReceiptsQueue(updatedCompletionReceiptsQueue);
  }, [assignmentsById, completionReceiptsQueue, currentAssignment]);

  const cardButtonStyle = (pressed: boolean): { marginTop: number; paddingVertical: number; paddingHorizontal: number; borderRadius: number; borderWidth: number; borderColor: string; backgroundColor: string; alignSelf: "flex-start" } => ({
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
    alignSelf: "flex-start",
  });

  const handleRemovePilotPreviewItem = useCallback(
    async (id: string) => {
      const updated = pilotPreviewItems.filter((item) => item.id !== id);
      await setCoachPilotPreviewItems(updated);
      setPilotPreviewItemsState(updated);
    },
    [pilotPreviewItems],
  );

  const isUsableYoutubeUrl = (raw?: string) => {
    if (!raw) return false;
    const trimmed = raw.trim();
    if (!trimmed) return false;
    const hasProtocol =
      trimmed.startsWith("http://") || trimmed.startsWith("https://");
    const candidate = hasProtocol ? trimmed : `https://${trimmed}`;
    const lower = candidate.toLowerCase();

    const looksLikeYoutube =
      lower.includes("youtube.com") || lower.includes("youtu.be");
    const looksLikeInstagram =
      lower.includes("instagram.com") || lower.includes("instagr.am");

    return looksLikeYoutube || looksLikeInstagram;
  };

  const openYoutubeUrl = useCallback(async (rawUrl: string | undefined) => {
    if (!isUsableYoutubeUrl(rawUrl)) {
      return;
    }

    const trimmed = rawUrl!.trim();

    const normalized =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;

    try {
      const canOpen = await Linking.canOpenURL(normalized);
      if (!canOpen) {
        Alert.alert(
          "Unable to open link",
          "This reference link cannot be opened on this device.",
        );
        return;
      }

      await Linking.openURL(normalized);
    } catch {
      Alert.alert(
        "Unable to open link",
        "Something went wrong opening this reference link.",
      );
    }
  }, []);

  const openPublishedWebUrl = useCallback(async (rawUrl: string | undefined) => {
    const normalized = familyResourceUrlForLinking(rawUrl);
    if (!normalized) return;
    try {
      const canOpen = await Linking.canOpenURL(normalized);
      if (!canOpen) {
        Alert.alert(
          "Unable to open link",
          "This link cannot be opened on this device.",
        );
        return;
      }
      await Linking.openURL(normalized);
    } catch {
      Alert.alert("Unable to open link", "Something went wrong opening this link.");
    }
  }, []);

  const hasCoachPilotPreviewOnDevice = pilotPreviewItems.length > 0;
  const hasSeededOrLocalShareData =
    !isLinked &&
    (allAssignments.length > 0 ||
      allPacks.length > 0 ||
      allCoaches.length > 0);
  const isPreviewOnlyOnDevice =
    !isLinked && (hasCoachPilotPreviewOnDevice || hasSeededOrLocalShareData);

  const focusTitle = useWeeklySyncHero
    ? !weeklySyncNetworkOk && !weeklySyncDoc
      ? "Couldn’t refresh this week’s note"
      : !weeklySyncDoc
        ? "Your coach hasn’t published this week’s note yet"
        : weeklySyncDoc.headline
    : (currentAssignment?.title ??
      (isLinked
        ? "Your coach hasn’t shared a new focus yet"
        : "Connect to see this week’s focus"));

  const focusNotes = useWeeklySyncHero
    ? !weeklySyncNetworkOk && !weeklySyncDoc
      ? "Check your connection and tap Refresh. Your link is still saved — we just could not reach the sync service."
      : !weeklySyncDoc
        ? "When your coach publishes from their weekly focus tools, the title and family-facing text will appear here."
        : weeklySyncDoc.body
    : (currentAssignment?.notes ??
      (isLinked
        ? "When they post an update, it will show up here for your family."
        : "Use your invite code to link this phone to your academy. What you see before then stays on this device only."));

  const weeklySyncStatusLine =
    useWeeklySyncHero && weeklySyncDoc
      ? weeklySyncFromCache
        ? `Last saved on this phone${
            weeklySyncFetchedAt ? ` · ${new Date(weeklySyncFetchedAt).toLocaleString()}` : ""
          }`
        : `Published ${new Date(weeklySyncDoc.updatedAt).toLocaleString()}`
      : null;

  const assignmentStatusLine =
    weeklySyncStatusLine ??
    (!currentAssignment || !isLinked
      ? null
      : currentAssignment.status === "assigned"
        ? currentAssignmentAssignedDate
          ? `Shared ${currentAssignmentAssignedDate.toLocaleDateString()}`
          : "Shared by your coach"
        : currentAssignment.status === "completed"
          ? "Marked done at home (saved on this phone)"
          : null);

  const showCoachOperationalTools = role === "coach";
  const showDebugStoragePanel = __DEV__ && showDebugData;

  const familyCompetitionGlobalEmpty =
    familyCompetition.upcoming.length === 0 &&
    familyCompetition.recent.length === 0;

  const onConfirmDeleteFamilyCompetitionEntry = useCallback(
    async (entry: KidCompetitionEntry) => {
      const outcome = await deleteParentKidCompetitionEntry(
        entry.id,
        entry.kidId,
        getKidsById,
      );
      if (!outcome.ok) {
        Alert.alert(outcome.alertTitle, outcome.alertMessage);
        return;
      }
      applyFamilyCompGenRef.current += 1;
      setFamilyCompetition((prev) => ({
        ...prev,
        upcoming: prev.upcoming.filter((e) => e.id !== entry.id),
        recent: prev.recent.filter((e) => e.id !== entry.id),
      }));
    },
    [],
  );

  const requestDeleteFamilyCompetitionEntry = useCallback(
    (entry: KidCompetitionEntry) => {
      const label = entry.tournamentName.trim() || "this competition";
      Alert.alert(
        "Delete this competition?",
        `This removes “${label}” from your calendar on this phone. If your coach added notes or a video to this entry, those will be deleted too. This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => void onConfirmDeleteFamilyCompetitionEntry(entry),
          },
        ],
      );
    },
    [onConfirmDeleteFamilyCompetitionEntry],
  );

  const familyCompetitionSwipeDeleteAction = (entry: KidCompetitionEntry) => (
    <Pressable
      onPress={() => requestDeleteFamilyCompetitionEntry(entry)}
      accessibilityLabel="Delete competition entry"
      accessibilityRole="button"
      style={({ pressed }) => ({
        justifyContent: "center",
        backgroundColor: pressed ? "#b91c1c" : UI.deleteBg,
        borderRadius: 12,
        marginLeft: 8,
        paddingHorizontal: 22,
        minWidth: 88,
      })}
    >
      <Text
        style={{
          color: UI.deleteText,
          fontWeight: "800",
          fontSize: 15,
        }}
      >
        Delete
      </Text>
    </Pressable>
  );

  const weeklyStoryPrimaryHint =
    isLinked && currentAssignment?.status === "assigned" && !useWeeklySyncHero
      ? "When you’re ready, tap Log practice for this week on This week."
      : useWeeklySyncHero
        ? "When you’re ready, refresh This week for the latest note, or open Training to log practice together."
        : !isLinked
          ? "When you’re ready, tap Connect with your coach on This week."
          : "When you’re ready, refresh This week for the latest update.";

  const closeWeeklyStory = useCallback(() => {
    setWeeklyStoryOpen(false);
    setWeeklyStoryStep(0);
  }, []);

  const openWeeklyStory = useCallback(() => {
    setWeeklyStoryStep(0);
    setWeeklyStoryOpen(true);
  }, []);

  const activeAthleteLabel = familyCompetition.kidName
    ? familyCompetition.kidName
    : familyCompetition.kidId
      ? "Selected athlete"
      : "No athlete selected";
  const whyThisMattersText = useMemo(() => {
    const childName = familyCompetition.kidName?.trim() || "your kid";
    const mission = (focusTitle ?? "").trim();

    if (!mission) {
      return `A short shared routine helps ${childName} remember the goal for the week — and helps you cheer them on with confidence.`;
    }

    return `This week’s mission turns training into a family game: you both know what to practice, and ${childName} can feel proud when it clicks.`;
  }, [familyCompetition.kidName, focusTitle]);
  /** Weekly sync note is invite/family-scoped — do not tie the hero eyebrow to competition athlete selection. */
  const weeklyNoteHeroEyebrow = useWeeklySyncHero
    ? currentCoach?.displayName
      ? `Coach's weekly focus from ${currentCoach.displayName}`
      : "Coach's weekly focus"
    : currentCoach?.displayName
      ? `Coach's weekly focus from ${currentCoach.displayName}`
      : "Coach's weekly focus";

  const relevantParentKids = useMemo(() => {
    const base = Object.values(kidsByIdState)
      .filter((kid) => kid && kid.id)
      .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }),
      );
    if (!isDev() || role !== "parent") return base;
    const tokenNorm = normalizeInviteLinkToken(weeklySyncLink?.weeklySync?.linkToken ?? "");
    if (!tokenNorm) return base;
    return base.filter((kid) =>
      parentKidCoherentlyLinkedToInviteToken(kid, tokenNorm, coachLinks),
    );
  }, [kidsByIdState, role, weeklySyncLink?.weeklySync?.linkToken, coachLinks]);

  const showParentKidSelector =
    role === "parent" && ready && relevantParentKids.length >= 2;

  const handleSelectParentKidForThisWeek = useCallback(
    async (kid: Kid) => {
      if (!kid?.id || kid.id === familyCompetition.kidId) return;
      const today = todayYMD();
      await setFamilyCompetitionSelectedKidId(kid.id);
      const compApplyGen = ++applyFamilyCompGenRef.current;
      const { nextFamily, nextPracticeSummary } = await computeParentKidScopedState(
        kid.id,
        kidsByIdState,
        today,
      );
      setFamilyCompetition((prev) => {
        if (compApplyGen !== applyFamilyCompGenRef.current) return prev;
        return nextFamily;
      });
      setPracticeSummary(nextPracticeSummary);
    },
    [computeParentKidScopedState, familyCompetition.kidId, kidsByIdState],
  );

  useEffect(() => {
    if (!isDev() || role !== "parent" || !ready) return;
    const tokenNorm = normalizeInviteLinkToken(weeklySyncLink?.weeklySync?.linkToken ?? "");
    if (!tokenNorm) return;
    const kidId = familyCompetition.kidId;

    if (relevantParentKids.length === 0) {
      if (kidId == null) return;
      void (async () => {
        await clearFamilyCompetitionSelectedKidId();
        const today = todayYMD();
        const compApplyGen = ++applyFamilyCompGenRef.current;
        const { nextFamily, nextPracticeSummary } = await computeParentKidScopedState(
          null,
          kidsByIdState,
          today,
        );
        setFamilyCompetition((prev) => {
          if (compApplyGen !== applyFamilyCompGenRef.current) return prev;
          return nextFamily;
        });
        setPracticeSummary(nextPracticeSummary);
      })();
      return;
    }

    if (kidId != null && relevantParentKids.some((k) => k.id === kidId)) return;
    if (kidId == null) return;

    const fallback = relevantParentKids[0]!.id;
    void (async () => {
      await setFamilyCompetitionSelectedKidId(fallback);
      const today = todayYMD();
      const compApplyGen = ++applyFamilyCompGenRef.current;
      const { nextFamily, nextPracticeSummary } = await computeParentKidScopedState(
        fallback,
        kidsByIdState,
        today,
      );
      setFamilyCompetition((prev) => {
        if (compApplyGen !== applyFamilyCompGenRef.current) return prev;
        return nextFamily;
      });
      setPracticeSummary(nextPracticeSummary);
    })();
  }, [
    ready,
    role,
    weeklySyncLink?.weeklySync?.linkToken,
    familyCompetition.kidId,
    relevantParentKids,
    kidsByIdState,
    computeParentKidScopedState,
  ]);

  const legacyClassProgramBody = useMemo(() => {
    if (useWeeklySyncHero) return "";
    const parts = [
      currentModule?.title
        ? `In class, look for: ${currentModule.title}${
            currentModule.summary ? ` — ${currentModule.summary}` : ""
          }`
        : null,
      isLinked && currentPack?.title
        ? `Program: ${currentPack.title}${
            currentPack.description ? ` · ${currentPack.description}` : ""
          }`
        : null,
    ].filter(Boolean);
    return parts.join("\n\n");
  }, [useWeeklySyncHero, currentModule, currentPack, isLinked]);

  const readTogetherStoryCards = useMemo(
    () =>
      buildReadTogetherStoryCards({
        mode: useWeeklySyncHero ? "weekly_sync" : "legacy_assignment",
        weekStartYMD: startOfWeekMondayYMD(
          familyCompetition.todayYMD || todayYMD(),
        ),
        weeklySyncDoc,
        weeklySyncNetworkOk,
        missionHeadline: focusTitle,
        missionBody: focusNotes,
        missionEyebrow: weeklyNoteHeroEyebrow,
        whyThisMattersText,
        legacyClassProgramBody,
        closingNavigationHint: weeklyStoryPrimaryHint,
        practiceSummary,
      }),
    [
      useWeeklySyncHero,
      familyCompetition.todayYMD,
      weeklySyncDoc,
      weeklySyncNetworkOk,
      focusTitle,
      focusNotes,
      weeklyNoteHeroEyebrow,
      whyThisMattersText,
      legacyClassProgramBody,
      weeklyStoryPrimaryHint,
      practiceSummary,
    ],
  );

  return (
    <>
      <Stack.Screen options={{ title: "This week" }} />
      {role === "coach" ? (
        <KeyboardAwareScrollView
          enableOnAndroid
          extraScrollHeight={80}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, backgroundColor: UI.screenBg }}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        >
          {!ready ? (
            <Text style={{ marginTop: 4, fontSize: 15, color: UI.textSecondary }}>
              Loading…
            </Text>
          ) : (
            <View>
              <Text
                style={{ fontSize: 26, fontWeight: "700", color: UI.textPrimary, marginBottom: 8 }}
              >
                Coach home
              </Text>
              <Text style={{ fontSize: 15, color: UI.textSecondary, lineHeight: 22, marginBottom: 22 }}>
                Open your kids roster to manage athletes and weekly focus.
              </Text>
              <Pressable
                onPress={() => router.push("/this-week/kids")}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  borderRadius: CARD_RADIUS,
                  borderWidth: 1,
                  borderColor: UI.primaryFill,
                  backgroundColor: pressed ? UI.primaryFillPressed : UI.primaryFill,
                  alignSelf: "stretch",
                  alignItems: "center",
                })}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: UI.primaryTextOnFill }}>
                  Open kids roster
                </Text>
              </Pressable>
            </View>
          )}
        </KeyboardAwareScrollView>
      ) : (
        <>
          <ReadTogetherStoryModal
            visible={weeklyStoryOpen}
            onRequestClose={closeWeeklyStory}
            safeAreaTop={insets.top}
            safeAreaBottom={insets.bottom}
            stepIndex={weeklyStoryStep}
            cards={readTogetherStoryCards}
            onStepBack={() => setWeeklyStoryStep((s) => Math.max(0, s - 1))}
            onStepNext={() =>
              setWeeklyStoryStep((s) =>
                Math.min(readTogetherStoryCards.length - 1, s + 1),
              )
            }
            onFinished={closeWeeklyStory}
            onOpenPublishedUrl={(url) => void openPublishedWebUrl(url)}
            primaryFill={UI.primaryFill}
            primaryFillPressed={UI.primaryFillPressed}
            accentBorder={UI.addCompetitionBorder}
            accentBg={UI.addCompetitionBg}
            accentBgPressed={UI.addCompetitionBgPressed}
          />
      <KeyboardAwareScrollView
        enableOnAndroid
        extraScrollHeight={80}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: UI.screenBg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <Text
          onLongPress={
            __DEV__ ? () => setShowDebugData((prev) => !prev) : undefined
          }
          style={{ fontSize: 26, fontWeight: "700", color: UI.textPrimary, marginBottom: 6 }}
        >
          This week together
        </Text>
        <View style={{ height: 14 }} />

        {!ready ? (
          <Text style={{ marginTop: 4, fontSize: 15, color: UI.textSecondary }}>
            Loading…
          </Text>
        ) : (
          <>
            <View
              style={{
                padding: 20,
                borderRadius: CARD_RADIUS,
                borderWidth: 1,
                borderColor: UI.heroBorder,
                backgroundColor: UI.bgHero,
                overflow: "hidden",
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  right: -70,
                  top: -70,
                  width: 170,
                  height: 170,
                  borderRadius: 999,
                  backgroundColor: UI.heroBlob1,
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: -65,
                  bottom: -75,
                  width: 170,
                  height: 170,
                  borderRadius: 999,
                  backgroundColor: UI.heroBlob2,
                }}
              />
              <Pressable
                onPress={openWeeklyStory}
                accessibilityRole="button"
                accessibilityLabel={"Start Family Huddle. Review this week’s mission together."}
                style={({ pressed }) => ({
                  marginTop: 0,
                  marginBottom: 16,
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  borderRadius: CARD_RADIUS,
                  borderWidth: 1,
                  borderColor: role === "parent" ? UI.primaryFill : UI.addCompetitionBorder,
                  backgroundColor:
                    role === "parent"
                      ? pressed
                        ? UI.primaryFillPressed
                        : UI.primaryFill
                      : pressed
                        ? UI.addCompetitionBgPressed
                        : "#f5f3ff",
                  alignSelf: "stretch",
                  alignItems: "flex-start",
                })}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "900",
                    letterSpacing: 0.8,
                    color: role === "parent" ? UI.primaryTextOnFill : "#6d28d9",
                  }}
                >
                  Start Family Huddle
                </Text>
                <Text
                  style={{
                    marginTop: 6,
                    fontSize: 18,
                    fontWeight: "800",
                    color: role === "parent" ? UI.primaryTextOnFill : UI.textPrimary,
                    lineHeight: 24,
                  }}
                >
                  Click here to begin
                </Text>
                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 15,
                    color: role === "parent" ? "#e0e7ff" : UI.textSecondary,
                    lineHeight: 22,
                  }}
                >
                  First action: read this week&apos;s mission together, then log practice.
                </Text>
              </Pressable>
              <Text
                style={{
                  fontSize: 12,
                  letterSpacing: 1,
                  fontWeight: "800",
                  color: "#7c3aed",
                  marginBottom: 6,
                }}
              >
                Family Mission
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: UI.textSecondary,
                  lineHeight: 20,
                  marginBottom: 12,
                }}
              >
                Same note for every family on this coach link.
              </Text>
              <View
                style={{
                  alignSelf: "flex-start",
                  marginBottom: 14,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: isLinked
                    ? "#a7f3d0"
                    : isPreviewOnlyOnDevice
                      ? "#fde68a"
                      : "#ede9fe",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: isLinked
                      ? "#065f46"
                      : isPreviewOnlyOnDevice
                        ? "#b45309"
                        : "#5b21b6",
                  }}
                >
                  {useWeeklySyncHero
                    ? "Linked — weekly note sync"
                    : isLinked
                      ? "Linked to your coach"
                      : isPreviewOnlyOnDevice
                        ? "On this phone only — not linked yet"
                        : "Not linked yet"}
                </Text>
              </View>

              {isDev() &&
              role === "parent" &&
              showNewCoachUpdateBanner &&
              weeklySyncDoc?.updatedAt ? (
                <View
                  style={{
                    alignSelf: "stretch",
                    marginBottom: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: "#e0e7ff",
                    borderWidth: 1,
                    borderColor: "#c7d2fe",
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#312e81" }}>
                    New coach update
                  </Text>
                  <Text style={{ marginTop: 4, fontSize: 13, color: "#4338ca" }}>
                    Updated {new Date(weeklySyncDoc.updatedAt).toLocaleString()}
                  </Text>
                </View>
              ) : null}

              <Text style={[SECTION_LABEL, { marginBottom: 8, color: "#6d28d9" }]}>
                {weeklyNoteHeroEyebrow.toUpperCase()}
              </Text>
              <Text style={{ fontSize: 20, fontWeight: "700", color: UI.textPrimary, lineHeight: 28 }}>
                {focusTitle}
              </Text>
              <Text style={{ marginTop: 10, fontSize: 15, color: UI.textSecondary, lineHeight: 23 }}>
                {focusNotes}
              </Text>

              {useWeeklySyncHero && weeklySyncFetchFailed && weeklySyncDoc ? (
                <Text style={{ marginTop: 10, fontSize: 13, color: "#92400e", lineHeight: 19 }}>
                  Showing last saved note — could not reach the sync service. Pull to refresh or try again
                  shortly.
                </Text>
              ) : null}

              {!useWeeklySyncHero && currentModule?.title ? (
                <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: UI.heroBorder }}>
                  <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 20 }}>
                    <Text style={{ fontWeight: "700", color: UI.textPrimary }}>In class, look for: </Text>
                    {currentModule.title}
                    {currentModule.summary ? ` — ${currentModule.summary}` : ""}
                  </Text>
                </View>
              ) : null}

              {!useWeeklySyncHero && currentPack?.title && isLinked ? (
                <Text style={{ marginTop: 10, fontSize: 13, color: UI.textSecondary }}>
                  Program: <Text style={{ fontWeight: "600", color: UI.textPrimary }}>{currentPack.title}</Text>
                  {currentPack.description ? ` · ${currentPack.description}` : ""}
                </Text>
              ) : null}

              {assignmentStatusLine ? (
                <Text style={{ marginTop: 10, fontSize: 13, color: UI.textSecondary }}>
                  {assignmentStatusLine}
                </Text>
              ) : null}

              {!isLinked && hasCoachPilotPreviewOnDevice ? (
                <Text style={{ marginTop: 12, fontSize: 13, color: "#92400e", lineHeight: 19 }}>
                  Preview items on this phone are not shared with families until you connect with your coach’s invite.
                </Text>
              ) : null}

              {!isLinked && hasSeededOrLocalShareData && !hasCoachPilotPreviewOnDevice ? (
                <Text style={{ marginTop: 12, fontSize: 13, color: "#92400e", lineHeight: 19 }}>
                  Sample or local data on this phone only — connect to use your coach’s real weekly note.
                </Text>
              ) : null}

              {isLinked && currentAssignment?.status === "assigned" ? (
                <Pressable
                  onPress={() => void handleMarkCurrentAssignmentComplete()}
                  style={({ pressed }) => ({
                    marginTop: 18,
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderRadius: CARD_RADIUS,
                    backgroundColor:
                      role === "parent"
                        ? pressed
                          ? UI.addCompetitionBgPressed
                          : UI.addCompetitionBg
                        : pressed
                          ? UI.primaryFillPressed
                          : UI.primaryFill,
                    alignSelf: "stretch",
                    alignItems: "center",
                  })}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: role === "parent" ? UI.primaryFill : "#ffffff",
                    }}
                  >
                    Log practice for this week
                  </Text>
                </Pressable>
              ) : !isLinked ? (
                <Pressable
                  onPress={() => router.push("/this-week/join")}
                  style={({ pressed }) => ({
                    marginTop: 18,
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderRadius: CARD_RADIUS,
                    backgroundColor:
                      role === "parent"
                        ? pressed
                          ? UI.addCompetitionBgPressed
                          : UI.addCompetitionBg
                        : pressed
                          ? UI.primaryFillPressed
                          : UI.primaryFill,
                    alignSelf: "stretch",
                    alignItems: "center",
                  })}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: role === "parent" ? UI.primaryFill : "#ffffff",
                    }}
                  >
                    Connect with your coach
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => void loadCoachShareData()}
                  style={({ pressed }) => ({
                    marginTop: 18,
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderRadius: CARD_RADIUS,
                    backgroundColor:
                      role === "parent"
                        ? pressed
                          ? UI.addCompetitionBgPressed
                          : UI.addCompetitionBg
                        : pressed
                          ? UI.primaryFillPressed
                          : UI.primaryFill,
                    alignSelf: "stretch",
                    alignItems: "center",
                  })}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: role === "parent" ? UI.primaryFill : "#ffffff",
                    }}
                  >
                    Refresh this week’s update
                  </Text>
                </Pressable>
              )}

            </View>

            {showParentKidSelector ? (
              <>
                <View
                  style={{
                    marginTop: 18,
                    marginBottom: -2,
                    paddingHorizontal: 2,
                  }}
                >
                  <Text style={{ fontSize: 12, letterSpacing: 1, fontWeight: "800", color: "#6b7280" }}>
                    Track this child
                  </Text>
                </View>
                <Text
                  style={{
                    marginTop: 8,
                    paddingHorizontal: 2,
                    fontSize: 14,
                    color: UI.textSecondary,
                    lineHeight: 20,
                  }}
                >
                  Choose a child for training, competition, and practice below.
                </Text>
                <View
                  style={{
                    marginTop: 12,
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                {relevantParentKids.map((kid) => {
                  const selected = kid.id === familyCompetition.kidId;
                  return (
                    <Pressable
                      key={kid.id}
                      onPress={() => void handleSelectParentKidForThisWeek(kid)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Training and competition for ${kid.name.trim() || "this child"}`}
                      style={({ pressed }) => ({
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: selected ? UI.primaryFill : UI.border,
                        backgroundColor: selected
                          ? (pressed ? UI.primaryFillPressed : UI.primaryFill)
                          : (pressed ? "#f3f4f6" : UI.bgCard),
                      })}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "800",
                          color: selected ? UI.primaryTextOnFill : UI.textPrimary,
                        }}
                      >
                        {kid.name.trim() || "Child"}
                      </Text>
                    </Pressable>
                  );
                })}
                </View>
              </>
            ) : null}

            {role === "parent" && ready ? (
              <Section title="Training progress" tone="family">
                <View
                  style={{
                    marginBottom: 12,
                    padding: 14,
                    borderRadius: CARD_RADIUS,
                    borderWidth: 1,
                    borderColor: UI.addCompetitionBorder,
                    backgroundColor: "#f5f3ff",
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, letterSpacing: 1, fontWeight: "900", color: "#6d28d9" }}>
                        SESSIONS THIS WEEK
                      </Text>
                      <Text style={{ marginTop: 6, fontSize: 34, fontWeight: "900", color: UI.textPrimary }}>
                        {practiceSummary.sessionCountThisWeek}
                      </Text>
                      <Text style={{ marginTop: 2, fontSize: 13, fontWeight: "800", color: UI.textSecondary }}>
                        {practiceSummary.sessionCountThisWeek === 1 ? "session logged" : "sessions logged"}
                      </Text>
                      <Text style={{ marginTop: 6, fontSize: 13, color: UI.textSecondary, lineHeight: 18 }}>
                        For{" "}
                        <Text style={{ fontWeight: "900", color: UI.textPrimary }}>
                          {activeAthleteLabel}
                        </Text>
                      </Text>
                    </View>

                    <View
                      style={{
                        alignSelf: "flex-start",
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor:
                          practiceSummary.sessionCountThisWeek >= 3 ? "#34d399" : UI.progressRailActive,
                        backgroundColor:
                          practiceSummary.sessionCountThisWeek >= 3 ? "#dcfce7" : UI.progressRailActive,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "900",
                          color:
                            practiceSummary.sessionCountThisWeek >= 3 ? "#065f46" : "#3730a3",
                        }}
                      >
                        {practiceSummary.sessionCountThisWeek >= 3 ? "Goal reached" : "Keep building"}
                      </Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 14 }}>
                    <Text style={{ fontSize: 12, fontWeight: "900", letterSpacing: 0.8, color: "#6d28d9" }}>
                      3-step progress
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor:
                            practiceSummary.sessionCountThisWeek >= 1 ? UI.primaryFill : UI.border,
                          backgroundColor:
                            practiceSummary.sessionCountThisWeek >= 1 ? UI.primaryFill : UI.progressDotInactive,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "900",
                            color:
                              practiceSummary.sessionCountThisWeek >= 1 ? UI.primaryTextOnFill : UI.textPrimary,
                          }}
                        >
                          1
                        </Text>
                      </View>
                      <View
                        style={{
                          flex: 1,
                          height: 8,
                          borderRadius: 999,
                          marginHorizontal: 6,
                          backgroundColor:
                            practiceSummary.sessionCountThisWeek >= 2 ? UI.progressRailActive : UI.progressRail,
                        }}
                      />
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor:
                            practiceSummary.sessionCountThisWeek >= 2 ? UI.primaryFill : UI.border,
                          backgroundColor:
                            practiceSummary.sessionCountThisWeek >= 2 ? UI.primaryFill : UI.progressDotInactive,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "900",
                            color:
                              practiceSummary.sessionCountThisWeek >= 2 ? UI.primaryTextOnFill : UI.textPrimary,
                          }}
                        >
                          2
                        </Text>
                      </View>
                      <View
                        style={{
                          flex: 1,
                          height: 8,
                          borderRadius: 999,
                          marginHorizontal: 6,
                          backgroundColor:
                            practiceSummary.sessionCountThisWeek >= 3 ? UI.progressRailActive : UI.progressRail,
                        }}
                      />
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor:
                            practiceSummary.sessionCountThisWeek >= 3 ? UI.primaryFill : UI.border,
                          backgroundColor:
                            practiceSummary.sessionCountThisWeek >= 3 ? UI.primaryFill : UI.progressDotInactive,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "900",
                            color:
                              practiceSummary.sessionCountThisWeek >= 3 ? UI.primaryTextOnFill : UI.textPrimary,
                          }}
                        >
                          3
                        </Text>
                      </View>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginTop: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "900",
                          color:
                            practiceSummary.sessionCountThisWeek >= 1 ? UI.primaryFill : UI.textSecondary,
                          width: 90,
                        }}
                      >
                        1 practice
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "900",
                          color:
                            practiceSummary.sessionCountThisWeek >= 2 ? UI.primaryFill : UI.textSecondary,
                          width: 90,
                          textAlign: "center",
                        }}
                      >
                        2 practices
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "900",
                          color:
                            practiceSummary.sessionCountThisWeek >= 3 ? UI.primaryFill : UI.textSecondary,
                          width: 90,
                          textAlign: "right",
                        }}
                      >
                        3+ practices
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      marginTop: 14,
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: UI.border,
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "900", letterSpacing: 0.6, color: "#6d28d9" }}>
                      Latest session
                    </Text>
                    {practiceSummary.latestSession ? (
                      <Text style={{ marginTop: 6, fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
                        <Text style={{ fontWeight: "900", color: UI.textPrimary }}>
                          {sessionSummaryTitle(practiceSummary.latestSession)}
                        </Text>
                        {" · "}
                        {new Date(practiceSummary.latestSession.createdAt).toLocaleDateString()}
                      </Text>
                    ) : (
                      <Text style={{ marginTop: 6, fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
                        No sessions logged yet. Open Training to add your first one.
                      </Text>
                    )}
                  </View>
                </View>

                <Pressable
                  onPress={() => {
                    const d = todayYMD();
                    const k = familyCompetition.kidId;
                    router.push(
                      k
                        ? `/training?date=${encodeURIComponent(d)}&kidId=${encodeURIComponent(k)}&fromWeekly=1`
                        : `/training?date=${encodeURIComponent(d)}&fromWeekly=1`,
                    );
                  }}
                  style={({ pressed }) => ({
                    paddingVertical: 14,
                    paddingHorizontal: 18,
                    borderRadius: CARD_RADIUS,
                    borderWidth: 1,
                    borderColor: UI.addCompetitionBorder,
                    backgroundColor: pressed ? UI.addCompetitionBgPressed : UI.addCompetitionBg,
                    alignSelf: "stretch",
                    alignItems: "center",
                  })}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: UI.primaryFill }}>
                    Track your training
                  </Text>
                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: UI.textSecondary,
                      textAlign: "center",
                      lineHeight: 19,
                    }}
                  >
                    Add a new session or review what’s already logged this week.
                  </Text>
                </Pressable>
              </Section>
            ) : null}

            <Section title="Competition" tone="family">
              {role === "parent" ? (
                <View
                  style={{
                    marginBottom: 12,
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    borderRadius: CARD_RADIUS,
                    borderWidth: 1,
                    borderColor: UI.nextUpcomingBorder,
                    backgroundColor: UI.nextUpcomingFill,
                    overflow: "hidden",
                  }}
                >
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      right: -60,
                      top: -60,
                      width: 160,
                      height: 160,
                      borderRadius: 999,
                      backgroundColor: UI.heroBlob1,
                    }}
                  />
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: -70,
                      bottom: -80,
                      width: 180,
                      height: 180,
                      borderRadius: 999,
                      backgroundColor: "rgba(129, 140, 248, 0.12)",
                    }}
                  />

                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          letterSpacing: 1,
                          fontWeight: "900",
                          color: "#3730a3",
                        }}
                      >
                        NEXT COMPETITION
                      </Text>

                      {nextUpcomingCompetitionEntry ? (
                        <>
                          <Text
                            style={{
                              marginTop: 8,
                              fontSize: 18,
                              fontWeight: "900",
                              color: UI.textPrimary,
                              lineHeight: 24,
                            }}
                          >
                            {nextUpcomingCompetitionEntry.tournamentName}
                          </Text>
                          {nextUpcomingCompetitionDateLabel ? (
                            <Text style={{ marginTop: 6, fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
                              {nextUpcomingCompetitionDateLabel}
                            </Text>
                          ) : null}
                          {nextUpcomingCompetitionPromoterFmt ? (
                            <Text style={{ marginTop: 4, fontSize: 13, color: UI.textSecondary, lineHeight: 18 }}>
                              {nextUpcomingCompetitionPromoterFmt}
                            </Text>
                          ) : null}

                          {nextUpcomingCompetitionChip ? (
                            <View
                              style={{
                                marginTop: 10,
                                alignSelf: "flex-start",
                                paddingVertical: 6,
                                paddingHorizontal: 10,
                                borderRadius: 999,
                                backgroundColor: nextUpcomingCompetitionChip.backgroundColor,
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: "900", color: nextUpcomingCompetitionChip.textColor }}>
                                {nextUpcomingCompetitionChip.label}
                              </Text>
                            </View>
                          ) : null}
                        </>
                      ) : (
                        <Text style={{ marginTop: 10, fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
                          No upcoming dates right now.
                        </Text>
                      )}
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      <Pressable
                        onPress={() => {
                          setCompetitionCalendarExpanded((v) => {
                            const next = !v;
                            if (!next) {
                              setFamilyUpcomingMonthsExpanded(new Set<string>());
                              setFamilyRecentMonthsExpanded(new Set<string>());
                            }
                            return next;
                          });
                        }}
                        style={({ pressed }) => ({
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: UI.nextUpcomingBorder,
                          backgroundColor: pressed ? "rgba(99, 102, 241, 0.18)" : "#eef2ff",
                        })}
                        accessibilityRole="button"
                        accessibilityLabel="View competitions"
                      >
                        <Text style={{ fontSize: 12, fontWeight: "900", color: "#3730a3" }}>
                          {competitionCalendarExpanded ? "Hide competitions" : "View competitions"}
                        </Text>
                      </Pressable>

                      {familyCompetition.kidId ? (
                        <Pressable
                          onPress={() => {
                            router.push(
                              `/this-week/family-competition/edit?kidId=${encodeURIComponent(familyCompetition.kidId!)}&openNonce=${encodeURIComponent(
                                String(Date.now()),
                              )}`,
                            );
                          }}
                          style={({ pressed }) => ({
                            marginTop: 10,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: UI.addCompetitionBorder,
                            backgroundColor: pressed ? UI.addCompetitionBgPressed : UI.addCompetitionBg,
                          })}
                          accessibilityRole="button"
                          accessibilityLabel="Add competition"
                        >
                          <Text style={{ fontSize: 12, fontWeight: "900", color: UI.primaryFill }}>
                            Add competition
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              ) : null}

                {competitionCalendarExpanded ? (
                  <Text
                    style={{
                      fontSize: 14,
                      color: UI.textSecondary,
                      lineHeight: 21,
                      marginBottom: 12,
                    }}
                  >
                    {familyCompetition.kidName
                      ? `${familyCompetition.kidName}: tap a competition to edit, swipe left to delete.`
                      : familyCompetition.kidId
                        ? "Tap a competition to edit, swipe left to delete."
                        : "Add an athlete below to start this calendar."}
                  </Text>
                ) : null}

                {!familyCompetition.kidId ? (
                  <>
                    <Text
                      style={{
                        fontSize: 15,
                        color: UI.textPrimary,
                        lineHeight: 22,
                        fontWeight: "600",
                      }}
                    >
                      No athlete selected on this phone yet
                    </Text>
                    <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 21, marginTop: 6 }}>
                      Add someone on the coach roster on this device to track their competitions
                      here. Nothing is shared until you link with your coach.
                    </Text>
                  </>
                ) : null}

                {familyCompetition.kidId ? (
                  null
                ) : null}

                {familyCompetitionGlobalEmpty && familyCompetition.kidId ? (
                  <>
                    <Text
                      style={{
                        fontSize: 15,
                        color: UI.textPrimary,
                        lineHeight: 22,
                        fontWeight: "600",
                      }}
                    >
                      Nothing on the calendar yet
                    </Text>
                    <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 21, marginTop: 6 }}>
                      When you are ready, add a tournament date for your family, or check back if your
                      coach shared one on this phone.
                    </Text>
                  </>
                ) : null}

                {!familyCompetitionGlobalEmpty ? (
                  <>
                    <Text
                      style={{
                        fontSize: 12,
                        letterSpacing: 0.9,
                        color: "#5b21b6",
                        fontWeight: "700",
                        marginBottom: 10,
                      }}
                    >
                      Coming up
                    </Text>
                    {familyCompetition.upcoming.length === 0 ? (
                      <View style={{ marginBottom: 18 }}>
                        <Text
                          style={{
                            fontSize: 15,
                            color: UI.textPrimary,
                            lineHeight: 22,
                            fontWeight: "600",
                          }}
                        >
                          No upcoming dates right now
                        </Text>
                        <Text
                          style={{
                            fontSize: 14,
                            color: UI.textSecondary,
                            lineHeight: 21,
                            marginTop: 6,
                          }}
                        >
                          Add one when you know the next tournament, or scroll to Recent to look back
                          at past events.
                        </Text>
                      </View>
                    ) : (
                      <View style={{ marginBottom: 18, gap: 10 }}>
                        {familyUpcomingMonthGroups.map(({ monthKey, entries }) => {
                          const expanded = familyUpcomingMonthsExpanded.has(monthKey);
                          const chevron = expanded ? "▼" : "▶";
                          return (
                            <View
                              key={monthKey}
                              style={{
                                borderRadius: 14,
                                borderWidth: 1,
                                borderColor: UI.monthGroupBorder,
                                overflow: "hidden",
                                backgroundColor: UI.bgCard,
                              }}
                            >
                              <Pressable
                                onPress={() => toggleFamilyUpcomingMonth(monthKey)}
                                hitSlop={{ top: 6, bottom: 6 }}
                                accessibilityRole="button"
                                accessibilityState={{ expanded }}
                                style={({ pressed }) => ({
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 12,
                                  minHeight: 52,
                                  paddingVertical: 14,
                                  paddingHorizontal: 14,
                                  backgroundColor: pressed ? UI.monthBannerPressed : UI.monthBannerBg,
                                  borderBottomWidth: expanded ? 1 : 0,
                                  borderBottomColor: UI.monthGroupBorder,
                                })}
                              >
                                <Text
                                  style={{
                                    fontSize: 14,
                                    color: UI.textSecondary,
                                    width: 22,
                                    textAlign: "center",
                                    fontWeight: "600",
                                  }}
                                >
                                  {chevron}
                                </Text>
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={{
                                      fontSize: 15,
                                      fontWeight: "700",
                                      color: UI.textPrimary,
                                      letterSpacing: 0.15,
                                    }}
                                  >
                                    {formatFamilyCompetitionMonthHeading(monthKey)}
                                  </Text>
                                  <Text style={{ marginTop: 3, fontSize: 12, color: UI.textSecondary }}>
                                    {entries.length} {entries.length === 1 ? "event" : "events"}
                                  </Text>
                                </View>
                              </Pressable>
                              {expanded ? (
                                <View
                                  style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 12,
                                    gap: 10,
                                    backgroundColor: UI.monthListWellBg,
                                  }}
                                >
                                  {entries.map((entry) => {
                                    const chipBase = familyCompetitionChipForEntry(
                                      entry,
                                      familyCompetition.todayYMD,
                                    );
                                    const chip = {
                                      ...chipBase,
                                      ...familyFacingCompetitionChipStyle(chipBase),
                                    };
                                    const promoterFmt = familyCompetitionPromoterFormatLine(
                                      entry,
                                      72,
                                    );
                                    const isNextUpcoming = entry.id === nextFamilyUpcomingEntryId;
                                    return (
                                      <Swipeable
                                        key={entry.id}
                                        overshootRight={false}
                                        enabled={
                                          Boolean(familyCompetition.kidId) &&
                                          !kidCompetitionEntryIsSyncedFromWorker(entry)
                                        }
                                        renderRightActions={() =>
                                          familyCompetitionSwipeDeleteAction(entry)
                                        }
                                      >
                                        <GestureTouchableOpacity
                                          disabled={!familyCompetition.kidId}
                                          activeOpacity={familyCompetition.kidId ? 0.85 : 1}
                                          onPress={() => {
                                            const k = familyCompetition.kidId;
                                            if (!k) return;
                                            router.push(
                                              `/this-week/family-competition/edit?kidId=${encodeURIComponent(k)}&entryId=${encodeURIComponent(entry.id)}`,
                                            );
                                          }}
                                          style={{
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: isNextUpcoming
                                              ? UI.nextUpcomingBorder
                                              : UI.competitionRowBorder,
                                            backgroundColor: isNextUpcoming
                                              ? UI.nextUpcomingFill
                                              : UI.competitionRowBg,
                                            paddingVertical: 14,
                                            paddingHorizontal: 14,
                                          }}
                                        >
                                          <View
                                            style={{
                                              flexDirection: "row",
                                              justifyContent: "space-between",
                                              alignItems: "flex-start",
                                              gap: 12,
                                            }}
                                          >
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                              <Text
                                                numberOfLines={2}
                                                ellipsizeMode="tail"
                                                style={{
                                                  fontSize: 16,
                                                  fontWeight: "700",
                                                  color: UI.textPrimary,
                                                  lineHeight: 22,
                                                }}
                                              >
                                                {entry.tournamentName}
                                              </Text>
                                              <Text
                                                style={{
                                                  fontSize: 14,
                                                  color: UI.textSecondary,
                                                  marginTop: 6,
                                                }}
                                              >
                                                {formatFamilyCompetitionDate(entry.eventDate)}
                                              </Text>
                                              {promoterFmt ? (
                                                <Text
                                                  numberOfLines={1}
                                                  ellipsizeMode="tail"
                                                  style={{
                                                    fontSize: 13,
                                                    color: UI.textSecondary,
                                                    marginTop: 4,
                                                  }}
                                                >
                                                  {promoterFmt}
                                                </Text>
                                              ) : null}
                                            </View>
                                            <View
                                              style={{
                                                paddingVertical: 5,
                                                paddingHorizontal: 10,
                                                borderRadius: 999,
                                                backgroundColor: chip.backgroundColor,
                                              }}
                                            >
                                              <Text
                                                style={{
                                                  fontSize: 11,
                                                  fontWeight: "700",
                                                  color: chip.textColor,
                                                }}
                                              >
                                                {chip.label}
                                              </Text>
                                            </View>
                                          </View>
                                        </GestureTouchableOpacity>
                                      </Swipeable>
                                    );
                                  })}
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    )}

                    <Text
                      style={{
                        fontSize: 12,
                        letterSpacing: 0.9,
                        color: "#5b21b6",
                        fontWeight: "700",
                        marginBottom: 10,
                        marginTop: 2,
                      }}
                    >
                      Recent competitions
                    </Text>
                    {familyCompetition.recent.length === 0 ? (
                      <View>
                        <Text
                          style={{
                            fontSize: 15,
                            color: UI.textPrimary,
                            lineHeight: 22,
                            fontWeight: "600",
                          }}
                        >
                          No recent events logged yet
                        </Text>
                        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 21, marginTop: 6 }}>
                          After a competition day passes, it moves here so you can add results when you
                          are ready.
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 10 }}>
                        {familyRecentMonthGroups.map(({ monthKey, entries }) => {
                          const expanded = familyRecentMonthsExpanded.has(monthKey);
                          const chevron = expanded ? "▼" : "▶";
                          return (
                            <View
                              key={monthKey}
                              style={{
                                borderRadius: 14,
                                borderWidth: 1,
                                borderColor: UI.monthGroupBorder,
                                overflow: "hidden",
                                backgroundColor: UI.bgCard,
                              }}
                            >
                              <Pressable
                                onPress={() => toggleFamilyRecentMonth(monthKey)}
                                hitSlop={{ top: 6, bottom: 6 }}
                                accessibilityRole="button"
                                accessibilityState={{ expanded }}
                                style={({ pressed }) => ({
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 12,
                                  minHeight: 52,
                                  paddingVertical: 14,
                                  paddingHorizontal: 14,
                                  backgroundColor: pressed ? UI.monthBannerPressed : UI.monthBannerBg,
                                  borderBottomWidth: expanded ? 1 : 0,
                                  borderBottomColor: UI.monthGroupBorder,
                                })}
                              >
                                <Text
                                  style={{
                                    fontSize: 14,
                                    color: UI.textSecondary,
                                    width: 22,
                                    textAlign: "center",
                                    fontWeight: "600",
                                  }}
                                >
                                  {chevron}
                                </Text>
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={{
                                      fontSize: 15,
                                      fontWeight: "700",
                                      color: UI.textPrimary,
                                      letterSpacing: 0.15,
                                    }}
                                  >
                                    {formatFamilyCompetitionMonthHeading(monthKey)}
                                  </Text>
                                  <Text style={{ marginTop: 3, fontSize: 12, color: UI.textSecondary }}>
                                    {entries.length} {entries.length === 1 ? "event" : "events"}
                                  </Text>
                                </View>
                              </Pressable>
                              {expanded ? (
                                <View
                                  style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 12,
                                    gap: 10,
                                    backgroundColor: UI.monthListWellBg,
                                  }}
                                >
                                  {entries.map((entry) => {
                                    const chipBase = familyCompetitionChipForEntry(
                                      entry,
                                      familyCompetition.todayYMD,
                                    );
                                    const chip = {
                                      ...chipBase,
                                      ...familyFacingCompetitionChipStyle(chipBase),
                                    };
                                    const promoterFmt = familyCompetitionPromoterFormatLine(
                                      entry,
                                      72,
                                    );
                                    const showResult = shouldShowFamilyCompetitionResult(
                                      entry,
                                      "recent",
                                      familyCompetition.todayYMD,
                                    );
                                    return (
                                      <Swipeable
                                        key={entry.id}
                                        overshootRight={false}
                                        enabled={
                                          Boolean(familyCompetition.kidId) &&
                                          !kidCompetitionEntryIsSyncedFromWorker(entry)
                                        }
                                        renderRightActions={() =>
                                          familyCompetitionSwipeDeleteAction(entry)
                                        }
                                      >
                                        <GestureTouchableOpacity
                                          disabled={!familyCompetition.kidId}
                                          activeOpacity={familyCompetition.kidId ? 0.85 : 1}
                                          onPress={() => {
                                            const k = familyCompetition.kidId;
                                            if (!k) return;
                                            router.push(
                                              `/this-week/family-competition/edit?kidId=${encodeURIComponent(k)}&entryId=${encodeURIComponent(entry.id)}`,
                                            );
                                          }}
                                          style={{
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: UI.competitionRowBorder,
                                            backgroundColor: UI.competitionRowBg,
                                            paddingVertical: 14,
                                            paddingHorizontal: 14,
                                          }}
                                        >
                                          <View
                                            style={{
                                              flexDirection: "row",
                                              justifyContent: "space-between",
                                              alignItems: "flex-start",
                                              gap: 12,
                                            }}
                                          >
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                              <Text
                                                numberOfLines={2}
                                                ellipsizeMode="tail"
                                                style={{
                                                  fontSize: 16,
                                                  fontWeight: "700",
                                                  color: UI.textPrimary,
                                                  lineHeight: 22,
                                                }}
                                              >
                                                {entry.tournamentName}
                                              </Text>
                                              <Text
                                                style={{
                                                  fontSize: 14,
                                                  color: UI.textSecondary,
                                                  marginTop: 6,
                                                }}
                                              >
                                                {formatFamilyCompetitionDate(entry.eventDate)}
                                              </Text>
                                              {promoterFmt ? (
                                                <Text
                                                  numberOfLines={1}
                                                  ellipsizeMode="tail"
                                                  style={{
                                                    fontSize: 13,
                                                    color: UI.textSecondary,
                                                    marginTop: 4,
                                                  }}
                                                >
                                                  {promoterFmt}
                                                </Text>
                                              ) : null}
                                              {showResult && entry.result ? (
                                                <Text
                                                  style={{
                                                    fontSize: 13,
                                                    color: UI.textSecondary,
                                                    marginTop: 8,
                                                  }}
                                                >
                                                  Result:{" "}
                                                  {familyCompetitionResultLabel(entry.result)}
                                                </Text>
                                              ) : null}
                                            </View>
                                            <View
                                              style={{
                                                paddingVertical: 5,
                                                paddingHorizontal: 10,
                                                borderRadius: 999,
                                                backgroundColor: chip.backgroundColor,
                                              }}
                                            >
                                              <Text
                                                style={{
                                                  fontSize: 11,
                                                  fontWeight: "700",
                                                  color: chip.textColor,
                                                }}
                                              >
                                                {chip.label}
                                              </Text>
                                            </View>
                                          </View>
                                        </GestureTouchableOpacity>
                                      </Swipeable>
                                    );
                                  })}
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                ) : null}
              </Section>

            {isLinked && hasCompletionSummary ? (
              <Section title="Nice work">
                <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 4, color: UI.textPrimary }}>
                  {completionAssignmentTitle}
                </Text>
                {completionPack || completionModule ? (
                  <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
                    {completionModule?.title
                      ? `${completionModule.title}${
                          completionPack?.title
                            ? ` · ${completionPack.title}`
                            : ""
                        }`
                      : completionPack?.title}
                  </Text>
                ) : null}
                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontSize: 14, color: UI.textSecondary }}>
                    Logged:{" "}
                    <Text style={{ fontWeight: "500", color: UI.textPrimary }}>
                      {completionCompletedAtDate
                        ? completionCompletedAtDate.toLocaleDateString()
                        : "—"}
                    </Text>
                  </Text>
                  <Text style={{ fontSize: 14, marginTop: 2, color: UI.textSecondary }}>
                    Saved on this phone for now
                  </Text>
                </View>
              </Section>
            ) : null}

            {isLinked ? (
              <Section title="Link & refresh" tone="default">
                <Text
                  style={{
                    fontSize: 15,
                    color: UI.textSecondary,
                    lineHeight: 23,
                    marginBottom: 12,
                  }}
                >
                  Manage your coach link (athletes + invite), then refresh anytime for the latest weekly note.
                </Text>
                <Pressable
                  onPress={() => router.push("/this-week/manage")}
                  style={({ pressed }) => ({
                    paddingVertical: 14,
                    paddingHorizontal: 18,
                    borderRadius: CARD_RADIUS,
                    borderWidth: 1,
                    borderColor: UI.addCompetitionBorder,
                    backgroundColor: pressed ? UI.addCompetitionBgPressed : UI.addCompetitionBg,
                    alignSelf: "stretch",
                    alignItems: "center",
                    marginBottom: 10,
                  })}
                >
                  <Text style={{ fontSize: 16, fontWeight: "800", color: UI.primaryFill }}>
                    Manage coach link
                  </Text>
                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: UI.textSecondary,
                      textAlign: "center",
                      lineHeight: 19,
                    }}
                  >
                    Add or remove athletes, or remove this invite from this device only.
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void loadCoachShareData()}
                  style={({ pressed }) => ({
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    alignSelf: "flex-start",
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: UI.primaryFill }}>
                    {useWeeklySyncHero ? "Refresh weekly note now" : "Refresh shared updates"}
                  </Text>
                </Pressable>
              </Section>
            ) : null}

            {showCoachOperationalTools ? (
              <>
                <Section title="Coach tools">
                  <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
                    Coach tools on this device — use Profile → Switch role if this phone is for a parent.
                  </Text>
                  <Pressable
                    onPress={() => router.push("/this-week/kids")}
                    style={({ pressed }) => cardButtonStyle(pressed)}
                  >
                    <Text style={{ fontSize: 16, color: UI.textPrimary, fontWeight: "700" }}>
                      Kids roster
                    </Text>
                    <Text style={{ marginTop: 4, fontSize: 13, color: UI.textSecondary }}>
                      Roster + kid-specific weekly focus
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push("/this-week/create-pack")}
                    style={({ pressed }) => cardButtonStyle(pressed)}
                  >
                    <Text style={{ fontSize: 15, color: UI.textSecondary, fontWeight: "600" }}>
                      Template preview
                    </Text>
                    <Text style={{ marginTop: 4, fontSize: 12, color: UI.textSecondary }}>
                      Coach-side preview only; use Kids roster for kid weekly focus.
                    </Text>
                  </Pressable>
                </Section>

                {pilotPreviewItems.length > 0 ? (
                  <Section title="Weekly focus preview">
                    <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
                      Saved on this device only — not shared with families until you publish from a kid’s weekly focus.
                    </Text>

                    <View style={{ marginTop: 12, gap: 10 }}>
                      {pilotPreviewItems.slice(0, 3).map((item) => {
                        const label = item.type === "template" ? "TEMPLATE" : "CUSTOM";
                        const meta = item.type === "template" ? item.metadata : item.note;
                        return (
                          <View
                            key={item.id}
                            style={{
                              padding: 12,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: UI.border,
                              backgroundColor: UI.bgCard,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                color: UI.textSecondary,
                                letterSpacing: 0.6,
                                fontWeight: "600",
                              }}
                            >
                              {label}
                            </Text>
                            <Text
                              style={{
                                fontSize: 16,
                                fontWeight: "700",
                                marginTop: 6,
                                color: UI.textPrimary,
                              }}
                            >
                              {item.title}
                            </Text>
                            {meta ? (
                              <Text
                                style={{
                                  fontSize: 14,
                                  color: UI.textSecondary,
                                  marginTop: 6,
                                  lineHeight: 20,
                                }}
                              >
                                {meta}
                              </Text>
                            ) : null}
                            <View
                              style={{
                                marginTop: 10,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <Text style={{ fontSize: 12, color: UI.textSecondary }}>
                                Added:{" "}
                                <Text style={{ fontWeight: "500", color: UI.textPrimary }}>
                                  {new Date(item.createdAt).toLocaleDateString()}
                                </Text>
                              </Text>
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                {isUsableYoutubeUrl(item.youtubeUrl) ? (
                                  <Pressable
                                    onPress={() => void openYoutubeUrl(item.youtubeUrl)}
                                    style={({ pressed }) => ({
                                      paddingVertical: 6,
                                      paddingHorizontal: 10,
                                      borderRadius: 999,
                                      borderWidth: 1,
                                      borderColor: UI.border,
                                      backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
                                    })}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 11,
                                        fontWeight: "700",
                                        color: UI.textPrimary,
                                      }}
                                    >
                                      YT
                                    </Text>
                                  </Pressable>
                                ) : null}
                                <Pressable
                                  onPress={() => void handleRemovePilotPreviewItem(item.id)}
                                  style={({ pressed }) => ({
                                    paddingVertical: 6,
                                    paddingHorizontal: 10,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: UI.border,
                                    backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
                                  })}
                                >
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      color: UI.textPrimary,
                                      fontWeight: "600",
                                    }}
                                  >
                                    Remove
                                  </Text>
                                </Pressable>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                      <Text style={{ fontSize: 12, color: UI.textSecondary }}>
                        {pilotPreviewItems.length}/3 items saved
                      </Text>
                    </View>

                    <View style={{ marginTop: 14, gap: 10 }}>
                      <Pressable
                        onPress={() => router.push("/this-week/custom-focus")}
                        style={({ pressed }) => ({
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                          borderRadius: CARD_RADIUS,
                          borderWidth: 1,
                          borderColor: UI.border,
                          backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
                          alignSelf: "flex-start",
                        })}
                      >
                        <Text style={{ fontSize: 15, color: UI.textPrimary, fontWeight: "700" }}>
                          Add Custom Focus
                        </Text>
                        <Text style={{ marginTop: 4, fontSize: 12, color: UI.textSecondary }}>
                          Title required. Optional short note. Saved on this device only.
                        </Text>
                      </Pressable>
                    </View>
                  </Section>
                ) : (
                  <Section title="Weekly focus preview">
                    <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
                      Saved on this device only — not shared with families until you publish from a kid’s weekly focus.
                    </Text>
                    <Text style={{ marginTop: 10, fontSize: 14, color: UI.textSecondary }}>
                      No preview items yet. Add a template from Coach tools or add a custom focus.
                    </Text>
                  </Section>
                )}
              </>
            ) : null}

            {showDebugStoragePanel ? (
              <Section title="Debug Data">
                <Text style={{ fontSize: 14, color: UI.textSecondary }}>Links: {coachLinks.length}</Text>
                <Text style={{ fontSize: 14, color: UI.textSecondary }}>
                  Coaches: {Object.keys(coachesById).length}
                </Text>
                <Text style={{ fontSize: 14, color: UI.textSecondary }}>
                  Packs: {Object.keys(packsById).length}
                </Text>
                <Text style={{ fontSize: 14, color: UI.textSecondary }}>
                  Enrollments: {packEnrollments.length}
                </Text>
                <Text style={{ fontSize: 14, color: UI.textSecondary }}>
                  Assignments: {Object.keys(assignmentsById).length}
                </Text>
                <Text style={{ fontSize: 14, color: UI.textSecondary }}>
                  Receipt queue: {completionReceiptsQueue.length}
                </Text>
                <Text style={{ fontSize: 14, color: UI.textSecondary }}>
                  Weekly focus preview items: {pilotPreviewItems.length}
                </Text>
              </Section>
            ) : null}
          </>
        )}
      </KeyboardAwareScrollView>
        </>
      )}
    </>
  );
}
