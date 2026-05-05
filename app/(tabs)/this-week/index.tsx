import { Stack, router, useFocusEffect, type Href } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

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
import { safeReplace } from "../../../src/navigation/safeNavigate";
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
import {
  resolveWeeklyDoc,
  sharedAthleteIdFromRosterForSession,
} from "../../../src/coach/resolveWeeklyDoc";
import { coachSyncFetchSession } from "../../../src/services/coachWeeklySyncApi";
import type {
  SyncedSharedAthlete,
  SyncedWeeklyMessagePayload,
} from "../../../src/types/coachWeeklySync";
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
  formatFamilyCompetitionDate,
  kidDisplayNameForId,
  partitionFamilyCompetitionEntries,
  resolveFamilyCompetitionKidId,
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
import { getCompetitionMediaPresenceForEntryIds } from "../../../src/storage/competitionStore";
import { getKidCompetitionEntriesForKid } from "../../../src/storage/kidCompetitionStore";
import { setActiveKidId, useActiveKidId } from "../../../src/state/activeKidStore";
import type { Session } from "../../../src/types";
import {
  type Kid,
  type KidCompetitionEntry,
  type KidId,
  type KidsById,
} from "../../../src/types/coachKid";
import { normalizeFamilyResourceUrl } from "../../../src/coach/familyResourceUrl";
import { tokens } from "../../../src/theme/tokens";
import { buildReadTogetherStoryCards } from "../../../src/family/readTogetherStoryCards";
import { ReadTogetherStoryModal } from "../../../src/family/ReadTogetherStoryModal";
import {
  markWeeklyAcknowledged,
  markWeeklyViewed,
} from "../../../src/features/weekly/parentFeedbackHelpers";
import { useIdentity } from "@/src/identity/useIdentity";

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

const FEED = {
  bg: "#111315",
  panel: "#181b1f",
  panel2: "#20242a",
  panel3: "#252a31",
  line: "rgba(236, 241, 245, 0.12)",
  lineStrong: "rgba(236, 241, 245, 0.2)",
  text: "#f2f4f6",
  muted: "#a9b0b8",
  faint: "#777f89",
  accent: "#d6ff3f",
  accentPressed: "#c7f11f",
  accentDark: "#111315",
  radius: 6,
};

/** Richer chip fills for competition rows (labels stable from `familyCompetitionChipForEntry`). */
function familyFacingCompetitionChipStyle(chip: {
  label: string;
  backgroundColor: string;
  textColor: string;
}): { backgroundColor: string; textColor: string } {
  switch (chip.label) {
    case "Coming up":
      return { backgroundColor: FEED.panel3, textColor: FEED.text };
    case "Past event":
      return { backgroundColor: FEED.panel2, textColor: FEED.muted };
    case "Completed":
      return { backgroundColor: FEED.panel2, textColor: FEED.text };
    case "Cancelled":
      return { backgroundColor: FEED.panel2, textColor: FEED.muted };
    default:
      return { backgroundColor: chip.backgroundColor, textColor: chip.textColor };
  }
}

const CARD_RADIUS = 16;
const SECTION_LABEL = { fontSize: 11, letterSpacing: 1.2, color: "#6b7280", fontWeight: "600" as const };

/** Parent weekly: resolve family-competition kid only within kids coherent with the active redeemed weekly invite token. */
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

type WeeklySessionSnapshot = {
  weekly: SyncedWeeklyMessagePayload | null;
  weeklyByAthleteId: Record<string, SyncedWeeklyMessagePayload | null>;
  athletes: SyncedSharedAthlete[];
};

function logWeeklyKidMapping({
  kidsById,
  weeklySessionSnapshot,
}: {
  kidsById: Record<string, any> | null | undefined;
  weeklySessionSnapshot: any;
}) {
  if (!kidsById || !weeklySessionSnapshot) return;

  const available = Object.keys(
    weeklySessionSnapshot.weeklyByAthleteId ?? {},
  );

  const rows = Object.entries(kidsById).map(([kidId, kid]) => {
    const sharedAthleteId = kid?.sharedAthleteId ?? null;
    const valid =
      sharedAthleteId != null && available.includes(sharedAthleteId);

    return {
      kidId,
      sharedAthleteId,
      valid,
    };
  });

  console.log("[WEEKLY KID MAPPING]", {
    available,
    rows,
    validKids: rows.filter((r) => r.valid),
    invalidKids: rows.filter((r) => !r.valid),
  });
}

function resolveStrictWeeklySelectedSharedAthleteIdForKid(
  kidId: string | null | undefined,
  kidsById: KidsById | null | undefined,
  weeklySessionSnapshot: WeeklySessionSnapshot | null | undefined,
): string | null {
  const normalizedKidId = kidId?.trim();
  if (!normalizedKidId || !kidsById || !weeklySessionSnapshot) return null;

  const weeklyMap = weeklySessionSnapshot.weeklyByAthleteId ?? {};
  const candidate = sharedAthleteIdFromRosterForSession(
    normalizedKidId,
    kidsById[normalizedKidId]?.sharedAthleteId,
    weeklySessionSnapshot.athletes,
  );

  if (!candidate) return null;
  if (!(candidate in weeklyMap)) return null;
  return candidate;
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
      ? { backgroundColor: FEED.panel, borderColor: FEED.line }
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
  /** Per entry id: any match in local detail store has imageUri / videoUri. */
  mediaByEntryId: Record<string, { hasVideo: boolean; hasImage: boolean }>;
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
  mediaByEntryId: {},
};

/** Training / kid detail list: compact media label (parent This Week competition cards). */
function CompetitionMediaPills({
  hasVideo,
  hasImage,
}: {
  hasVideo: boolean;
  hasImage: boolean;
}) {
  if (!hasVideo && !hasImage) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 }}>
      {hasVideo ? (
        <View
          style={{
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: UI.bgCardActive,
            borderWidth: 1,
            borderColor: UI.border,
          }}
        >
          <Text style={{ color: UI.textSecondary, fontSize: 10, fontWeight: "700" }}>VID</Text>
        </View>
      ) : null}
      {hasImage ? (
        <View
          style={{
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: UI.bgCardActive,
            borderWidth: 1,
            borderColor: UI.border,
          }}
        >
          <Text style={{ color: UI.textSecondary, fontSize: 10, fontWeight: "700" }}>IMG</Text>
        </View>
      ) : null}
    </View>
  );
}

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

/** Coach role: minimal This Week tab surface — parent weekly hooks/data live only in `ParentThisWeekScreen`. */
function CoachThisWeekShell() {
  return (
    <>
      <Stack.Screen options={{ title: "This Week" }} />
      <KeyboardAwareScrollView
        enableOnAndroid
        extraScrollHeight={80}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: UI.screenBg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
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
            onPress={() => router.push("/coach/kids")}
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
      </KeyboardAwareScrollView>
    </>
  );
}

function ParentThisWeekScreen() {
  console.log("[RENDER_TRACE:PARENT_THIS_WEEK]");
  const { role } = useDeviceRole();
  const activeKidIdFromStore = useActiveKidId();
  const roleRef = useRef(role);
  roleRef.current = role;
  const mountCountRef = useRef(0);
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
  /** Invite-level `weekly` plus per-athlete map; `weeklySyncDoc` is derived via useMemo. */
  const [weeklySessionSnapshot, setWeeklySessionSnapshot] = useState<WeeklySessionSnapshot | null>(null);
  const derivedActiveAthleteId = useMemo(() => {
    if (!activeKidIdFromStore) return null;
    if (!kidsByIdState || Object.keys(kidsByIdState).length === 0) return null;
    if (!weeklySessionSnapshot?.weeklyByAthleteId) return null;

    const available = Object.keys(weeklySessionSnapshot.weeklyByAthleteId ?? {});
    const rows = Object.entries(kidsByIdState).map(([kidId, kid]) => {
      const sharedAthleteId = kid?.sharedAthleteId ?? null;
      const valid =
        sharedAthleteId != null && available.includes(sharedAthleteId);

      return {
        kidId,
        sharedAthleteId,
        valid,
      };
    });
    const validKids = rows.filter((r) => r.valid);
    const match = validKids.find((k) => k.kidId === activeKidIdFromStore);

    return match?.sharedAthleteId ?? null;
  }, [
    activeKidIdFromStore,
    kidsByIdState,
    weeklySessionSnapshot?.weeklyByAthleteId,
  ]);
  console.log("[DERIVED ATHLETE RESOLVE]", {
    activeKidIdFromStore,
    hasKids: !!kidsByIdState,
    weeklyKeys: Object.keys(weeklySessionSnapshot?.weeklyByAthleteId || {}),
    result: derivedActiveAthleteId,
  });

  useEffect(() => {
    mountCountRef.current += 1;
    console.log("[MOUNT_TRACE:PARENT_THIS_WEEK]", mountCountRef.current);
    console.log("[THIS WEEK MOUNT]", {
      activeKidIdFromStore,
      derivedActiveAthleteId,
    });
  }, []);

  const weeklySyncDoc = useMemo(() => {
    if (!weeklySessionSnapshot) return null;
    return resolveWeeklyDoc(weeklySessionSnapshot, derivedActiveAthleteId);
  }, [weeklySessionSnapshot, derivedActiveAthleteId]);
  const [weeklySyncFetchFailed, setWeeklySyncFetchFailed] = useState(false);
  const [weeklySyncFetchedAt, setWeeklySyncFetchedAt] = useState<string | null>(null);
  const [weeklySyncFromCache, setWeeklySyncFromCache] = useState(false);
  const [weeklySyncNetworkOk, setWeeklySyncNetworkOk] = useState(false);
  const weeklyKidMappingLoggedKeyRef = useRef<string | null>(null);
  /** Dev + parent: show after successful weekly fetch when `weekly.updatedAt` is newer than local last-seen. */
  const [showNewCoachUpdateBanner, setShowNewCoachUpdateBanner] = useState(false);
  const [practiceSummary, setPracticeSummary] = useState<ParentWeeklyPracticeSummary>(
    INITIAL_PRACTICE_SUMMARY,
  );
  const [kidsByIdState, setKidsByIdState] = useState<KidsById>({});
  const identity = useIdentity(kidsByIdState, weeklySessionSnapshot);
  if (__DEV__) {
    console.log("[IDENTITY SHADOW]", {
      status: identity.status,
      kidId: identity.kidId,
      sharedAthleteId: identity.sharedAthleteId,
      hasWeeklyDoc: !!identity.weeklyDoc,

      // existing system values
      activeKidIdFromStore,
      derivedActiveAthleteId,
      hasWeeklyDocOld: !!weeklySyncDoc,

      weeklyKeys: Object.keys(weeklySessionSnapshot?.weeklyByAthleteId || {}),
    });
  }
  /** Invalidates in-flight `loadCoachShareData` family competition writes so delete wins over stale reloads. */
  const applyFamilyCompGenRef = useRef(0);
  /** User tapped Refresh — bypass `coachSyncFetchSession` once-per-token skip. */
  const forceWeeklySessionFetchRef = useRef(false);
  /** Normalized weekly sync link token after last successful `coachSyncFetchSession` (null after failed fetch or no link). */
  const weeklySessionNetworkOkTokenRef = useRef<string | null>(null);

  const setStateIfJsonChanged = useCallback(
    <T,>(_source: string, setter: Dispatch<SetStateAction<T>>, next: T) => {
      setter((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (role !== "parent" || !familyCompetition.kidId) return;
    setActiveKidId(familyCompetition.kidId);
  }, [role, familyCompetition.kidId]);

  useEffect(() => {
    if (!kidsByIdState || !weeklySessionSnapshot) return;

    const logKey = JSON.stringify({
      kidIds: Object.keys(kidsByIdState),
      weeklyAthleteIds: Object.keys(weeklySessionSnapshot.weeklyByAthleteId ?? {}),
      weeklyUpdatedAt: weeklySessionSnapshot.weekly?.updatedAt ?? null,
    });
    if (weeklyKidMappingLoggedKeyRef.current === logKey) return;
    weeklyKidMappingLoggedKeyRef.current = logKey;

    logWeeklyKidMapping({
      kidsById: kidsByIdState,
      weeklySessionSnapshot,
    });
  }, [kidsByIdState, weeklySessionSnapshot]);

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
        mediaByEntryId: {},
      };
      if (kidId) {
        const compEntries = await getKidCompetitionEntriesForKid(kidId);
        const part = partitionFamilyCompetitionEntries(compEntries, today);
        const competitionIds = Array.from(
          new Set([...part.upcoming, ...part.recent].map((e) => e.id).filter(Boolean)),
        );
        const mediaByEntryId = await getCompetitionMediaPresenceForEntryIds(competitionIds);
        nextFamily = {
          ...nextFamily,
          upcoming: part.upcoming,
          recent: part.recent,
          mediaByEntryId,
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

  const computeParentKidScopedStateRef = useRef(computeParentKidScopedState);
  computeParentKidScopedStateRef.current = computeParentKidScopedState;

  /** Empty deps: `role` and kid-scoped compute read via refs so `useFocusEffect` keeps a stable subscription. */
  const loadCoachShareData = useCallback(async () => {
    setReady((prev) => (prev === false ? prev : false));

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

    const roleNow = roleRef.current;
    let parentStrictOrderedForLoad: CoachLink[] = [];
    if (roleNow === "parent") {
      parentStrictOrderedForLoad = parentStrictWeeklyLinkedCoachLinksForUi(loadedCoachLinks);
    }

    const linksForParentWeeklyFetch =
      roleNow === "parent"
        ? parentStrictOrderedForLoad
        : loadedCoachLinks.filter((l) => l.status === "active");
    const activeWeeklySyncLink =
      roleNow === "parent"
        ? linksForParentWeeklyFetch[0]
        : linksForParentWeeklyFetch.find((l) => l.weeklySync);
    let nextWeeklyFetchFailed = false;
    let nextWeeklyFetchedAt: string | null = null;
    let nextWeeklyFromCache = false;
    let nextWeeklyNetworkOk = false;
    let nextWeeklySnapshot: {
      weekly: SyncedWeeklyMessagePayload | null;
      weeklyByAthleteId: Record<string, SyncedWeeklyMessagePayload | null>;
      athletes: SyncedSharedAthlete[];
    } | null = null;
    let parentMergedWeekly: SyncedWeeklyMessagePayload | null = null;

    if (activeWeeklySyncLink?.weeklySync) {
      const rawWeeklyLinkToken = activeWeeklySyncLink.weeklySync.linkToken;
      const normWeeklyLinkToken = normalizeInviteLinkToken(rawWeeklyLinkToken);
      const skipSessionNetwork =
        !forceWeeklySessionFetchRef.current &&
        normWeeklyLinkToken.length > 0 &&
        weeklySessionNetworkOkTokenRef.current === normWeeklyLinkToken;

      if (skipSessionNetwork) {
        const cached = await getCachedWeeklyForLinkToken(rawWeeklyLinkToken);
        nextWeeklyFetchFailed = false;
        nextWeeklyNetworkOk = true;
        nextWeeklyFromCache = true;
        nextWeeklyFetchedAt = cached?.fetchedAt ?? null;
        parentMergedWeekly = cached?.weekly ?? null;
        nextWeeklySnapshot = {
          weekly: cached?.weekly ?? null,
          weeklyByAthleteId: cached?.weeklyByAthleteId ?? {},
          athletes: cached?.athletes ?? [],
        };
      } else {
        forceWeeklySessionFetchRef.current = false;
        try {
          console.log("[API CALL]", { op: "coachSyncFetchSession", tokenNorm: normWeeklyLinkToken });
          const session = await coachSyncFetchSession(
            activeWeeklySyncLink.weeklySync.linkToken,
            activeWeeklySyncLink.weeklySync.apiBaseUrl,
          );
          weeklySessionNetworkOkTokenRef.current = normWeeklyLinkToken;
          if (__DEV__) {
            const invite = session.weekly;
            const map = session.weeklyByAthleteId ?? {};
            const mapKeys = Object.keys(map);
            const firstKey = mapKeys[0];
            const firstAthlete = firstKey ? map[firstKey] : null;
            const recap = (invite?.familyCoachRecapNote ?? "").trim();
            console.log("[bjj-parent-weekly-sync-doc]", {
              inviteLevelMission: (invite?.missionResourceUrl ?? "").trim() || null,
              inviteLevelFamily: (invite?.familyResourceUrl ?? "").trim() || null,
              familyResourceLabel: (invite?.familyResourceLabel ?? "").trim() || null,
              fetchedFamilyCoachRecapNoteLen: recap.length,
              weeklyByAthleteIdKeys: mapKeys,
              sampleAthleteLinks:
                firstAthlete && typeof firstAthlete === "object"
                  ? {
                      mission: (firstAthlete.missionResourceUrl ?? "").trim() || null,
                      family: (firstAthlete.familyResourceUrl ?? "").trim() || null,
                    }
                  : null,
            });
          }
          nextWeeklyFetchFailed = false;
          nextWeeklyFromCache = false;
          nextWeeklyNetworkOk = true;
          const nowIso = new Date().toISOString();
          nextWeeklyFetchedAt = nowIso;
          if (roleNow === "parent") {
            const incoming = session.weekly;
            const byAthlete = session.weeklyByAthleteId ?? {};
            if (incoming) {
              parentMergedWeekly = incoming;
              nextWeeklySnapshot = {
                weekly: incoming,
                weeklyByAthleteId: byAthlete,
                athletes: session.athletes,
              };
              await setCachedWeeklyForLinkToken(
                activeWeeklySyncLink.weeklySync.linkToken,
                incoming,
                nowIso,
                byAthlete,
                session.athletes,
                session,
                normWeeklyLinkToken,
              );
            } else {
              // Coach publish with `sharedAthleteId` stores only `weeklyByAthleteId`; invite-level `weekly` stays null.
              // We must still persist the map or `resolveWeeklyDoc` never sees athlete docs (snapshot was only updated when `weekly` was non-null).
              nextWeeklySnapshot = {
                weekly: null,
                weeklyByAthleteId: byAthlete,
                athletes: session.athletes,
              };
              await setCachedWeeklyForLinkToken(
                activeWeeklySyncLink.weeklySync.linkToken,
                null,
                nowIso,
                byAthlete,
                session.athletes,
                session,
                normWeeklyLinkToken,
              );
            }
          } else {
            await setCachedWeeklyForLinkToken(
              activeWeeklySyncLink.weeklySync.linkToken,
              session.weekly,
              nowIso,
              session.weeklyByAthleteId ?? {},
              session.athletes,
              session,
              normWeeklyLinkToken,
            );
            nextWeeklySnapshot = {
              weekly: session.weekly,
              weeklyByAthleteId: session.weeklyByAthleteId ?? {},
              athletes: session.athletes,
            };
          }
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
        } catch {
          weeklySessionNetworkOkTokenRef.current = null;
          nextWeeklyFetchFailed = true;
          nextWeeklyNetworkOk = false;
          const cached = await getCachedWeeklyForLinkToken(
            activeWeeklySyncLink.weeklySync.linkToken,
          );
          nextWeeklyFetchedAt = cached?.fetchedAt ?? null;
          nextWeeklyFromCache = true;
          nextWeeklySnapshot = {
            weekly: cached?.weekly ?? null,
            weeklyByAthleteId: cached?.weeklyByAthleteId ?? {},
            athletes: cached?.athletes ?? [],
          };
        }
      }
    } else {
      weeklySessionNetworkOkTokenRef.current = null;
    }

    setStateIfJsonChanged("loadCoachShareData:weeklySyncFetchFailed", setWeeklySyncFetchFailed, nextWeeklyFetchFailed);
    setStateIfJsonChanged("loadCoachShareData:weeklySyncFetchedAt", setWeeklySyncFetchedAt, nextWeeklyFetchedAt);
    setStateIfJsonChanged("loadCoachShareData:weeklySyncFromCache", setWeeklySyncFromCache, nextWeeklyFromCache);
    setStateIfJsonChanged("loadCoachShareData:weeklySyncNetworkOk", setWeeklySyncNetworkOk, nextWeeklyNetworkOk);

    const today = todayYMD();
    const strictWeeklyForParent = roleNow === "parent" ? parentStrictOrderedForLoad : [];
    const activeWeeklyInviteTokenNorm =
      roleNow === "parent" && strictWeeklyForParent[0]?.weeklySync?.linkToken
        ? normalizeInviteLinkToken(strictWeeklyForParent[0].weeklySync.linkToken)
        : "";
    const rosterKidId =
      roleNow === "parent" && activeWeeklyInviteTokenNorm
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

    setStateIfJsonChanged("loadCoachShareData:weeklySessionSnapshot", setWeeklySessionSnapshot, nextWeeklySnapshot);

    if (
      activeWeeklySyncLink?.weeklySync &&
      isDev() &&
      roleNow === "parent" &&
      parentMergedWeekly?.updatedAt
    ) {
      const lastSeen = await getLastSeenUpdatedAt(activeWeeklySyncLink.weeklySync.linkToken);
      if (lastSeen === null || parentMergedWeekly.updatedAt > lastSeen) {
        nextShowNewCoachUpdateBanner = true;
      }
    }
    setStateIfJsonChanged(
      "loadCoachShareData:showNewCoachUpdateBanner",
      setShowNewCoachUpdateBanner,
      nextShowNewCoachUpdateBanner,
    );

    const compApplyGen = ++applyFamilyCompGenRef.current;
    const { nextFamily, nextPracticeSummary } = await computeParentKidScopedStateRef.current(
      rosterKidId,
      loadedKidsById,
      today,
    );

    setFamilyCompetition((prev) => {
      if (compApplyGen !== applyFamilyCompGenRef.current) return prev;
      if (JSON.stringify(prev) === JSON.stringify(nextFamily)) return prev;
      return nextFamily;
    });
    setStateIfJsonChanged("loadCoachShareData:practiceSummary", setPracticeSummary, nextPracticeSummary);
    setStateIfJsonChanged("loadCoachShareData:kidsByIdState", setKidsByIdState, loadedKidsById);

    setStateIfJsonChanged("loadCoachShareData:coachLinks", setCoachLinks, loadedCoachLinks);
    setStateIfJsonChanged("loadCoachShareData:coachesById", setCoachesById, loadedCoachesById);
    setStateIfJsonChanged("loadCoachShareData:packsById", setPacksById, loadedPacksById);
    setStateIfJsonChanged("loadCoachShareData:packEnrollments", setPackEnrollments, loadedPackEnrollments);
    setStateIfJsonChanged("loadCoachShareData:assignmentsById", setAssignmentsById, loadedAssignmentsById);
    setStateIfJsonChanged(
      "loadCoachShareData:completionReceiptsQueue",
      setCompletionReceiptsQueue,
      loadedCompletionReceiptsQueue,
    );
    setStateIfJsonChanged("loadCoachShareData:pilotPreviewItems", setPilotPreviewItemsState, loadedPilotPreviewItems);
    setReady((prev) => {
      if (prev === true) return prev;
      return true;
    });
  }, []);

  const refreshParentData = useCallback(() => {
    forceWeeklySessionFetchRef.current = true;
    void loadCoachShareData();
  }, [loadCoachShareData]);

  useFocusEffect(
    useCallback(() => {
      console.log("[THIS WEEK FOCUS]", {
        activeKidIdFromStore,
        derivedActiveAthleteId,
      });
      void loadCoachShareData();
    }, [activeKidIdFromStore, derivedActiveAthleteId, loadCoachShareData]),
  );

  useEffect(() => {
    if (!__DEV__ || role !== "parent") return;
    const trace = buildDevParentWeeklyLinkedStateTrace(coachLinks);
    console.log("[mm:autoRelink]", {
      step: "parent_weekly_screen",
      ...trace,
    });
  }, [coachLinks, role]);

  const familyUpcomingExcludingHero = useMemo(
    () => familyCompetition.upcoming.slice(1),
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

  // Parent-focused redesign: keep the competition calendar collapsed by default
  // (we show a dedicated "Next competition" card instead).
  const [competitionCalendarExpanded, setCompetitionCalendarExpanded] = useState(false);
  const [linkRefreshExpanded, setLinkRefreshExpanded] = useState(false);

  const allCoaches = Object.values(coachesById);
  const allPacks = Object.values(packsById);
  const allAssignments = Object.values(assignmentsById);

  const parentStrictOrderForUi = useMemo(() => {
    if (role !== "parent") return [] as CoachLink[];
    return parentStrictWeeklyLinkedCoachLinksForUi(coachLinks);
  }, [role, coachLinks]);

  const activeCoachLinks =
    role === "parent"
      ? activeCoachLinksForParentLinkedUi(coachLinks)
      : coachLinks.filter((link) => link.status === "active");
  const isLinked = activeCoachLinks.length > 0;
  const previousIsLinkedRef = useRef(isLinked);

  useEffect(() => {
    if (!isLinked) {
      setLinkRefreshExpanded((prev) => (prev === true ? prev : true));
    } else if (!previousIsLinkedRef.current && isLinked) {
      setLinkRefreshExpanded((prev) => (prev === false ? prev : false));
    }
    previousIsLinkedRef.current = isLinked;
  }, [isLinked]);

  const weeklySyncLink =
    role === "parent"
      ? parentStrictOrderForUi[0]
      : activeCoachLinks.find((l) => l.weeklySync);
  const useWeeklySyncHero = Boolean(weeklySyncLink);

  const updateWeeklyFeedback = useCallback(
    async (
      update: (weekly: SyncedWeeklyMessagePayload) => SyncedWeeklyMessagePayload,
    ) => {
      const rawToken = weeklySyncLink?.weeklySync?.linkToken;
      if (!rawToken?.trim() || !weeklySessionSnapshot || !weeklySyncDoc) return;

      const selectedSharedAthleteId = derivedActiveAthleteId?.trim() ?? "";
      const currentMap = weeklySessionSnapshot.weeklyByAthleteId ?? {};
      const updatesAthleteDoc =
        selectedSharedAthleteId.length > 0 &&
        Object.prototype.hasOwnProperty.call(currentMap, selectedSharedAthleteId) &&
        currentMap[selectedSharedAthleteId] != null;
      const nextDoc = update({
        ...weeklySyncDoc,
        parentFeedback: weeklySyncDoc.parentFeedback
          ? { ...weeklySyncDoc.parentFeedback }
          : undefined,
      });
      const nextWeeklyByAthleteId = { ...currentMap };
      const nextWeekly = updatesAthleteDoc
        ? weeklySessionSnapshot.weekly
        : nextDoc;

      if (updatesAthleteDoc) {
        nextWeeklyByAthleteId[selectedSharedAthleteId] = nextDoc;
      }

      const nextSnapshot = {
        weekly: nextWeekly,
        weeklyByAthleteId: nextWeeklyByAthleteId,
        athletes: weeklySessionSnapshot.athletes,
      };
      setWeeklySessionSnapshot((prev) =>
        JSON.stringify(prev) === JSON.stringify(nextSnapshot) ? prev : nextSnapshot,
      );

      const cached = await getCachedWeeklyForLinkToken(rawToken);
      const fetchedAt = cached?.fetchedAt ?? new Date().toISOString();
      const cachedSession = cached?.session
        ? {
            ...cached.session,
            weekly: nextWeekly,
            weeklyByAthleteId: nextWeeklyByAthleteId,
          }
        : undefined;
      await setCachedWeeklyForLinkToken(
        rawToken,
        nextWeekly,
        fetchedAt,
        nextWeeklyByAthleteId,
        cached?.athletes ?? weeklySessionSnapshot.athletes,
        cachedSession,
        cached?.tokenNorm,
      );
    },
    [
      weeklySessionSnapshot,
      weeklySyncDoc,
      weeklySyncLink?.weeklySync?.linkToken,
      derivedActiveAthleteId,
    ],
  );

  useEffect(() => {
    if (role !== "parent" || !useWeeklySyncHero || !weeklySyncDoc) return;
    if (weeklySyncDoc.parentFeedback?.viewedAt) return;
    void updateWeeklyFeedback(markWeeklyViewed);
  }, [
    role,
    updateWeeklyFeedback,
    useWeeklySyncHero,
    weeklySyncDoc,
    weeklySyncDoc?.parentFeedback?.viewedAt,
  ]);

  const weeklyParentFeedback = weeklySyncDoc?.parentFeedback;
  const weeklyAcknowledged = Boolean(weeklyParentFeedback?.acknowledgedAt);
  const handleAcknowledgeWeekly = useCallback(() => {
    if (!weeklySyncDoc || weeklyAcknowledged) return;
    void updateWeeklyFeedback(markWeeklyAcknowledged);
  }, [updateWeeklyFeedback, weeklyAcknowledged, weeklySyncDoc]);

  useEffect(() => {
    if (!isDev() || role !== "parent" || !ready) return;
    const inviteUpdatedAt = weeklySessionSnapshot?.weekly?.updatedAt;
    if (!inviteUpdatedAt?.trim() || !weeklySyncNetworkOk) return;
    const raw = weeklySyncLink?.weeklySync?.linkToken;
    if (!raw?.trim()) return;
    void setLastSeenUpdatedAt(raw, inviteUpdatedAt);
  }, [
    ready,
    role,
    weeklySessionSnapshot?.weekly?.updatedAt,
    weeklySyncNetworkOk,
    weeklySyncLink?.weeklySync?.linkToken,
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
  const linkedCoachName = currentCoach?.displayName?.trim() ?? "";
  const linkRefreshStatusLabel = isLinked
    ? linkedCoachName
      ? `Coach: ${linkedCoachName}`
      : "Coach connected"
    : "No coach connected";

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

    setStateIfJsonChanged(
      "handleMarkCurrentAssignmentComplete:assignmentsById",
      setAssignmentsById,
      updatedAssignmentsById,
    );
    setStateIfJsonChanged(
      "handleMarkCurrentAssignmentComplete:completionReceiptsQueue",
      setCompletionReceiptsQueue,
      updatedCompletionReceiptsQueue,
    );
  }, [assignmentsById, completionReceiptsQueue, currentAssignment, setStateIfJsonChanged]);

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
      setStateIfJsonChanged("handleRemovePilotPreviewItem", setPilotPreviewItemsState, updated);
    },
    [pilotPreviewItems, setStateIfJsonChanged],
  );

  const isUsableYoutubeUrl = (raw?: string) => {
    if (!raw) return false;
    const trimmed = raw.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
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
    const url = normalizeFamilyResourceUrl(rawUrl);
    if (!url) return;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert(
          "Unable to open link",
          "This reference link cannot be opened on this device.",
        );
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Unable to open link",
        "Something went wrong opening this reference link.",
      );
    }
  }, []);

  const openPublishedWebUrl = useCallback(async (rawUrl: string | undefined) => {
    const url = normalizeFamilyResourceUrl(rawUrl);
    if (!url) return;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert(
          "Unable to open link",
          "This link cannot be opened on this device.",
        );
        return;
      }
      await Linking.openURL(url);
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
  const weeklyConnectionStatusLabel = isLinked
    ? useWeeklySyncHero
      ? "Coach linked • Weekly sync active"
      : "Coach linked"
    : isPreviewOnlyOnDevice
      ? "Preview mode"
      : "Not linked";

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

  const weeklyStoryPrimaryHint =
    isLinked && currentAssignment?.status === "assigned" && !useWeeklySyncHero
      ? "When you’re ready, mark the weekly focus complete."
      : useWeeklySyncHero
        ? "When you’re ready, tap Log Session to record training."
        : !isLinked
          ? "When you’re ready, tap Connect with your coach on This week."
          : "When you’re ready, refresh This week for the latest update.";

  const closeWeeklyStory = useCallback(() => {
    setWeeklyStoryOpen((prev) => (prev === false ? prev : false));
    setWeeklyStoryStep((prev) => (prev === 0 ? prev : 0));
  }, []);

  const openWeeklyStory = useCallback(() => {
    setWeeklyStoryStep((prev) => (prev === 0 ? prev : 0));
    setWeeklyStoryOpen((prev) => (prev === true ? prev : true));
  }, []);

  const weeklySyncSelectionDisplayName = useMemo(() => {
    const id = derivedActiveAthleteId?.trim();
    if (!id || !weeklySessionSnapshot) return null;
    const fromSession = weeklySessionSnapshot.athletes?.find((a) => a.id === id);
    const fromSessionName = fromSession?.name?.trim();
    if (fromSessionName) return fromSessionName;
    const kid = Object.values(kidsByIdState).find(
      (k) => k && k.sharedAthleteId?.trim() === id,
    );
    return kid?.name?.trim() ?? null;
  }, [derivedActiveAthleteId, weeklySessionSnapshot, kidsByIdState]);

  const activeAthleteLabel = useWeeklySyncHero
    ? weeklySyncSelectionDisplayName
      ? weeklySyncSelectionDisplayName
      : derivedActiveAthleteId?.trim()
        ? "Selected athlete"
        : "No athlete selected"
    : familyCompetition.kidName
      ? familyCompetition.kidName
      : familyCompetition.kidId
        ? "Selected athlete"
        : "No athlete selected";
  const weeklyDirectionSubtitle = useWeeklySyncHero
    ? weeklySyncSelectionDisplayName
      ? `For ${weeklySyncSelectionDisplayName}`
      : "For your athlete"
    : familyCompetition.kidName
      ? `For ${familyCompetition.kidName}`
      : "For your athlete";
  const whyThisMattersText = useMemo(() => {
    const childName =
      (useWeeklySyncHero
        ? weeklySyncSelectionDisplayName?.trim()
        : familyCompetition.kidName?.trim()) || "your kid";
    const mission = (focusTitle ?? "").trim();

    if (!mission) {
      return `A short shared routine helps ${childName} remember the goal for the week — and helps you cheer them on with confidence.`;
    }

    return `This week’s mission turns training into a family game: you both know what to practice, and ${childName} can feel proud when it clicks.`;
  }, [
    useWeeklySyncHero,
    weeklySyncSelectionDisplayName,
    familyCompetition.kidName,
    focusTitle,
  ]);
  /** Weekly sync note is invite/family-scoped — do not tie the hero eyebrow to competition athlete selection. */
  const weeklyNoteHeroEyebrow = "Weekly coach message";

  const relevantParentKids = useMemo(() => {
    const base = Object.values(kidsByIdState)
      .filter((kid) => kid && kid.id)
      .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }),
      );
    if (role !== "parent") return base;
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
      const freshKidsById = await getKidsById();
      setActiveKidId(kid.id);
      await setFamilyCompetitionSelectedKidId(kid.id);
      const compApplyGen = ++applyFamilyCompGenRef.current;
      const { nextFamily, nextPracticeSummary } = await computeParentKidScopedState(
        kid.id,
        freshKidsById,
        today,
      );
      setFamilyCompetition((prev) => {
        if (compApplyGen !== applyFamilyCompGenRef.current) return prev;
        if (JSON.stringify(prev) === JSON.stringify(nextFamily)) return prev;
        return nextFamily;
      });
      setStateIfJsonChanged("handleSelectParentKid:practiceSummary", setPracticeSummary, nextPracticeSummary);
      setStateIfJsonChanged("handleSelectParentKid:kidsByIdState", setKidsByIdState, freshKidsById);
    },
    [computeParentKidScopedState, familyCompetition.kidId, setStateIfJsonChanged],
  );

  useEffect(() => {
    if (
      role !== "parent" ||
      !ready ||
      !activeKidIdFromStore ||
      activeKidIdFromStore === familyCompetition.kidId
    ) {
      return;
    }

    const activeKidExists =
      relevantParentKids.some((kid) => kid.id === activeKidIdFromStore) ||
      Boolean(kidsByIdState[activeKidIdFromStore]);
    if (!activeKidExists) return;

    let cancelled = false;

    void (async () => {
      await setFamilyCompetitionSelectedKidId(activeKidIdFromStore);
      const today = todayYMD();
      const compApplyGen = ++applyFamilyCompGenRef.current;
      const { nextFamily, nextPracticeSummary } = await computeParentKidScopedState(
        activeKidIdFromStore,
        kidsByIdState,
        today,
      );
      if (cancelled) return;

      setFamilyCompetition((prev) => {
        if (compApplyGen !== applyFamilyCompGenRef.current) return prev;
        if (JSON.stringify(prev) === JSON.stringify(nextFamily)) return prev;
        return nextFamily;
      });
      setStateIfJsonChanged(
        "activeKidStoreSync:practiceSummary",
        setPracticeSummary,
        nextPracticeSummary,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeKidIdFromStore,
    computeParentKidScopedState,
    familyCompetition.kidId,
    kidsByIdState,
    ready,
    relevantParentKids,
    role,
    setStateIfJsonChanged,
  ]);

  /** Derived relink intent (useMemo) so the async effect does not re-run on unrelated object identity churn. */
  const parentInviteAutoRelinkSignature = useMemo(() => {
    if (role !== "parent" || !ready) return "";
    const tokenNorm = normalizeInviteLinkToken(weeklySyncLink?.weeklySync?.linkToken ?? "");
    if (!tokenNorm) return "";
    const kidId = familyCompetition.kidId;
    if (relevantParentKids.length === 0) {
      return kidId == null ? "" : "clear";
    }
    if (kidId != null && relevantParentKids.some((k) => k.id === kidId)) return "";
    if (kidId == null) return "";
    return `fallback:${relevantParentKids[0]!.id}`;
  }, [ready, role, weeklySyncLink?.weeklySync?.linkToken, familyCompetition.kidId, relevantParentKids]);

  useEffect(() => {
    if (role !== "parent" || !ready || !parentInviteAutoRelinkSignature) return;

    if (parentInviteAutoRelinkSignature === "clear") {
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
          if (JSON.stringify(prev) === JSON.stringify(nextFamily)) return prev;
          return nextFamily;
        });
        setStateIfJsonChanged(
          "parentInviteAutoRelink:clear:practiceSummary",
          setPracticeSummary,
          nextPracticeSummary,
        );
      })();
      return;
    }

    if (!parentInviteAutoRelinkSignature.startsWith("fallback:")) return;
    const fallback = parentInviteAutoRelinkSignature.slice("fallback:".length);
    if (!fallback) return;

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
        if (JSON.stringify(prev) === JSON.stringify(nextFamily)) return prev;
        return nextFamily;
      });
      setStateIfJsonChanged(
        "parentInviteAutoRelink:fallback:practiceSummary",
        setPracticeSummary,
        nextPracticeSummary,
      );
    })();
  }, [
    ready,
    role,
    parentInviteAutoRelinkSignature,
    kidsByIdState,
    computeParentKidScopedState,
    setStateIfJsonChanged,
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

  /** Primary CTA: connect → refresh (no coach weekly payload) → Start Training (same navigation as Track your training). */
  const primaryActionIsStartTraining =
    isLinked &&
    (useWeeklySyncHero
      ? Boolean(weeklySyncDoc)
      : currentAssignment?.status === "assigned");


  const missionUrlTrimmed = (weeklySyncDoc?.missionResourceUrl ?? "").trim();
  const hasMissionResource = missionUrlTrimmed.length > 0;

  const isReady =
    !!activeKidIdFromStore &&
    !!kidsByIdState &&
    Object.keys(kidsByIdState).length > 0 &&
    !!weeklySessionSnapshot?.weeklyByAthleteId &&
    Object.keys(weeklySessionSnapshot.weeklyByAthleteId).length > 0;

  if (!isReady) {
    console.log("[THIS WEEK NOT READY]", {
      activeKidIdFromStore,
      hasKids: !!kidsByIdState,
      kidCount: Object.keys(kidsByIdState || {}).length,
      weeklyKeys: Object.keys(weeklySessionSnapshot?.weeklyByAthleteId || {}),
    });

    return null;
  }

  if (__DEV__) {
    console.log("[RENDER ATHLETE SOURCE]", {
      activeKidIdFromStore,
      derivedActiveAthleteId,
      available: Object.keys(weeklySessionSnapshot?.weeklyByAthleteId ?? {}),
    });
  }

  return (
    <>
      <Stack.Screen options={{ title: "This Week" }} />
        <>
          <ReadTogetherStoryModal
            visible={weeklyStoryOpen}
            onRequestClose={closeWeeklyStory}
            safeAreaTop={insets.top}
            safeAreaBottom={insets.bottom}
            stepIndex={weeklyStoryStep}
            cards={readTogetherStoryCards}
            onStepBack={() => {
              setWeeklyStoryStep((s) => {
                const next = Math.max(0, s - 1);
                return next === s ? s : next;
              });
            }}
            onStepNext={() => {
              setWeeklyStoryStep((s) => {
                const next = Math.min(readTogetherStoryCards.length - 1, s + 1);
                return next === s ? s : next;
              });
            }}
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
        style={{ flex: 1, backgroundColor: FEED.bg }}
        contentContainerStyle={{
          paddingHorizontal: tokens.layout.screenPaddingX,
          paddingBottom: tokens.space[8],
        }}
      >
        <View style={{ paddingTop: insets.top + 8 }}>
          <View
            style={{
              minHeight: 38,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: FEED.line,
                backgroundColor: FEED.panel2,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: FEED.text, fontSize: 11, fontWeight: "900" }}>
                MM
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 8,
              }}
            >
              <View
                style={{
                  flex: 1,
                  maxWidth: 236,
                  minHeight: 36,
                  justifyContent: "center",
                  paddingVertical: 4,
                  paddingHorizontal: 9,
                  borderRadius: FEED.radius,
                  borderWidth: 1,
                  borderColor: FEED.line,
                  backgroundColor: FEED.panel,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    tokens.type.caption,
                    {
                      fontWeight: "800",
                      color: isPreviewOnlyOnDevice
                        ? tokens.colors.semantic.warningText
                        : FEED.text,
                    },
                  ]}
                >
                  {weeklyConnectionStatusLabel}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    marginTop: 1,
                    color: FEED.faint,
                    fontSize: 10,
                    lineHeight: 12,
                    fontWeight: "800",
                  }}
                >
                  {weeklyDirectionSubtitle}
                </Text>
              </View>
              <Pressable
                onPress={() => void refreshParentData()}
                accessibilityRole="button"
                accessibilityLabel="Refresh this week"
                style={({ pressed }) => ({
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: FEED.line,
                  backgroundColor: pressed ? FEED.panel3 : "rgba(255,255,255,0.045)",
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <Text
                  style={{
                    color: FEED.text,
                    fontSize: 16,
                    lineHeight: 18,
                    fontWeight: "900",
                  }}
                >
                  ↻
                </Text>
              </Pressable>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: FEED.line,
                  backgroundColor: "rgba(255,255,255,0.045)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: isLinked ? FEED.accent : FEED.faint,
                  }}
                />
              </View>
            </View>
          </View>
          <Text
            style={[
              tokens.type.label,
              {
                marginTop: 18,
                marginBottom: 6,
                color: FEED.muted,
              },
            ]}
          >
            COACH FEED
          </Text>
          <Text
            onLongPress={
              __DEV__
              ? () => {
                  setShowDebugData((prev) => !prev);
                }
              : undefined
            }
            style={[
              tokens.type.h1,
              { color: FEED.text, fontSize: 30, lineHeight: 34 },
            ]}
          >
            This week’s direction
          </Text>
        </View>

        {!ready ? (
          <Text
            style={{
              marginTop: tokens.space[3],
              ...tokens.type.body,
              color: FEED.muted,
            }}
          >
            Loading…
          </Text>
        ) : (
          <>
            {showParentKidSelector ? (
              <>
                <View
                  style={{
                    marginTop: 16,
                    marginBottom: -2,
                    paddingHorizontal: 2,
                  }}
                >
                  <Text style={{ fontSize: 12, letterSpacing: 1, fontWeight: "800", color: FEED.muted }}>
                    Athlete
                  </Text>
                </View>
                <Text
                  style={{
                    marginTop: 8,
                    paddingHorizontal: 2,
                    fontSize: 14,
                    color: FEED.muted,
                    lineHeight: 20,
                  }}
                >
                  Choose who this week is for.
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
                        borderRadius: FEED.radius,
                        borderWidth: 1,
                        borderColor: selected ? FEED.lineStrong : FEED.line,
                        backgroundColor: selected
                          ? (pressed ? FEED.panel3 : FEED.panel2)
                          : (pressed ? FEED.panel3 : FEED.panel),
                      })}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "800",
                          color: selected ? FEED.text : FEED.muted,
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

            <View
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: FEED.radius,
                borderWidth: 1,
                borderColor: FEED.lineStrong,
                backgroundColor: FEED.panel,
                overflow: "hidden",
                ...tokens.elevation.card,
              }}
            >
              {isDev() &&
              role === "parent" &&
              showNewCoachUpdateBanner &&
              weeklySyncDoc?.updatedAt ? (
                <View
                  style={{
                    alignSelf: "stretch",
                    marginBottom: tokens.space[3],
                    paddingVertical: tokens.space[2],
                    paddingHorizontal: tokens.space[3],
                    borderRadius: FEED.radius,
                    backgroundColor: FEED.panel2,
                    borderWidth: 1,
                    borderColor: FEED.line,
                  }}
                >
                  <Text
                    style={[
                      tokens.type.bodyStrong,
                      { color: FEED.text },
                    ]}
                  >
                    New coach update
                  </Text>
                  <Text
                    style={[
                      tokens.type.caption,
                      { marginTop: tokens.space[1], color: FEED.muted },
                    ]}
                  >
                    Updated {new Date(weeklySyncDoc.updatedAt).toLocaleString()}
                  </Text>
                </View>
              ) : null}

              <Text
                style={[
                  tokens.type.label,
                  {
                    marginBottom: tokens.space[2],
                    color: FEED.muted,
                  },
                ]}
              >
                {weeklyNoteHeroEyebrow.toUpperCase()}
              </Text>
              <Text
                style={{
                  color: FEED.text,
                  fontSize: 20,
                  lineHeight: 25,
                  fontWeight: "900",
                }}
              >
                {focusTitle}
              </Text>
              <Text
                style={{
                  marginTop: 10,
                  color: FEED.muted,
                  fontSize: 14,
                  lineHeight: 21,
                }}
              >
                {focusNotes}
              </Text>

              {useWeeklySyncHero && weeklySyncFetchFailed && weeklySyncDoc ? (
                <Text
                  style={[
                    tokens.type.caption,
                    {
                      marginTop: tokens.space[3],
                      color: tokens.colors.semantic.warningText,
                      lineHeight: 18,
                    },
                  ]}
                >
                  Showing last saved note — could not reach the sync service. Pull to refresh or try again
                  shortly.
                </Text>
              ) : null}

              {!useWeeklySyncHero && currentModule?.title ? (
                <View
                  style={{
                    marginTop: tokens.space[4],
                    paddingTop: tokens.space[4],
                    borderTopWidth: 1,
                    borderTopColor: FEED.line,
                  }}
                >
                  <Text style={[tokens.type.body, { color: FEED.muted }]}>
                    <Text style={{ fontWeight: "700", color: FEED.text }}>
                      In class, look for:{" "}
                    </Text>
                    {currentModule.title}
                    {currentModule.summary ? ` — ${currentModule.summary}` : ""}
                  </Text>
                </View>
              ) : null}

              {!useWeeklySyncHero && currentPack?.title && isLinked ? (
                <Text
                  style={[
                    tokens.type.caption,
                    { marginTop: tokens.space[3], color: FEED.muted },
                  ]}
                >
                  Program:{" "}
                  <Text style={{ fontWeight: "600", color: FEED.text }}>
                    {currentPack.title}
                  </Text>
                  {currentPack.description ? ` · ${currentPack.description}` : ""}
                </Text>
              ) : null}

              {assignmentStatusLine ? (
                <Text
                  style={[
                    tokens.type.caption,
                    { marginTop: tokens.space[3], color: FEED.faint },
                  ]}
                >
                  {assignmentStatusLine}
                </Text>
              ) : null}

              {!isLinked && hasCoachPilotPreviewOnDevice ? (
                <Text
                  style={[
                    tokens.type.caption,
                    {
                      marginTop: tokens.space[3],
                      color: tokens.colors.semantic.warningText,
                      lineHeight: 18,
                    },
                  ]}
                >
                  Preview items on this phone are not shared with families until you connect with your coach’s invite.
                </Text>
              ) : null}

              {!isLinked && hasSeededOrLocalShareData && !hasCoachPilotPreviewOnDevice ? (
                <Text
                  style={[
                    tokens.type.caption,
                    {
                      marginTop: tokens.space[3],
                      color: tokens.colors.semantic.warningText,
                      lineHeight: 18,
                    },
                  ]}
                >
                  Sample or local data on this phone only — connect to use your coach’s real weekly note.
                </Text>
              ) : null}

              {useWeeklySyncHero && weeklySyncDoc ? (
                weeklyAcknowledged ? (
                  <Text
                    style={[
                      tokens.type.caption,
                      {
                        marginTop: tokens.space[4],
                        color: FEED.text,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    Acknowledged
                  </Text>
                ) : (
                  <Pressable
                    onPress={handleAcknowledgeWeekly}
                    accessibilityRole="button"
                    accessibilityLabel="Acknowledge this weekly note"
                    style={({ pressed }) => ({
                      marginTop: tokens.space[4],
                      paddingVertical: tokens.space[3],
                      paddingHorizontal: tokens.space[4],
                      borderRadius: FEED.radius,
                      borderWidth: 1,
                      borderColor: FEED.lineStrong,
                      backgroundColor: pressed
                        ? FEED.panel3
                        : FEED.panel2,
                      alignSelf: "flex-start",
                    })}
                  >
                    <Text style={[tokens.type.title, { color: FEED.text }]}>
                      Got it 👍
                    </Text>
                  </Pressable>
                )
              ) : null}

              {role === "parent" && ready ? (
                <Pressable
                  onPress={() => {
                    const d = todayYMD();
                    const k = familyCompetition.kidId;
                    console.log("[THIS WEEK NAV TRAINING]", {
                      selected: derivedActiveAthleteId,
                    });
                    router.push(
                      k
                        ? `/training?date=${encodeURIComponent(d)}&kidId=${encodeURIComponent(k)}&fromWeekly=1`
                        : `/training?date=${encodeURIComponent(d)}&fromWeekly=1`,
                    );
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    marginTop: tokens.space[4],
                    minHeight: 46,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 12,
                    paddingHorizontal: tokens.space[4],
                    borderRadius: FEED.radius,
                    borderWidth: 1,
                    borderColor: FEED.accent,
                    backgroundColor: pressed
                      ? FEED.accentPressed
                      : FEED.accent,
                  })}
                >
                  <Text style={{ color: FEED.accentDark, fontSize: 14, fontWeight: "900" }}>
                    Log Session
                  </Text>
                </Pressable>
              ) : null}

            </View>

            <Pressable
              onPress={openWeeklyStory}
              accessibilityRole="button"
              accessibilityLabel={"Start Family Huddle. Review this week’s mission together."}
              style={({ pressed }) => ({
                marginTop: 16,
                paddingVertical: tokens.space[4],
                paddingHorizontal: tokens.space[4],
                borderRadius: FEED.radius,
                borderWidth: 1,
                borderColor: FEED.line,
                backgroundColor: pressed ? FEED.panel3 : FEED.panel,
                alignSelf: "stretch",
                alignItems: "flex-start",
                ...tokens.elevation.card,
              })}
            >
              <Text
                style={[
                  tokens.type.label,
                  { color: FEED.muted },
                ]}
              >
                FAMILY HUDDLE
              </Text>
              <Text
                style={[
                  tokens.type.h2,
                  {
                    marginTop: tokens.space[2],
                    color: FEED.text,
                  },
                ]}
              >
                Talk through the week together
              </Text>
              <Text
                style={[
                  tokens.type.body,
                  {
                    marginTop: tokens.space[2],
                    color: FEED.muted,
                  },
                ]}
              >
                Review the coach message, ask what clicked, and keep training simple.
              </Text>
            </Pressable>

            <View
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: FEED.radius,
                borderWidth: 1,
                borderColor: FEED.line,
                backgroundColor: FEED.panel,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: tokens.space[3],
                }}
              >
                <Text
                  style={{
                    color: FEED.text,
                    fontSize: 17,
                    lineHeight: 22,
                    fontWeight: "900",
                  }}
                >
                  Next Focus
                </Text>
                <View
                  style={{
                    paddingVertical: 5,
                    paddingHorizontal: 8,
                    borderRadius: FEED.radius,
                    borderWidth: 1,
                    borderColor: FEED.line,
                    backgroundColor: "transparent",
                  }}
                >
                  <Text
                    style={[
                      tokens.type.caption,
                      { color: FEED.text, fontWeight: "800" },
                    ]}
                  >
                    Coach Direction
                  </Text>
                </View>
              </View>
              <Text
                numberOfLines={2}
                style={{
                  marginTop: 12,
                  color: FEED.muted,
                  fontSize: 14,
                  lineHeight: 21,
                }}
              >
                {focusTitle}
              </Text>
            </View>

            <View
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: FEED.radius,
                borderWidth: 1,
                borderColor: FEED.line,
                backgroundColor: FEED.panel,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: tokens.space[3],
                }}
              >
                <Text
                  style={{
                    color: FEED.text,
                    fontSize: 17,
                    lineHeight: 22,
                    fontWeight: "900",
                  }}
                >
                  Mission Resource
                </Text>
                <View
                  style={{
                    paddingVertical: 5,
                    paddingHorizontal: 8,
                    borderRadius: FEED.radius,
                    borderWidth: 1,
                    borderColor: FEED.line,
                    backgroundColor: "transparent",
                  }}
                >
                  <Text
                    style={[
                      tokens.type.caption,
                      { color: FEED.text, fontWeight: "800" },
                    ]}
                  >
                    {hasMissionResource ? "Shared via link" : "No link yet"}
                  </Text>
                </View>
              </View>
              {hasMissionResource ? (
                <Pressable
                  onPress={() => void openPublishedWebUrl(weeklySyncDoc?.missionResourceUrl)}
                  accessibilityRole="button"
                  accessibilityLabel="Open this week’s technique link"
                  style={({ pressed }) => ({
                    minHeight: 92,
                    marginTop: 12,
                    paddingVertical: 12,
                    paddingHorizontal: tokens.space[5],
                    borderRadius: FEED.radius,
                    borderWidth: 1,
                    borderColor: FEED.line,
                    backgroundColor: pressed ? FEED.panel2 : "#22272e",
                    alignSelf: "stretch",
                    alignItems: "center",
                    justifyContent: "center",
                  })}
                >
                  <Text
                    style={{
                      color: FEED.text,
                      fontSize: 15,
                      fontWeight: "900",
                    }}
                  >
                    ▶ Technique Link
                  </Text>
                </Pressable>
              ) : null}
              <Text
                style={{
                  marginTop: 12,
                  color: FEED.muted,
                  fontSize: 14,
                  lineHeight: 21,
                }}
              >
                {hasMissionResource
                  ? "Technique support for this week’s coach direction."
                  : "No technique link shared yet."}
              </Text>
            </View>

            <View
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: FEED.radius,
                borderWidth: 1,
                borderColor: FEED.line,
                backgroundColor: FEED.panel,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: tokens.space[3],
                }}
              >
                <Text
                  style={{
                    color: FEED.text,
                    fontSize: 17,
                    lineHeight: 22,
                    fontWeight: "900",
                  }}
                >
                  Coaching History Log
                </Text>
                <Text style={[tokens.type.caption, { color: FEED.muted }]}>
                  Progression
                </Text>
              </View>
              <Text
                style={{
                  marginTop: 12,
                  color: FEED.muted,
                  fontSize: 14,
                  lineHeight: 21,
                }}
              >
                Shared coach notes will appear here after training is logged.
              </Text>
            </View>

            {role === "parent" && ready ? (
              <View
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: FEED.radius,
                  borderWidth: 1,
                  borderColor: FEED.line,
                  backgroundColor: FEED.panel,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: tokens.space[3],
                  }}
                >
                  <Text
                    style={{
                      color: FEED.text,
                      fontSize: 17,
                      lineHeight: 22,
                      fontWeight: "900",
                    }}
                  >
                    Practice Summary
                  </Text>
                  <Text
                    style={{
                      color: FEED.text,
                      fontSize: 22,
                      lineHeight: 26,
                      fontWeight: "900",
                    }}
                  >
                    {practiceSummary.sessionCountThisWeek}
                  </Text>
                </View>
                <Text
                  style={{
                    marginTop: 10,
                    color: FEED.muted,
                    fontSize: 14,
                    lineHeight: 21,
                  }}
                >
                  {practiceSummary.sessionCountThisWeek === 1
                    ? `1 session this week for ${activeAthleteLabel}.`
                    : `${practiceSummary.sessionCountThisWeek} sessions this week for ${activeAthleteLabel}.`}
                </Text>
                <Text
                  style={{
                    marginTop: 6,
                    color: FEED.faint,
                    fontSize: 13,
                    lineHeight: 19,
                  }}
                  numberOfLines={2}
                >
                  {practiceSummary.latestSession
                    ? `Latest: ${sessionSummaryTitle(practiceSummary.latestSession)} · ${new Date(
                        practiceSummary.latestSession.createdAt,
                      ).toLocaleDateString()}`
                    : "No sessions logged yet."}
                </Text>
              </View>
            ) : null}

            {!isLinked ||
            !primaryActionIsStartTraining ||
            (isLinked && currentAssignment?.status === "assigned") ? (
              <View style={{ marginTop: 16, gap: tokens.space[3] }}>
                {!isLinked ? (
                  <Pressable
                    onPress={() => router.push("/this-week/join")}
                    accessibilityRole="button"
                    style={({ pressed }) => ({
                      paddingVertical: tokens.space[3],
                      paddingHorizontal: tokens.space[5],
                      borderRadius: FEED.radius,
                      borderWidth: 1,
                      borderColor: FEED.lineStrong,
                      backgroundColor: pressed
                        ? FEED.panel3
                        : FEED.panel2,
                      alignSelf: "stretch",
                      alignItems: "center",
                    })}
                  >
                    <Text
                      style={[
                        tokens.type.title,
                        { color: FEED.text },
                      ]}
                    >
                      Connect with your coach
                    </Text>
                  </Pressable>
                ) : !primaryActionIsStartTraining ? (
                  <Pressable
                    onPress={() => void refreshParentData()}
                    accessibilityRole="button"
                    style={({ pressed }) => ({
                      paddingVertical: tokens.space[3],
                      paddingHorizontal: tokens.space[5],
                      borderRadius: FEED.radius,
                      borderWidth: 1,
                      borderColor: FEED.lineStrong,
                      backgroundColor: pressed
                        ? FEED.panel3
                        : FEED.panel2,
                      alignSelf: "stretch",
                      alignItems: "center",
                    })}
                  >
                    <Text
                      style={[
                        tokens.type.title,
                        { color: FEED.text },
                      ]}
                    >
                      Refresh coach data
                    </Text>
                  </Pressable>
                ) : null}

                {isLinked && currentAssignment?.status === "assigned" ? (
                  <Pressable
                    onPress={() => void handleMarkCurrentAssignmentComplete()}
                    accessibilityRole="button"
                    style={({ pressed }) => ({
                      paddingVertical: tokens.space[3],
                      paddingHorizontal: tokens.space[5],
                      borderRadius: FEED.radius,
                      borderWidth: 1,
                      borderColor: FEED.lineStrong,
                      backgroundColor: pressed
                        ? FEED.panel3
                        : FEED.panel,
                      alignSelf: "stretch",
                      alignItems: "center",
                    })}
                  >
                    <Text
                      style={[
                        tokens.type.title,
                        { color: FEED.text },
                      ]}
                    >
                      Mark weekly focus complete
                    </Text>
                    <Text
                      style={[
                        tokens.type.caption,
                        {
                          marginTop: tokens.space[1],
                          color: FEED.muted,
                          textAlign: "center",
                        },
                      ]}
                    >
                      Use this only when your coach assigned a legacy focus.
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* Transitional utilities remain below the weekly loop until their final homes are decided. */}
            <Section title="Competition snapshot" tone="family">
              <Text
                style={{
                  marginBottom: 12,
                  fontSize: 13,
                  color: FEED.faint,
                  lineHeight: 18,
                }}
              >
                Event planning sits below this week’s coach loop.
              </Text>
              {role === "parent" ? (
                <View
                  style={{
                    marginBottom: tokens.layout.sectionGap,
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    borderRadius: FEED.radius,
                    borderWidth: 1,
                    borderColor: FEED.line,
                    backgroundColor: FEED.panel2,
                    overflow: "hidden",
                  }}
                >
                  <View style={{ flexDirection: "column", alignItems: "stretch", gap: 0 }}>
                    {nextUpcomingCompetitionEntry ? (
                      <Pressable
                        onPress={() => {
                          router.push(
                            `/competition/${encodeURIComponent(nextUpcomingCompetitionEntry.id)}` as Href,
                          );
                        }}
                        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                        accessibilityRole="button"
                        accessibilityLabel="Open next competition"
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            letterSpacing: 0.5,
                            fontWeight: "800",
                            color: FEED.muted,
                          }}
                        >
                          NEXT COMPETITION
                        </Text>
                        <View
                          style={{
                            marginTop: 8,
                            flexDirection: "row",
                            alignItems: "flex-start",
                            gap: 8,
                          }}
                        >
                          <Text
                            numberOfLines={3}
                            ellipsizeMode="tail"
                            style={{
                              flex: 1,
                              minWidth: 0,
                              fontSize: 20,
                              fontWeight: "900",
                              color: FEED.text,
                              lineHeight: 26,
                            }}
                          >
                            {(nextUpcomingCompetitionEntry.tournamentName ?? "").trim() || "Competition"}
                          </Text>
                          <CompetitionMediaPills
                            {...(familyCompetition.mediaByEntryId[nextUpcomingCompetitionEntry.id] ?? {
                              hasVideo: false,
                              hasImage: false,
                            })}
                          />
                        </View>
                        {nextUpcomingCompetitionDateLabel ? (
                          <Text
                            style={{ marginTop: 6, fontSize: 15, color: FEED.muted, lineHeight: 20 }}
                          >
                            {nextUpcomingCompetitionDateLabel}
                          </Text>
                        ) : null}
                        {nextUpcomingCompetitionPromoterFmt ? (
                          <Text
                            style={{ marginTop: 4, fontSize: 13, color: FEED.muted, lineHeight: 18 }}
                          >
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
                            <Text
                              style={{ fontSize: 11, fontWeight: "900", color: nextUpcomingCompetitionChip.textColor }}
                            >
                              {nextUpcomingCompetitionChip.label}
                            </Text>
                          </View>
                        ) : null}
                      </Pressable>
                    ) : (
                      <View>
                        <Text
                          style={{
                            fontSize: 13,
                            letterSpacing: 0.5,
                            fontWeight: "800",
                            color: FEED.muted,
                          }}
                        >
                          NEXT COMPETITION
                        </Text>
                        <Text style={{ marginTop: 10, fontSize: 14, color: FEED.muted, lineHeight: 20 }}>
                          No upcoming dates right now.
                        </Text>
                      </View>
                    )}

                    <View
                      style={{
                        marginTop: 14,
                        flexDirection: "column",
                        alignItems: "stretch",
                        gap: 10,
                      }}
                    >
                      <Pressable
                        onPress={() => {
                          setCompetitionCalendarExpanded((v) => !v);
                        }}
                        style={({ pressed }) => ({
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: FEED.radius,
                          borderWidth: 1,
                          borderColor: FEED.lineStrong,
                          backgroundColor: pressed ? FEED.panel3 : FEED.panel,
                          alignSelf: "stretch",
                          alignItems: "center",
                        })}
                        accessibilityRole="button"
                        accessibilityLabel="View competitions"
                      >
                        <Text style={{ fontSize: 12, fontWeight: "900", color: FEED.text }}>
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
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: FEED.radius,
                            borderWidth: 1,
                            borderColor: FEED.lineStrong,
                            backgroundColor: pressed
                              ? FEED.panel3
                              : "transparent",
                            alignSelf: "stretch",
                            alignItems: "center",
                          })}
                          accessibilityRole="button"
                          accessibilityLabel="Add competition"
                        >
                          <Text style={{ fontSize: 12, fontWeight: "700", color: FEED.muted }}>
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
                      ? `${familyCompetition.kidName}: tap a competition to open it.`
                      : familyCompetition.kidId
                        ? "Tap a competition to open it."
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
                    ) : familyUpcomingExcludingHero.length > 0 ? (
                      <View style={{ marginBottom: tokens.layout.sectionGap }}>
                        <FlatList
                          data={familyUpcomingExcludingHero}
                          keyExtractor={(e) => e.id}
                          horizontal={true}
                          showsHorizontalScrollIndicator={false}
                          nestedScrollEnabled={true}
                          contentContainerStyle={{ paddingRight: tokens.space[2] }}
                          renderItem={({ item }) => {
                            const t = (item.tournamentName ?? "").trim() || "Competition";
                            const media = familyCompetition.mediaByEntryId[item.id] ?? {
                              hasVideo: false,
                              hasImage: false,
                            };
                            return (
                              <Pressable
                                onPress={() => {
                                  router.push(
                                    `/competition/${encodeURIComponent(item.id)}` as Href,
                                  );
                                }}
                                style={({ pressed }) => ({
                                  width: 208,
                                  marginRight: tokens.space[3],
                                  paddingVertical: tokens.space[3],
                                  paddingHorizontal: tokens.space[3],
                                  borderRadius: tokens.radius.md,
                                  borderWidth: 1,
                                  borderColor: UI.competitionRowBorder,
                                  backgroundColor: pressed ? UI.bgCard : UI.competitionRowBg,
                                })}
                                accessibilityRole="button"
                                accessibilityLabel={t}
                              >
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "flex-start",
                                    gap: 8,
                                  }}
                                >
                                  <Text
                                    numberOfLines={2}
                                    ellipsizeMode="tail"
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      fontSize: 15,
                                      fontWeight: "700",
                                      color: UI.textPrimary,
                                      lineHeight: 21,
                                    }}
                                  >
                                    {t}
                                  </Text>
                                  <CompetitionMediaPills {...media} />
                                </View>
                                <Text
                                  style={{
                                    marginTop: tokens.space[2],
                                    fontSize: 13,
                                    color: UI.textSecondary,
                                    lineHeight: 18,
                                  }}
                                >
                                  {formatFamilyCompetitionDate(item.eventDate)}
                                </Text>
                              </Pressable>
                            );
                          }}
                        />
                      </View>
                    ) : null}


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
                      <View>
                        <FlatList
                          data={familyCompetition.recent}
                          keyExtractor={(e) => e.id}
                          horizontal={true}
                          showsHorizontalScrollIndicator={false}
                          nestedScrollEnabled={true}
                          contentContainerStyle={{ paddingRight: tokens.space[2] }}
                          renderItem={({ item }) => {
                            const t = (item.tournamentName ?? "").trim() || "Competition";
                            const media = familyCompetition.mediaByEntryId[item.id] ?? {
                              hasVideo: false,
                              hasImage: false,
                            };
                            return (
                              <Pressable
                                onPress={() => {
                                  router.push(
                                    `/competition/${encodeURIComponent(item.id)}` as Href,
                                  );
                                }}
                                style={({ pressed }) => ({
                                  width: 208,
                                  marginRight: tokens.space[3],
                                  paddingVertical: tokens.space[3],
                                  paddingHorizontal: tokens.space[3],
                                  borderRadius: tokens.radius.md,
                                  borderWidth: 1,
                                  borderColor: UI.competitionRowBorder,
                                  backgroundColor: pressed ? UI.bgCard : UI.competitionRowBg,
                                })}
                                accessibilityRole="button"
                                accessibilityLabel={t}
                              >
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "flex-start",
                                    gap: 8,
                                  }}
                                >
                                  <Text
                                    numberOfLines={2}
                                    ellipsizeMode="tail"
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      fontSize: 15,
                                      fontWeight: "700",
                                      color: UI.textPrimary,
                                      lineHeight: 21,
                                    }}
                                  >
                                    {t}
                                  </Text>
                                  <CompetitionMediaPills {...media} />
                                </View>
                                <Text
                                  style={{
                                    marginTop: tokens.space[2],
                                    fontSize: 13,
                                    color: UI.textSecondary,
                                    lineHeight: 18,
                                  }}
                                >
                                  {formatFamilyCompetitionDate(item.eventDate)}
                                </Text>
                              </Pressable>
                            );
                          }}
                        />
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

            <View style={{ gap: 8, marginBottom: 10 }}>
              <Pressable
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                pressRetentionOffset={12}
                onPress={() => {
                  if (!isLinked) return;
                  setLinkRefreshExpanded((value) => !value);
                }}
                style={{
                  marginTop: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: FEED.radius,
                  borderWidth: 1,
                  borderColor: FEED.line,
                  backgroundColor: FEED.panel,
                  flexDirection: "row",
                  alignItems: "center",
                  opacity: (!isLinked || linkRefreshExpanded) ? 1 : 0.92,
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: isLinked
                        ? FEED.muted
                        : FEED.faint,
                    }}
                  />
                  <Text style={{ color: FEED.text, fontWeight: "800", fontSize: 14 }}>
                    Coach connection
                  </Text>
                </View>

                <Text style={{ color: FEED.muted, fontWeight: "800" }}>
                  {!isLinked || linkRefreshExpanded ? "▴" : "▾"}
                </Text>
              </Pressable>

              {(!isLinked || linkRefreshExpanded) ? (
                <>
                  <Text
                    style={{
                      fontSize: 15,
                      color: FEED.muted,
                      lineHeight: 23,
                      marginBottom: 12,
                    }}
                  >
                    Manage your linked coach, athletes, and weekly refresh.
                    {linkRefreshStatusLabel ? ` ${linkRefreshStatusLabel}.` : ""}
                  </Text>
                  <Pressable
                    onPress={() => router.push("/this-week/manage")}
                    style={({ pressed }) => ({
                      paddingVertical: 14,
                      paddingHorizontal: 18,
                      borderRadius: FEED.radius,
                      borderWidth: 1,
                      borderColor: FEED.lineStrong,
                      backgroundColor: pressed ? FEED.panel3 : FEED.panel2,
                      alignSelf: "stretch",
                      alignItems: "center",
                    })}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "800", color: FEED.text }}>
                      Manage coach link
                    </Text>
                    <Text
                      style={{
                        marginTop: 4,
                        fontSize: 13,
                        color: FEED.muted,
                        textAlign: "center",
                        lineHeight: 19,
                      }}
                    >
                      Add or remove athletes, or remove this invite from this device only.
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void refreshParentData()}
                    style={({ pressed }) => ({
                      marginTop: 10,
                      alignSelf: "flex-start",
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: FEED.text }}>
                      {useWeeklySyncHero ? "Refresh weekly note now" : "Refresh shared updates"}
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </View>

            {!useWeeklySyncHero && weeklyStoryPrimaryHint ? (
              <Text
                style={[
                  tokens.type.caption,
                  {
                    marginTop: tokens.layout.sectionGap,
                    color: tokens.colors.text.muted,
                    lineHeight: 18,
                  },
                ]}
              >
                {weeklyStoryPrimaryHint}
              </Text>
            ) : null}

            {showCoachOperationalTools ? (
              <>
                <Section title="Coach tools">
                  <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
                    Coach tools on this device — use Profile → Switch role if this phone is for a parent.
                  </Text>
                  <Pressable
                    onPress={() => router.push("/coach/kids")}
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
    </>
  );
}

export default function CoachesScreen() {
  const coachesScreenMountRef = useRef(0);
  useEffect(() => {
    coachesScreenMountRef.current += 1;
    console.log("[MOUNT_TRACE:COACHES_SCREEN]", coachesScreenMountRef.current);
  }, []);

  const { role, loading } = useDeviceRole();

  useEffect(() => {
    if (role === "coach") {
      queueMicrotask(() => {
        safeReplace(router, "/coach");
      });
    }
  }, [role]);

  if (loading || !role) {
    return (
      <>
        <Stack.Screen options={{ title: "This Week" }} />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: UI.screenBg,
          }}
        >
          <Text style={{ fontSize: 15, color: UI.textSecondary }}>Loading…</Text>
        </View>
      </>
    );
  }
  if (role === "coach") {
    return null;
  }
  return <ParentThisWeekScreen />;
}
