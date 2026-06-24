import { useHeaderHeight } from "@react-navigation/elements";
import {
  Stack,
  router,
  useLocalSearchParams,
  usePathname,
  useSegments,
  type Href,
} from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ResizeMode, Video } from "expo-av";
import * as MediaLibrary from "expo-media-library";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  Image,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";

import {
  dedupeActiveCoachWriterLinks,
  resolveCoachPublishWriterLink,
  sortCoachWriterLinksNewestFirst,
} from "../../coachShare/coachLinkBinding";
import { normalizeInviteLinkToken } from "../../coachShare/inviteLinkToken";
import {
  defaultFamilyLinkButtonLabel,
  familyResourceUrlForLinking,
} from "../../coach/familyResourceUrl";
import { kidWeeklyFocusToPublishPayload } from "../../coach/weeklyFocusPublish";
import {
  isPublishableSystemKey,
  normalizePublishableSystemKey,
} from "../../lib/taxonomy/publishableSystemKey";
import {
  READ_TOGETHER_TITLES,
  buildReadTogetherStoryCards,
} from "../../family/readTogetherStoryCards";
import { ReadTogetherStoryModal } from "../../family/ReadTogetherStoryModal";
import { deriveWeeklyNarrative } from "../coach/deriveWeeklyNarrative";
import WeeklySuggestionCard from "../coach/components/WeeklySuggestionCard";
import { getPlacementLabel } from "../competition/placementLabel";
import {
  deriveCompetitionTrainingSkillFocus,
  recommendedFocusAreaFromTrainingSkillFocus,
} from "../../ai-coach/competitionTrainingSkillFocus";
import type { CompetitionTrainingSkillFocus } from "../../ai-coach/competitionTrainingSkillFocus";
import { recordCoachTrainingFocusDecision } from "../../ai-coach/coachTrainingFocusFeedback";
import {
  CoachWeeklySyncApiError,
  coachSyncFetchSession,
  coachSyncPublishWeekly,
} from "../../services/coachWeeklySyncApi";
import {
  startCoachAnalysisReadinessRun,
  type CoachAnalysisReadinessRun,
} from "../../domain/competition/coachAnalysisReadinessCoordinator";
import { getCoachLinks } from "../../storage/coachShareStore";
import {
  getCachedWeeklyForLinkToken,
  setCachedWeeklyForLinkToken,
} from "../../storage/coachWeeklySyncCacheStore";
import {
  archiveKidForCoachRoster,
  getKidsById,
  getLatestKidWeeklyFocusForWeek,
  appendKidWeeklyFocus,
  getKidWeeklyFocusEntriesForKid,
  deleteKidWeeklyFocusEntryById,
  pickPublishedWeeklyParentFeedbackForSharedAthlete,
  pickRemoteSharedCompetitionsForLinkedAthlete,
  startOfWeekMondayYMD,
  todayYMD,
  updateKidHouseholdLabel,
} from "../../storage/coachKidStore";
import { deleteSessionById } from "../../storage/sessionsStore";
import { getKidStandingGuidance } from "../../storage/kidStandingGuidanceStore";
import { StorageKeys } from "../../storage/storageKeys";
import { logCompDelete } from "../../dev/competitionMutationDevLog";
import { deleteCompetition } from "../../domain/competition/CompetitionSync";
import {
  mergeCompetitionMatchDetailIntoEntries,
  pickLastCompetitionWeeklyContext,
  type LastCompetitionWeeklyContext,
} from "../../storage/competitionStore";
import {
  deleteKidCompetitionEntry,
  getKidCompetitionEntriesForKid,
  upsertSharedCompetitionsForKid,
} from "../../storage/kidCompetitionStore";
import type { Session } from "../../types";
import {
  isKidCoachArchived,
  type CoachOutcome,
  type KidCompetitionEntry,
  type KidCompetitionFormat,
  type KidCompetitionOutcomeKind,
  type KidCompetitionResult,
  type KidStandingGuidance,
  type KidWeeklyFocusEntry,
} from "../../types/coachKid";
import type {
  CoachWeeklySyncPublishBody,
  CoachWeeklySyncSessionResponse,
  SyncedWeeklyMessagePayload,
} from "../../types/coachWeeklySync";
import { toDateKey } from "../../_domain/dateKey";
import { FUNDAMENTALS_TAXONOMY } from "../../fundamentals/taxonomy";
import { clearActiveKidId } from "../../state/activeKidStore";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  bgCardActive: "#edf2ff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  danger: "#dc2626",
  rowMutedBg: "#f9fafb",
  coachLaneBg: "#f4f4f5",
  coachLaneBorder: "#d1d5db",
  familyLaneBg: "#ecfdf5",
  familyLaneBorder: "#6ee7b7",
  publishAccent: "#059669",
  publishAccentPressed: "#047857",
};

const CARD_RADIUS = 16;
const SCREEN_W = Dimensions.get("window").width;

/** Keeps header refresh spinner from flashing off too fast when sync completes quickly. */
const COACH_KID_HEADER_REFRESH_MIN_VISIBLE_MS = 420;

// System id -> label (for lightweight display)
const SYSTEM_LABEL_BY_ID = new Map<string, string>([
  ["ALL", "All"],
  ...FUNDAMENTALS_TAXONOMY.map((l1) => [l1.id, l1.label] as [string, string]),
]);

function resolveSystemLabel(systemId?: string) {
  const key = (systemId ?? "").trim();
  if (!key) return "—";
  return SYSTEM_LABEL_BY_ID.get(key) ?? key;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function collapseFocusText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function addDaysYMDLocal(ymd: string, delta: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

type MediaPreviewState = { type: "video" | "image"; uri: string; assetId?: string | null };

async function resolveMediaUri(
  uri?: string | null,
  assetId?: string | null,
): Promise<string | null> {
  const u = uri?.trim();
  if (!u) return null;

  if (u.startsWith("file://")) return u;

  if ((u.startsWith("ph://") || u.startsWith("assets-library://")) && assetId) {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(assetId);
      return info.localUri ?? null;
    } catch {
      return null;
    }
  }

  return null;
}

function outcomeLabel(o: CoachOutcome) {
  switch (o) {
    case "not_yet":
      return "Learning";
    case "developing":
      return "Developing";
    case "on_track":
      return "Applying";
  }
}

function sparringApplicationLabel(o: "not_yet" | "sometimes" | "yes") {
  switch (o) {
    case "not_yet":
      return "Not Yet";
    case "sometimes":
      return "Sometimes";
    case "yes":
      return "Yes";
  }
}

function coachOutcomeFromSparringApplication(
  sparring: "not_yet" | "sometimes" | "yes",
): CoachOutcome {
  switch (sparring) {
    case "not_yet":
      return "not_yet";
    case "sometimes":
      return "developing";
    case "yes":
      return "on_track";
  }
}

function techniqueSummaryForKidSession(s: Session): string {
  const primary = (s.technique || "").trim();
  const fromMulti = (s.techniques ?? [])
    .map((t) => (t.customTechnique || t.technique || "").trim())
    .filter(Boolean);

  const parts: string[] = [];
  if (primary) parts.push(primary);
  for (const p of fromMulti) {
    if (p && !parts.includes(p)) parts.push(p);
  }
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} · also: ${parts.slice(1).join(", ")}`;
}

function sessionBadges(s: Session) {
  const badges: ("YT" | "IMG" | "VID")[] = [];
  if (s.youtubeUrl?.trim()) badges.push("YT");
  if ((s.imageUri ?? "").trim()) badges.push("IMG");
  if ((s.videoUri ?? "").trim()) badges.push("VID");
  return badges;
}

function isUsableYoutubeUrl(raw?: string) {
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
}

function competitionResultLabel(r: KidCompetitionResult | undefined): string {
  if (!r) return "No result yet";
  return getPlacementLabel(r);
}

function competitionOutcomeKindLabel(k: KidCompetitionOutcomeKind): string {
  switch (k) {
    case "points":
      return "Points";
    case "submission":
      return "Submission";
    case "decision":
      return "Decision";
    case "disqualification":
      return "DQ";
    case "medical":
      return "Medical";
    case "other":
      return "Other";
    case "unknown":
      return "Unknown";
  }
}

function competitionFormatLabel(f: KidCompetitionFormat | undefined): string | null {
  switch (f) {
    case "gi":
      return "Gi";
    case "nogi":
      return "No-Gi";
    case "both":
      return "Both";
    default:
      return null;
  }
}

const COACH_COMP_YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function compareCoachCompYMD(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Coach list: always show a clear lifecycle label even when the family left `eventStatus` unset.
 */
function coachCompetitionRowStatusLabel(row: KidCompetitionEntry, todayYMD: string): string {
  const st = row.status ?? row.eventStatus;
  const dateOk = COACH_COMP_YMD_RE.test(row.eventDate);
  const isFutureOrToday =
    dateOk && compareCoachCompYMD(row.eventDate, todayYMD) >= 0;
  const isPastDate = dateOk && compareCoachCompYMD(row.eventDate, todayYMD) < 0;

  if (st === "cancelled") return "Cancelled";
  if (st === "completed") return "Completed";
  if (st === "upcoming") {
    return isPastDate ? "Past date" : "Upcoming";
  }
  if (st === "unknown") {
    return isFutureOrToday ? "Upcoming" : "Past";
  }
  if (!dateOk) return "Unknown";
  if (isFutureOrToday) return "Upcoming";
  return "Past";
}

function competitionMetaLine(row: KidCompetitionEntry): string | null {
  const parts: string[] = [];
  const org = row.organizationOrPromoter?.trim();
  if (org) parts.push(org);
  const fmt = competitionFormatLabel(row.format);
  if (fmt) parts.push(fmt);
  if (row.outcomeKind) parts.push(competitionOutcomeKindLabel(row.outcomeKind));
  return parts.length ? parts.join(" · ") : null;
}

/** Local coach clips: `competitionVideos` when present, else legacy `videoUri` / `videoAssetId`. */
function coachCompetitionVideoRefsForRow(row: KidCompetitionEntry): {
  uri: string;
  assetId?: string | null;
}[] {
  const fromArr = row.competitionVideos?.filter((v) => (v?.uri ?? "").trim()) ?? [];
  if (fromArr.length > 0) {
    return fromArr.map((v) => ({
      uri: v.uri.trim(),
      assetId: v.assetId ?? null,
    }));
  }
  const u = row.videoUri?.trim();
  if (u) return [{ uri: u, assetId: row.videoAssetId ?? null }];
  return [];
}

function formatMonthHeading(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  const d = new Date(y, m - 1, 1);
  if (Number.isNaN(d.getTime())) return monthKey;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatCoachKidDetailRefreshLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Last updated today, ${time}`;
  return `Last updated ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

function groupCompetitionsByMonth(entries: KidCompetitionEntry[]): {
  monthKey: string;
  entries: KidCompetitionEntry[];
}[] {
  const map = new Map<string, KidCompetitionEntry[]>();
  for (const e of entries) {
    const mk = e.eventDate.length >= 7 ? e.eventDate.slice(0, 7) : "";
    if (!mk) continue;
    const arr = map.get(mk) ?? [];
    arr.push(e);
    map.set(mk, arr);
  }
  const keys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
  return keys.map((monthKey) => ({
    monthKey,
    entries: (map.get(monthKey) ?? []).sort(
      (a, b) =>
        b.eventDate.localeCompare(a.eventDate) ||
        b.createdAt.localeCompare(a.createdAt),
    ),
  }));
}

async function openHttpsUrl(rawUrl: string | undefined) {
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
}

async function openYoutubeUrl(rawUrl: string | undefined) {
  if (!isUsableYoutubeUrl(rawUrl)) return;
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
}

export default function KidDetailScreen() {
  const params = useLocalSearchParams<{ kidId?: string }>();
  const kidId = params.kidId ? String(params.kidId) : "";
  const segments = useSegments();
  const pathname = usePathname();
  const segmentKeys = segments as readonly string[];
  const isCoachKidDetail =
    segmentKeys.includes("coach") && segmentKeys.includes("kid");
  const isThisWeekKidDetail =
    segmentKeys.includes("this-week") && segmentKeys.includes("kid");

  /** Stack prefix for nested kid routes (shared coach + parent kid detail). */
  const kidLaneBase = useMemo(() => {
    if (!kidId) return "";
    if (isThisWeekKidDetail) return `/this-week/kid/${kidId}`;
    return `/coach/kid/${kidId}`;
  }, [kidId, isThisWeekKidDetail]);

  /** Match competition editor to the tab stack that mounted this screen. */
  const competitionEditBaseHref = useMemo(() => {
    if (kidLaneBase) return `${kidLaneBase}/competition/edit`;
    return `/coach/kid/${kidId}/competition/edit`;
  }, [kidLaneBase, kidId]);

  useEffect(() => {
    const lane = isThisWeekKidDetail ? "parent" : isCoachKidDetail ? "coach" : "unknown";
    console.log("[KID_DETAIL_LANE]", {
      pathname: String(pathname ?? ""),
      segments: [...segments],
      lane,
      kidId,
    });
  }, [pathname, segments, isThisWeekKidDetail, isCoachKidDetail, kidId]);

  const kidDetailMountRef = useRef(0);
  useEffect(() => {
    kidDetailMountRef.current += 1;
    console.log(`[MOUNT_TRACE:KID_DETAIL] ${kidDetailMountRef.current}`);
  }, []);

  const weekStartYMD = useMemo(() => {
    if (!kidId) return "";
    return startOfWeekMondayYMD(todayYMD());
  }, [kidId]);

  const [ready, setReady] = useState(false);
  const [kidName, setKidName] = useState<string>("—");
  const [householdDraft, setHouseholdDraft] = useState("");
  const [householdBaseline, setHouseholdBaseline] = useState("");
  const [savingHousehold, setSavingHousehold] = useState(false);
  const [householdSavedAck, setHouseholdSavedAck] = useState(false);
  const [currentWeekEntry, setCurrentWeekEntry] = useState<KidWeeklyFocusEntry | null>(null);
  const [weeklyFocusEntriesThisWeek, setWeeklyFocusEntriesThisWeek] = useState<
    KidWeeklyFocusEntry[]
  >([]);
  const [publishedWeeklyFeedback, setPublishedWeeklyFeedback] =
    useState<SyncedWeeklyMessagePayload["parentFeedback"] | null>(null);
  const [thisWeekReflections, setThisWeekReflections] = useState<KidWeeklyFocusEntry[]>([]);

  const [sparringDraft, setSparringDraft] =
    useState<"not_yet" | "sometimes" | "yes">("not_yet");
  const [notesDraft, setNotesDraft] = useState<string>("");
  const [weeklyWhyThisMatters, setWeeklyWhyThisMatters] = useState("");
  const [hasUserEditedWeekly, setHasUserEditedWeekly] = useState(false);
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [competitions, setCompetitions] = useState<KidCompetitionEntry[]>([]);
  const [lastCompetitionWeekly, setLastCompetitionWeekly] =
    useState<LastCompetitionWeeklyContext | null>(null);
  const [kidWeekSessions, setKidWeekSessions] = useState<Session[]>([]);
  const [competitionDerivedTrainingFocus, setCompetitionDerivedTrainingFocus] =
    useState<CompetitionTrainingSkillFocus | null>(null);
  const [readTogetherPreviewOpen, setReadTogetherPreviewOpen] = useState(false);
  const [readTogetherPreviewStep, setReadTogetherPreviewStep] = useState(0);
  const [suggestedFocusEditOpen, setSuggestedFocusEditOpen] = useState(false);
  const [suggestedFocusDraft, setSuggestedFocusDraft] = useState("");
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [mediaPreview, setMediaPreview] = useState<MediaPreviewState | null>(null);
  const [playableMediaUri, setPlayableMediaUri] = useState<string | null>(null);
  const [standingGuidance, setStandingGuidance] = useState<KidStandingGuidance | null>(null);
  const [progressNotesInputKey, setProgressNotesInputKey] = useState(0);
  const [publishingWeekly, setPublishingWeekly] = useState(false);
  const [headerRefreshing, setHeaderRefreshing] = useState(false);
  /** Coach detail only: row was soft-archived (redirect shortly after). */
  const [coachRosterRowArchived, setCoachRosterRowArchived] = useState(false);
  /** Set when a header refresh completes successfully (ISO timestamp for display). */
  const [lastHeaderRefreshAtIso, setLastHeaderRefreshAtIso] = useState<string | null>(null);
  const [householdUtilityExpanded, setHouseholdUtilityExpanded] = useState(false);

  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const keyboardAwareRef = useRef<InstanceType<typeof KeyboardAwareScrollView> | null>(null);
  /** Monotonic per screen mount: correlates logs and drops stale async `load()` completions. */
  const coachKidDetailLoadGenRef = useRef(0);
  /** Coalesces overlapping non-force loads for the same `kidId` (e.g. Strict Mode + focus). */
  const coachKidDetailNonForceLoadInFlightRef = useRef<{
    kidId: string;
    promise: Promise<boolean>;
  } | null>(null);
  /** Synchronous guard so rapid header taps cannot start overlapping refresh loads before state re-renders. */
  const coachKidHeaderRefreshInFlightRef = useRef(false);

  const bumpScrollToFocusedInput = useCallback(() => {
    const run = () => {
      (keyboardAwareRef.current as { update?: () => void } | null)?.update?.();
    };
    requestAnimationFrame(run);
    setTimeout(run, 120);
    setTimeout(run, 340);
  }, []);

  useEffect(() => {
    if (Platform.OS === "ios") {
      const sub = Keyboard.addListener("keyboardWillChangeFrame", bumpScrollToFocusedInput);
      return () => sub.remove();
    }
    const sub = Keyboard.addListener("keyboardDidShow", bumpScrollToFocusedInput);
    return () => sub.remove();
  }, [bumpScrollToFocusedInput]);

  useEffect(() => {
    setWeeklyWhyThisMatters(currentWeekEntry?.familyCoachRecapNote ?? "");
    setHasUserEditedWeekly(false);
  }, [currentWeekEntry?.familyCoachRecapNote, currentWeekEntry?.id]);

  const load = useCallback(async (opts?: {
    keepPreviousUiReady?: boolean;
    /** When true, always hit the network for coach session GET (bypass AsyncStorage session cache). */
    forceCoachSessionFetch?: boolean;
  }) => {
    if (!kidId || !weekStartYMD) return false;
    if (!opts?.forceCoachSessionFetch) {
      const inflight = coachKidDetailNonForceLoadInFlightRef.current;
      if (inflight && inflight.kidId === kidId) return inflight.promise;
    }

    const promise = (async (): Promise<boolean> => {
    const loadGen = ++coachKidDetailLoadGenRef.current;
    const keepPreviousUiReady = opts?.keepPreviousUiReady ?? false;
    setCoachRosterRowArchived(false);
    setCompetitionDerivedTrainingFocus(null);
    if (!keepPreviousUiReady) {
      setReady(false);
    }
    try {
      const kids = await getKidsById();
      if (loadGen !== coachKidDetailLoadGenRef.current) return false;
      const kid = kids[kidId];
      if (isCoachKidDetail && kid && isKidCoachArchived(kid)) {
        setCoachRosterRowArchived(true);
        setKidName(kid.name ?? "—");
        const householdLabel = kid.householdLabel ?? "";
        setHouseholdDraft(householdLabel);
        setHouseholdBaseline(householdLabel);
        setCurrentWeekEntry(null);
        setWeeklyFocusEntriesThisWeek([]);
        setThisWeekReflections([]);
        setCompetitions([]);
        setKidWeekSessions([]);
        setStandingGuidance(null);
        setPublishedWeeklyFeedback(null);
        if (loadGen === coachKidDetailLoadGenRef.current) {
          setReady(true);
        }
        return loadGen === coachKidDetailLoadGenRef.current;
      }
      setKidName(kid?.name ?? "—");
      const householdLabel = kid?.householdLabel ?? "";
      setHouseholdDraft(householdLabel);
      setHouseholdBaseline(householdLabel);

      const entry = await getLatestKidWeeklyFocusForWeek(kidId, weekStartYMD);
      setCurrentWeekEntry(entry);

      setSparringDraft(entry?.sparringApplication ?? "not_yet");
      // Latest week row is often a saved reflection (newest createdAt) and includes coachNotes;
      // prefilling that into the draft looks like text "stuck" after save.
      setNotesDraft("");

      const allEntries = await getKidWeeklyFocusEntriesForKid(kidId);
      setWeeklyFocusEntriesThisWeek(
        allEntries.filter((e) => e.weekStartYMD === weekStartYMD),
      );
      const weekReflections = allEntries.filter(
        (e) =>
          e.weekStartYMD === weekStartYMD &&
          (typeof e.coachOutcome !== "undefined" || Boolean((e.coachNotes ?? "").trim())),
      );
      weekReflections.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setThisWeekReflections(weekReflections);

      let compRows = await getKidCompetitionEntriesForKid(kidId);
      let feedbackForPublishedWeekly: SyncedWeeklyMessagePayload["parentFeedback"] | null =
        null;
      if (loadGen !== coachKidDetailLoadGenRef.current) return false;
      const sharedAthleteId = kid?.sharedAthleteId?.trim() ?? "";

      if (__DEV__) {
        const linksForLog = await getCoachLinks();
        const syncLinksForLog = sortCoachWriterLinksNewestFirst(
          dedupeActiveCoachWriterLinks(linksForLog).filter((l) => l.weeklySync),
        );
        console.log("[bjj-coach-kid-detail] focus/load", {
          loadGen,
          kidId,
          sharedAthleteId: sharedAthleteId || null,
          activeSyncLinkCount: syncLinksForLog.length,
          activeSyncLinkTokenTails: syncLinksForLog.map((l) => {
            const t = (l.weeklySync?.linkToken ?? "").trim();
            return t.length > 8 ? t.slice(-8) : t;
          }),
        });
      }

      if (sharedAthleteId) {
        if (loadGen !== coachKidDetailLoadGenRef.current) return false;

        const links = await getCoachLinks();
        const syncLinks = sortCoachWriterLinksNewestFirst(
          dedupeActiveCoachWriterLinks(links).filter((l) => l.weeklySync),
        );
        const successfulSessionsInOrder: CoachWeeklySyncSessionResponse[] = [];
        let sessionFetchFailures = 0;
        let sessionIndex = 0;
        for (const l of syncLinks) {
          sessionIndex += 1;
          const ws = l.weeklySync!;
          const token = ws.linkToken ?? "";
          const linkTokenTail = token.length > 8 ? token.slice(-8) : token;
          const tokenNorm = normalizeInviteLinkToken(token);
          let readinessRun: CoachAnalysisReadinessRun | null = null;
          try {
            let session: CoachWeeklySyncSessionResponse;
            const useSessionCache = !opts?.forceCoachSessionFetch && Boolean(token);
            if (useSessionCache) {
              const cached = await getCachedWeeklyForLinkToken(token);
              if (cached?.session) {
                console.log(
                  `[CACHE HIT] coachSyncFetchSession tokenNorm=${cached.tokenNorm || tokenNorm}`,
                );
                session = cached.session;
              } else {
                console.log(`[API CALL] coachSyncFetchSession tokenNorm=${tokenNorm}`);
                if (isThisWeekKidDetail) {
                  readinessRun = await startCoachAnalysisReadinessRun({
                    initialSharedAthleteIds: [sharedAthleteId],
                    linkKeys: [tokenNorm],
                    startedAt: new Date().toISOString(),
                    hydrationSource: "parent_session_refresh",
                  });
                  if (loadGen !== coachKidDetailLoadGenRef.current) return false;
                }
                session = await coachSyncFetchSession(ws.linkToken, ws.apiBaseUrl);
                if (loadGen !== coachKidDetailLoadGenRef.current) return false;
                const nowIso = new Date().toISOString();
                await setCachedWeeklyForLinkToken(
                  ws.linkToken,
                  session.weekly,
                  nowIso,
                  session.weeklyByAthleteId ?? {},
                  session.athletes,
                  session,
                  tokenNorm,
                );
                if (loadGen !== coachKidDetailLoadGenRef.current) return false;
                readinessRun?.recordSuccessfulSession(tokenNorm, session);
                await readinessRun?.finalize(new Date().toISOString());
              }
            } else {
              console.log(
                opts?.forceCoachSessionFetch
                  ? "[API CALL] coachSyncFetchSession (source: KidDetailScreen_refresh)"
                  : `[API CALL] coachSyncFetchSession tokenNorm=${tokenNorm}`,
              );
              if (isThisWeekKidDetail) {
                readinessRun = await startCoachAnalysisReadinessRun({
                  initialSharedAthleteIds: [sharedAthleteId],
                  linkKeys: [tokenNorm],
                  startedAt: new Date().toISOString(),
                  hydrationSource: "parent_session_refresh",
                });
                if (loadGen !== coachKidDetailLoadGenRef.current) return false;
              }
              session = await coachSyncFetchSession(ws.linkToken, ws.apiBaseUrl);
              if (loadGen !== coachKidDetailLoadGenRef.current) return false;
              if (token) {
                const nowIso = new Date().toISOString();
                await setCachedWeeklyForLinkToken(
                  ws.linkToken,
                  session.weekly,
                  nowIso,
                  session.weeklyByAthleteId ?? {},
                  session.athletes,
                  session,
                  tokenNorm,
                );
                if (loadGen !== coachKidDetailLoadGenRef.current) return false;
                readinessRun?.recordSuccessfulSession(tokenNorm, session);
                await readinessRun?.finalize(new Date().toISOString());
              }
            }
            if (loadGen !== coachKidDetailLoadGenRef.current) return false;

            successfulSessionsInOrder.push(session);

            const athleteIdsInSession = session.athletes.map((a) => a.id);
            const athleteInSession = session.athletes.some((a) => a.id === sharedAthleteId);
            const totalRemote = session.competitions.length;
            const matching = athleteInSession
              ? session.competitions.filter((c) => c.sharedAthleteId === sharedAthleteId)
              : [];
            if (__DEV__) {
              console.log("[bjj-coach-kid-detail] session fetch", {
                loadGen,
                sessionIndex,
                totalSessionsInLoop: syncLinks.length,
                linkTokenTail,
                athleteIdsInSession,
                remoteCompetitionsTotal: totalRemote,
                competitionIdsForSharedAthlete: matching.map((c) => c.id),
                athleteInSession,
                matchingSharedAthleteCount: matching.length,
              });
            }
          } catch {
            if (
              readinessRun &&
              loadGen === coachKidDetailLoadGenRef.current
            ) {
              readinessRun.recordFailedLink(tokenNorm);
              await readinessRun.finalize(new Date().toISOString());
            }
            sessionFetchFailures += 1;
            if (__DEV__) {
              console.log("[bjj-coach-kid-detail] session fetch failed", {
                loadGen,
                sessionIndex,
                totalSessionsInLoop: syncLinks.length,
                linkTokenTail,
              });
            }
            // Best-effort read path: keep current local rows if every session fetch fails.
          }
        }
        const remoteForKid = pickRemoteSharedCompetitionsForLinkedAthlete(
          successfulSessionsInOrder,
          sharedAthleteId,
        );
        feedbackForPublishedWeekly = pickPublishedWeeklyParentFeedbackForSharedAthlete(
          successfulSessionsInOrder,
          sharedAthleteId,
        );
        if (__DEV__) {
          console.log("[bjj-coach-kid-detail] canonical remote for athlete", {
            loadGen,
            successfulSessionCount: successfulSessionsInOrder.length,
            mergedRemoteCount: remoteForKid.length,
            mergedRemoteIds: remoteForKid.map((c) => c.id),
            sessionFetchFailures,
          });
        }
        const haveAuthoritativeRemote =
          syncLinks.length > 0 && sessionFetchFailures < syncLinks.length;
        // When any session fetch succeeds, merged remote list (possibly empty) is source of truth
        // for this athlete’s shared competition ids; prune stale shared rows either way.
        const shouldReconcileSharedComps = haveAuthoritativeRemote;
        if (__DEV__) {
          console.log("[bjj-coach-kid-detail] reconcile gate", {
            loadGen,
            haveAuthoritativeRemote,
            shouldReconcileSharedComps,
            syncLinkCount: syncLinks.length,
            sessionFetchFailures,
          });
        }
        if (shouldReconcileSharedComps) {
          if (loadGen !== coachKidDetailLoadGenRef.current) return false;

          if (__DEV__) {
            console.log("[bjj-coach-kid-detail] local competitions before reconcile", {
              loadGen,
              kidId,
              sharedAthleteId,
              rowCount: compRows.length,
              rows: compRows.map((r) => ({
                id: r.id,
                sharedCompetitionId: r.sharedCompetitionId ?? null,
                sharedAthleteId: r.sharedAthleteId ?? null,
                tournamentName: r.tournamentName,
              })),
            });
          }
          compRows = await upsertSharedCompetitionsForKid(kidId, sharedAthleteId, remoteForKid);
          if (loadGen !== coachKidDetailLoadGenRef.current) return false;

          setCompetitions(compRows);

          if (__DEV__) {
            console.log("[bjj-coach-kid-detail] local competitions after reconcile (pre setState)", {
              loadGen,
              kidId,
              rowCount: compRows.length,
              rowIds: compRows.map((r) => r.id),
              sharedCompetitionIds: compRows
                .map((r) => r.sharedCompetitionId)
                .filter(Boolean),
            });
          }
        } else if (__DEV__) {
          console.log("[bjj-coach-kid-detail] reconcile skipped (no upsert)", {
            loadGen,
          });
        }
      }
      setPublishedWeeklyFeedback(feedbackForPublishedWeekly);
      if (loadGen !== coachKidDetailLoadGenRef.current) return false;

      if (__DEV__) {
        console.log("[bjj-coach-kid-detail] setCompetitions", {
          loadGen,
          kidId,
          compRowCount: compRows.length,
          competitionIdsForRender: compRows.map((r) => r.id),
        });
      }
      setCompetitions(compRows);

      const withDetail = await mergeCompetitionMatchDetailIntoEntries(compRows);
      if (loadGen !== coachKidDetailLoadGenRef.current) return false;
      setLastCompetitionWeekly(pickLastCompetitionWeeklyContext(withDetail, todayYMD()));

      const guidanceRow = await getKidStandingGuidance(kidId);
      setStandingGuidance(guidanceRow);

      // Lightweight "this week's training" display (pilot-only).
      const weekEndYMD = addDaysYMDLocal(weekStartYMD, 6);
      const rawSessions = await AsyncStorage.getItem(StorageKeys.sessions);
      let parsed: unknown = [];
      try {
        parsed = rawSessions ? JSON.parse(rawSessions) : [];
      } catch {
        parsed = [];
      }

      const sessionsArray = Array.isArray(parsed) ? (parsed as unknown[]) : [];
      const kidWeek = sessionsArray
        .filter((s: any) => String(s?.kidId ?? "").trim() === kidId)
        .filter((s: any) => {
          const d = toDateKey(s?.date ?? "");
          return (
            /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= weekStartYMD && d <= weekEndYMD
          );
        })
        .map((s: any) => s as Session)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      setKidWeekSessions(kidWeek);
      if (loadGen !== coachKidDetailLoadGenRef.current) return false;
      const allKidSessions = sessionsArray
        .filter((s: any) => String(s?.kidId ?? "").trim() === kidId)
        .map((s: any) => s as Session);
      setCompetitionDerivedTrainingFocus(
        deriveCompetitionTrainingSkillFocus({
          competitionsWithMatches: withDetail,
          sessions: allKidSessions,
        }),
      );
      return loadGen === coachKidDetailLoadGenRef.current;
    } finally {
      if (loadGen === coachKidDetailLoadGenRef.current) {
        setReady(true);
      }
    }
    })();

    if (!opts?.forceCoachSessionFetch) {
      const entry = { kidId, promise };
      coachKidDetailNonForceLoadInFlightRef.current = entry;
      void promise.finally(() => {
        if (coachKidDetailNonForceLoadInFlightRef.current === entry) {
          coachKidDetailNonForceLoadInFlightRef.current = null;
        }
      });
    }
    return promise;
  }, [isCoachKidDetail, isThisWeekKidDetail, kidId, weekStartYMD]);

  const onRefreshFromHeader = useCallback(async () => {
    if (!kidId) return;
    if (coachKidHeaderRefreshInFlightRef.current) return;
    coachKidHeaderRefreshInFlightRef.current = true;
    const refreshStartedAt = Date.now();
    setHeaderRefreshing(true);
    try {
      const applied = await load({
        keepPreviousUiReady: true,
        forceCoachSessionFetch: true,
      });
      if (applied) {
        setLastHeaderRefreshAtIso(new Date().toISOString());
      }
    } finally {
      const elapsed = Date.now() - refreshStartedAt;
      const remainder = COACH_KID_HEADER_REFRESH_MIN_VISIBLE_MS - elapsed;
      if (remainder > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, remainder));
      }
      coachKidHeaderRefreshInFlightRef.current = false;
      setHeaderRefreshing(false);
    }
  }, [kidId, load]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => void onRefreshFromHeader()}
          disabled={headerRefreshing || !kidId}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 8,
            justifyContent: "center",
            alignItems: "center",
          }}
          accessibilityRole="button"
          accessibilityLabel="Refresh from parent sync"
          accessibilityState={{ busy: headerRefreshing }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: headerRefreshing ? 6 : 0,
            }}
          >
            {headerRefreshing ? (
              <ActivityIndicator size="small" color="#1d4ed8" />
            ) : null}
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: headerRefreshing || !kidId ? "#93c5fd" : "#1d4ed8",
                includeFontPadding: false,
                textAlignVertical: "center",
              }}
            >
              {headerRefreshing ? "Refreshing…" : "Refresh"}
            </Text>
          </View>
        </Pressable>
      ),
    });
  }, [navigation, headerRefreshing, kidId, onRefreshFromHeader]);

  useEffect(() => {
    if (!__DEV__ || !kidId) return;
    console.log("[bjj-coach-kid-detail] final rendered competition ids (state)", {
      kidId,
      loadGenCurrent: coachKidDetailLoadGenRef.current,
      competitionRowIds: competitions.map((r) => r.id),
      sharedCompetitionIds: competitions
        .map((r) => r.sharedCompetitionId)
        .filter(Boolean),
    });
  }, [competitions, kidId]);

  const monthGroups = useMemo(
    () => groupCompetitionsByMonth(competitions),
    [competitions],
  );

  const competitionHeaderRefreshLabel = useMemo(
    () => formatCoachKidDetailRefreshLabel(lastHeaderRefreshAtIso),
    [lastHeaderRefreshAtIso],
  );

  useEffect(() => {
    if (!monthGroups.length) return;
    setExpandedMonths((prev) => {
      if (prev.size > 0) return prev;
      const cur = todayYMD().slice(0, 7);
      const hasCur = monthGroups.some((g) => g.monthKey === cur);
      return new Set([hasCur ? cur : monthGroups[0].monthKey]);
    });
  }, [monthGroups]);

  const toggleMonth = useCallback((monthKey: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!isCoachKidDetail && !isThisWeekKidDetail) return;
      const onHardwareBack = () => {
        if (isCoachKidDetail) {
          router.replace("/coach");
          return true;
        }
        if (isThisWeekKidDetail) {
          router.replace("/this-week/kids");
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
      return () => sub.remove();
    }, [isCoachKidDetail, isThisWeekKidDetail]),
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setPlayableMediaUri(null);

      if (!mediaPreview) return;

      const resolved = await resolveMediaUri(mediaPreview.uri, mediaPreview.assetId ?? null);
      if (cancelled) return;

      setPlayableMediaUri(resolved);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [mediaPreview]);

  useEffect(() => {
    if (!kidId) {
      Alert.alert("Missing kid id", "Choose a kid from the roster first.");
      router.replace(isThisWeekKidDetail ? "/this-week/kids" : "/coach/kids");
    }
  }, [kidId, isThisWeekKidDetail]);

  useEffect(() => {
    setHouseholdSavedAck(false);
  }, [kidId]);

  useEffect(() => {
    if (!isCoachKidDetail || !kidId) return;
    let cancelled = false;
    void (async () => {
      const kids = await getKidsById();
      if (cancelled) return;
      const k = kids[kidId];
      if (k && isKidCoachArchived(k)) {
        router.replace("/coach");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCoachKidDetail, kidId]);

  const householdDirty = householdDraft !== householdBaseline;

  const canEditOutcome = Boolean(currentWeekEntry);

  const competitionListTodayYMD = todayYMD();

  const focusTitle = currentWeekEntry?.title ?? null;
  const recommendedFocusArea = useMemo(
    () => recommendedFocusAreaFromTrainingSkillFocus(competitionDerivedTrainingFocus),
    [competitionDerivedTrainingFocus],
  );

  const handleUseRecommendedFocusArea = useCallback(() => {
    if (!kidId || !recommendedFocusArea) return;
    const line = `Weekly training focus: ${recommendedFocusArea}.`;
    setWeeklyWhyThisMatters((prev) => {
      const p = prev.trim();
      return p ? `${p}\n\n${line}` : line;
    });
    setHasUserEditedWeekly(true);
    recordCoachTrainingFocusDecision(kidId, recommendedFocusArea, recommendedFocusArea);
  }, [kidId, recommendedFocusArea]);

  const openSuggestedFocusModal = useCallback(() => {
    if (!recommendedFocusArea) return;
    setSuggestedFocusDraft(recommendedFocusArea);
    setSuggestedFocusEditOpen(true);
  }, [recommendedFocusArea]);

  const closeSuggestedFocusModal = useCallback(() => {
    setSuggestedFocusEditOpen(false);
    Keyboard.dismiss();
  }, []);

  const handleApplySuggestedFocusEdit = useCallback(() => {
    if (!kidId || !recommendedFocusArea) return;
    const edited = collapseFocusText(suggestedFocusDraft);
    if (!edited.length) {
      Alert.alert(
        "Add focus wording",
        "Type how you want to phrase this week’s training focus, or cancel.",
      );
      return;
    }
    setWeeklyWhyThisMatters((prev) => {
      const p = prev.trim();
      return p ? `${p}\n\n${edited}` : edited;
    });
    setHasUserEditedWeekly(true);
    recordCoachTrainingFocusDecision(kidId, recommendedFocusArea, edited);
    closeSuggestedFocusModal();
  }, [
    kidId,
    recommendedFocusArea,
    suggestedFocusDraft,
    closeSuggestedFocusModal,
  ]);
  const feedback = publishedWeeklyFeedback;
  const feedbackStatus = feedback?.acknowledgedAt
    ? "acknowledged"
    : feedback?.viewedAt
      ? "viewed"
      : "not_viewed";
  const feedbackStatusLabel =
    feedbackStatus === "acknowledged"
      ? "✓ Acknowledged"
      : feedbackStatus === "viewed"
        ? "✓ Viewed"
        : "• Not viewed";
  const sparringApplication = currentWeekEntry?.sparringApplication;
  const suggestion = useMemo(
    () =>
      deriveWeeklyNarrative({
        sparringApplication,
        sessionsThisWeek: kidWeekSessions.length,
        recentCompetitionCount: competitions.length,
      }),
    [competitions.length, kidWeekSessions.length, sparringApplication],
  );
  const showSuggestion =
    !hasUserEditedWeekly &&
    weeklyWhyThisMatters.length === 0 &&
    Boolean(sparringApplication);
  const handleUseSuggestion = useCallback(() => {
    setWeeklyWhyThisMatters(suggestion.message);
    setHasUserEditedWeekly(true);
  }, [suggestion.message]);
  const handleEdit = useCallback(() => {
    setHasUserEditedWeekly(true);
  }, []);

  const readTogetherPreviewPractice = useMemo(() => {
    const sorted = [...kidWeekSessions].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return {
      sessionCountThisWeek: kidWeekSessions.length,
      latestSession: sorted[0] ?? null,
    };
  }, [kidWeekSessions]);

  const familyHuddleSourceMapRows = useMemo(() => {
    const e = currentWeekEntry;
    const titleTrim = (e?.title ?? "").trim();
    const bodyRaw = e
      ? e.focusType === "template"
        ? (e.metadata ?? "").trim()
        : (e.note ?? "").trim()
      : "";
    const recapTrim = (e?.familyCoachRecapNote ?? "").trim();
    const famUrl = (e?.familyResourceUrl ?? "").trim();
    const famLabel = (e?.familyResourceLabel ?? "").trim();

    const n = kidWeekSessions.length;
    const sortedWeekSessions =
      n > 0
        ? [...kidWeekSessions].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
        : [];
    const latestSession = sortedWeekSessions[0];
    const matsLine =
      n === 0
        ? "No sessions logged this week"
        : latestSession
          ? `${n} session${n === 1 ? "" : "s"} · latest ${latestSession.date}`
          : `${n} session${n === 1 ? "" : "s"} logged`;

    const trunc = (s: string, max: number) =>
      s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`;

    let missionLine: string;
    if (!e) {
      missionLine = "Save a weekly focus first";
    } else if (!titleTrim) {
      missionLine = "Add a title in weekly focus";
    } else if (bodyRaw) {
      missionLine = `${trunc(titleTrim, 36)} · family note set`;
    } else {
      missionLine = `${trunc(titleTrim, 36)} · default note on publish`;
    }

    const recapStatus = !e
      ? `Recap this week’s 1:1 session for parents.\n\n—`
      : recapTrim
        ? `Recap this week’s 1:1 session for parents.`
        : `Recap this week’s 1:1 session for parents.\n\nEmpty — parents see gentle placeholder`;

    const studyLine = !e
      ? "—"
      : famUrl
        ? famLabel
          ? `${trunc(famLabel, 40)} · link set`
          : "Link set"
        : "No link — card uses mission cue";

    const journeyLine =
      "From class or program notes when you add them, otherwise a short encouragement line.";

    // Each row's heading is the canonical parent-facing card title for that source
    // (mission ≠ recap ≠ study ≠ mats ≠ journey). The Family Huddle modal renders
    // a subset of these (coach recap, study, journey) — mission and mats render on
    // the parent main This Week card. Keeping the source-map headings tied to the
    // shared titles keeps coach preview semantics aligned with parent rendering.
    return [
      {
        heading: READ_TOGETHER_TITLES.mission,
        badge: "Weekly Focus" as const,
        status: missionLine,
      },
      {
        heading: READ_TOGETHER_TITLES.coachRecap,
        badge: "You write" as const,
        status: recapStatus,
      },
      {
        heading: READ_TOGETHER_TITLES.mats,
        badge: "From training" as const,
        status: matsLine,
      },
      {
        heading: READ_TOGETHER_TITLES.studyMove,
        badge: "Optional" as const,
        status: studyLine,
      },
      {
        heading: READ_TOGETHER_TITLES.journey,
        badge: "Auto" as const,
        status: journeyLine,
      },
    ];
  }, [currentWeekEntry, kidWeekSessions]);

  const readTogetherPreviewCards = useMemo(() => {
    if (!currentWeekEntry || !weekStartYMD) return [];
    const payload = kidWeeklyFocusToPublishPayload(currentWeekEntry, weekStartYMD, {
      sameWeekEntriesForMissionFallback: weeklyFocusEntriesThisWeek,
    });
    // Synthetic payload mirrors the SyncedWeeklyMessagePayload shape parents hydrate
    // (headline, body, missionResourceUrl/Label, familyResourceUrl/Label,
    // familyCoachRecapNote). youtubeUrl and other coach-only fields are intentionally
    // excluded — they live on the coach UI only and never enter parent-facing render.
    const synthetic: SyncedWeeklyMessagePayload = {
      weekStartYMD: payload.weekStartYMD,
      ...(payload.systemKey ? { systemKey: payload.systemKey } : {}),
      headline: payload.headline,
      body: payload.body,
      updatedAt: currentWeekEntry.updatedAt,
      ...(payload.missionResourceUrl
        ? {
            missionResourceUrl: payload.missionResourceUrl,
            ...(payload.missionResourceLabel
              ? { missionResourceLabel: payload.missionResourceLabel }
              : {}),
          }
        : {}),
      ...(payload.familyResourceUrl
        ? {
            familyResourceUrl: payload.familyResourceUrl,
            ...(payload.familyResourceLabel
              ? { familyResourceLabel: payload.familyResourceLabel }
              : {}),
          }
        : {}),
      ...(payload.familyCoachRecapNote
        ? { familyCoachRecapNote: payload.familyCoachRecapNote }
        : {}),
    };
    return buildReadTogetherStoryCards({
      mode: "weekly_sync",
      weekStartYMD,
      weeklySyncDoc: synthetic,
      weeklySyncNetworkOk: true,
      missionHeadline: synthetic.headline,
      missionBody: synthetic.body,
      missionEyebrow: "Shared weekly note (this invite)",
      legacyClassProgramBody: "",
      closingNavigationHint:
        "Publishing updates the shared weekly note for this invite.",
      practiceSummary: readTogetherPreviewPractice,
    });
  }, [
    currentWeekEntry,
    weekStartYMD,
    readTogetherPreviewPractice,
    weeklyFocusEntriesThisWeek,
  ]);

  const closeReadTogetherPreview = useCallback(() => {
    setReadTogetherPreviewOpen(false);
    setReadTogetherPreviewStep(0);
  }, []);

  const standingHeadline = (standingGuidance?.headline ?? "").trim();
  const standingDetail = (standingGuidance?.detail ?? "").trim();
  const standingPrimary =
    standingHeadline || standingDetail;
  const standingSecondaryMuted =
    standingHeadline && standingDetail ? standingDetail : "";
  const standingIsActive = Boolean(standingPrimary);

  const onSaveHousehold = useCallback(async () => {
    if (!kidId) return;
    setSavingHousehold(true);
    setHouseholdSavedAck(false);
    try {
      const updated = await updateKidHouseholdLabel(kidId, householdDraft);
      if (!updated) {
        Alert.alert("Kid not found", "This roster entry may have been removed.");
        router.replace(isThisWeekKidDetail ? "/this-week/kids" : "/coach/kids");
        return;
      }
      const savedHouseholdLabel = updated.householdLabel ?? "";
      setHouseholdDraft(savedHouseholdLabel);
      setHouseholdBaseline(savedHouseholdLabel);
      setHouseholdSavedAck(true);
    } finally {
      setSavingHousehold(false);
    }
  }, [kidId, householdDraft, isThisWeekKidDetail]);

  const appendCoachWeeklyCheckIn = useCallback(
    async (coachOutcome: CoachOutcome, coachNotes?: string) => {
      if (!currentWeekEntry) return;
      const trimmedNotes = (coachNotes ?? "").trim();
      const inheritedSystemKey = currentWeekEntry.systemKey;

      let latestRow: Awaited<ReturnType<typeof appendKidWeeklyFocus>>;
      if (currentWeekEntry.focusType === "template") {
        latestRow = await appendKidWeeklyFocus({
          kidId,
          weekStartYMD,
          focusType: "template",
          templateId: currentWeekEntry.templateId,
          title: currentWeekEntry.title,
          metadata: currentWeekEntry.metadata,
          youtubeUrl: currentWeekEntry.youtubeUrl,
          systemKey: inheritedSystemKey,
          missionResourceUrl: currentWeekEntry.missionResourceUrl,
          missionResourceLabel: currentWeekEntry.missionResourceLabel,
          familyResourceUrl: currentWeekEntry.familyResourceUrl,
          familyResourceLabel: currentWeekEntry.familyResourceLabel,
          familyCoachRecapNote: currentWeekEntry.familyCoachRecapNote,
          coachOutcome,
          sparringApplication: sparringDraft,
          coachNotes: trimmedNotes ? trimmedNotes : undefined,
        });
      } else {
        latestRow = await appendKidWeeklyFocus({
          kidId,
          weekStartYMD,
          focusType: "custom",
          title: currentWeekEntry.title,
          note: currentWeekEntry.note,
          youtubeUrl: currentWeekEntry.youtubeUrl,
          systemKey: inheritedSystemKey,
          missionResourceUrl: currentWeekEntry.missionResourceUrl,
          missionResourceLabel: currentWeekEntry.missionResourceLabel,
          familyResourceUrl: currentWeekEntry.familyResourceUrl,
          familyResourceLabel: currentWeekEntry.familyResourceLabel,
          familyCoachRecapNote: currentWeekEntry.familyCoachRecapNote,
          coachOutcome,
          sparringApplication: sparringDraft,
          coachNotes: trimmedNotes ? trimmedNotes : undefined,
        });
      }

      const sameWeekPool = (await getKidWeeklyFocusEntriesForKid(kidId)).filter(
        (e) => e.weekStartYMD === weekStartYMD,
      );
      const publishPayload = kidWeeklyFocusToPublishPayload(latestRow, weekStartYMD, {
        sameWeekEntriesForMissionFallback: sameWeekPool,
      });
      const prevNorm = normalizePublishableSystemKey(inheritedSystemKey);
      const latestNorm = normalizePublishableSystemKey(latestRow.systemKey);
      console.log("[WEEKLY_SYSTEM_INVARIANT]", {
        latestRowId: latestRow.id,
        latestRowSystemKey: latestRow.systemKey ?? null,
        publishPayloadSystemKey: publishPayload.systemKey ?? null,
        inheritedFromPrevious: Boolean(prevNorm && prevNorm === latestNorm),
        sameWeekCandidateCount: sameWeekPool.length,
      });

      console.log("[OUTCOME WRITE]", { kidId, coachOutcome });
      console.log("[SPARRING WRITE]", {
        kidId,
        sparringApplication: sparringDraft,
      });
    },
    [currentWeekEntry, kidId, sparringDraft, weekStartYMD],
  );

  const onSaveOutcome = useCallback(async () => {
    if (!currentWeekEntry) return;
    setSavingOutcome(true);
    try {
      await appendCoachWeeklyCheckIn(
        coachOutcomeFromSparringApplication(sparringDraft),
        notesDraft,
      );
      await load();
      setProgressNotesInputKey((k) => k + 1);
    } finally {
      setSavingOutcome(false);
    }
  }, [appendCoachWeeklyCheckIn, currentWeekEntry, load, notesDraft, sparringDraft]);

  const requestDeleteReflection = useCallback(
    (entryId: string) => {
      Alert.alert(
        "Delete check-in?",
        "This deletes this saved check-in from this kid’s log.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await deleteKidWeeklyFocusEntryById(entryId, kidId);
              await load();
            },
          },
        ],
      );
    },
    [kidId, load],
  );

  const requestDeleteCompetition = useCallback(
    (row: KidCompetitionEntry) => {
      const label = row.tournamentName.trim() || "this entry";
      Alert.alert("Delete competition?", `Delete “${label}”? This cannot be undone.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (row.sharedCompetitionId || row.sharedAthleteId) {
              const outcome = await deleteCompetition({
                entryId: row.id,
                kidId,
              });
              if (!outcome.ok) {
                Alert.alert(outcome.alertTitle, outcome.alertMessage);
                return;
              }
              await load();
              return;
            }
            logCompDelete("BEGIN", {
              competitionId: row.id,
              athleteId: kidId,
              operationKind: "optimistic",
              surface: "KidDetailScreen.requestDeleteCompetition",
              phaseDetail: "legacy_local_only_no_deleteCompetition_sync",
              localStoreAffected: "kidCompetitionStore",
            });
            await deleteKidCompetitionEntry(row.id);
            logCompDelete("COMPLETE", {
              competitionId: row.id,
              athleteId: kidId,
              operationKind: "local",
              surface: "KidDetailScreen.requestDeleteCompetition",
              phaseDetail: "legacy_local_only_no_remote_publish",
            });
            await load();
          },
        },
      ]);
    },
    [kidId, load],
  );

  const openCoachCompetitionVideos = useCallback((row: KidCompetitionEntry) => {
    const refs = coachCompetitionVideoRefsForRow(row);
    if (refs.length === 0) return;
    const play = (i: number) =>
      setMediaPreview({
        type: "video",
        uri: refs[i].uri,
        assetId: refs[i].assetId ?? null,
      });
    if (refs.length === 1) {
      play(0);
      return;
    }
    // Android supports at most three alert buttons; omit Cancel when showing three clips.
    if (refs.length === 3 && Platform.OS === "android") {
      Alert.alert("3 videos", "Choose a clip to preview.", [
        { text: "Video 1", onPress: () => play(0) },
        { text: "Video 2", onPress: () => play(1) },
        { text: "Video 3", onPress: () => play(2) },
      ]);
      return;
    }
    Alert.alert(`${refs.length} videos`, "Choose a clip to preview.", [
      ...refs.map((r, i) => ({
        text: `Video ${i + 1}`,
        onPress: () => play(i),
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  }, []);

  const onPublishWeeklyToFamilies = useCallback(async () => {
    if (!kidId || !weekStartYMD) {
      Alert.alert("Set focus first", "Save this week’s focus before publishing to families.");
      return;
    }
    const latestEntry = await getLatestKidWeeklyFocusForWeek(kidId, weekStartYMD);
    if (!latestEntry) {
      Alert.alert("Set focus first", "Save this week’s focus before publishing to families.");
      return;
    }
    if (!isPublishableSystemKey(latestEntry.systemKey)) {
      const rawTrim = (latestEntry.systemKey ?? "").trim();
      if (rawTrim) {
        Alert.alert(
          "Cannot publish this system id",
          "The saved system classification cannot be sent to families (use lowercase letters, numbers, dots, and underscores). Edit this weekly focus and pick a BJJ system again.",
        );
      } else {
        Alert.alert(
          "Pick a system",
          "Edit this weekly focus and select its BJJ system before publishing.",
        );
      }
      return;
    }
    const sameWeekFallbackPool = (
      await getKidWeeklyFocusEntriesForKid(kidId)
    ).filter((e) => e.weekStartYMD === weekStartYMD);
    if (__DEV__) {
      const recap = (latestEntry.familyCoachRecapNote ?? "").trim();
      console.log("[bjj-coach-publish-latest-entry]", {
        entryId: latestEntry.id,
        familyResourceUrl: (latestEntry.familyResourceUrl ?? "").trim() || null,
        familyResourceLabel: (latestEntry.familyResourceLabel ?? "").trim() || null,
        storedFamilyCoachRecapNoteLen: recap.length,
      });
    }
    const links = await getCoachLinks();
    const kidRow = (await getKidsById())[kidId];
    const kidTokenKey = normalizeInviteLinkToken(kidRow?.sharedFromInviteTokenNorm ?? "");
    const writers = dedupeActiveCoachWriterLinks(links).filter((l) =>
      Boolean(l.weeklySync?.writerSecret?.trim()),
    );
    if (__DEV__) {
      console.log("[bjj-sync-debug] coach publish resolve writer cred", {
        kidId,
        sharedAthleteId: kidRow?.sharedAthleteId ?? null,
        sharedFromInviteTokenNorm: kidRow?.sharedFromInviteTokenNorm ?? null,
        kidTokenKey,
        writersCount: writers.length,
        writers: writers.map((l) => ({
          linkId: l.id,
          tokenTail: normalizeInviteLinkToken(l.weeklySync?.linkToken ?? ""),
          updatedAt: l.updatedAt,
          hasWriterSecret: Boolean(l.weeklySync?.writerSecret?.trim()),
        })),
      });
    }

    const resolved = await resolveCoachPublishWriterLink(kidRow, links);
    if (__DEV__) {
      console.log("[bjj-sync-debug] coach publish chosen cred", {
        kidId,
        resolvedOk: resolved.ok,
        resolvedReason: resolved.ok ? null : resolved.reason,
        chosenLinkId: resolved.ok ? resolved.link.id : null,
      });
    }

    if (!resolved.ok) {
      if (resolved.reason === "ambiguous_session") {
        Alert.alert(
          "Multiple invites",
          "This athlete appears on more than one active invite on this phone. Archive extra invites or relink so only one writable channel contains this athlete, then try again.",
        );
        return;
      }
      if (resolved.reason === "no_writers") {
        Alert.alert(
          "No invite on this device",
          "No active coach publish keys (writer invites) on this phone. Create a family invite from the Kids roster first.",
        );
        return;
      }
      Alert.alert(
        "No invite on this device",
        "This kid could not be matched to a single writable invite — the stored invite token may be missing or stale, or this athlete is not listed on any active invite session here. Pull to refresh on the Kids roster to reconcile, or relink this athlete on the correct invite.",
      );
      return;
    }

    const chosen = resolved.link;
    const ws = chosen.weeklySync;
    const writerSecret = ws?.writerSecret?.trim();
    if (!ws || !writerSecret) {
      Alert.alert(
        "No invite on this device",
        "No active publish key on the matched invite. Create or restore a writer invite from the Kids roster.",
      );
      return;
    }
    const sharedAthleteIdRaw = (kidRow?.sharedAthleteId ?? "").trim();

    if (!sharedAthleteIdRaw) {
      Alert.alert("Cannot publish", "This athlete is not properly linked yet.");
      return;
    }

    const sharedAthleteId = sharedAthleteIdRaw;
    const basePublish = kidWeeklyFocusToPublishPayload(latestEntry, weekStartYMD, {
      sameWeekEntriesForMissionFallback: sameWeekFallbackPool,
    });
    const payload: CoachWeeklySyncPublishBody = {
      ...basePublish,
      sharedAthleteId,
    };
    setPublishingWeekly(true);
    try {
      if (__DEV__) {
        console.log("[SYSTEMKEY TRACE CLIENT]", {
          traceStage: "2_publish_request_body",
          headline: payload.headline?.slice(0, 120) ?? null,
          systemKey: payload.systemKey ?? null,
          athleteId: payload.sharedAthleteId ?? null,
          weekStartYMD: payload.weekStartYMD,
          keyExistsOnObject: Object.prototype.hasOwnProperty.call(payload, "systemKey"),
          keyValidAfterClientNormalize: isPublishableSystemKey(payload.systemKey),
          clientPublishNormalizerRemovedKey: null,
          workerParserRemoved: null,
          source: "KidDetailScreen_onPublishWeeklyToFamilies_payload",
          latestEntryRawSystemKey:
            typeof latestEntry.systemKey === "string" ? latestEntry.systemKey : null,
        });
      }
      console.log("PUBLISH DEBUG", {
        kidId,
        sharedAthleteId,
        payload,
      });
      await coachSyncPublishWeekly(ws.linkToken, writerSecret, payload, ws.apiBaseUrl);
      console.log("[WEEKLY_PUBLISH]", {
        sharedAthleteId,
        coachId: chosen.coachId,
      });
      const publishedAt = new Date().toISOString();
      const publishedWeekly: SyncedWeeklyMessagePayload = {
        weekStartYMD: payload.weekStartYMD,
        ...(payload.systemKey ? { systemKey: payload.systemKey } : {}),
        headline: payload.headline,
        body: payload.body,
        updatedAt: publishedAt,
        ...(payload.classLine ? { classLine: payload.classLine } : {}),
        ...(payload.programLine ? { programLine: payload.programLine } : {}),
        ...(payload.missionResourceUrl
          ? { missionResourceUrl: payload.missionResourceUrl }
          : {}),
        ...(payload.missionResourceLabel
          ? { missionResourceLabel: payload.missionResourceLabel }
          : {}),
        ...(payload.familyResourceUrl
          ? { familyResourceUrl: payload.familyResourceUrl }
          : {}),
        ...(payload.familyResourceLabel
          ? { familyResourceLabel: payload.familyResourceLabel }
          : {}),
        ...(typeof payload.familyCoachRecapNote === "string"
          ? { familyCoachRecapNote: payload.familyCoachRecapNote }
          : {}),
        ...(payload.coachOutcome ? { coachOutcome: payload.coachOutcome } : {}),
        parentFeedback: {},
      };
      if (__DEV__) {
        console.log("[KID_DETAIL_ACK_GATE]", {
          weeklyAcknowledged: false,
          acknowledgedAt: null,
          updatedAt: publishedAt,
          headlineSlice: payload.headline?.slice(0, 120) ?? null,
          systemKey: payload.systemKey ?? null,
          weekStartYMD: payload.weekStartYMD,
          hadPriorFeedback: Boolean(
            publishedWeeklyFeedback?.acknowledgedAt || publishedWeeklyFeedback?.viewedAt,
          ),
        });
      }
      try {
        const cached = await getCachedWeeklyForLinkToken(ws.linkToken);
        const nextWeeklyByAthleteId = { ...(cached?.weeklyByAthleteId ?? {}) };
        const nextWeekly = sharedAthleteId ? cached?.weekly ?? null : publishedWeekly;
        if (sharedAthleteId) {
          nextWeeklyByAthleteId[sharedAthleteId] = publishedWeekly;
        }
        const cachedSession = cached?.session
          ? {
              ...cached.session,
              weekly: nextWeekly,
              weeklyByAthleteId: nextWeeklyByAthleteId,
            }
          : undefined;
        await setCachedWeeklyForLinkToken(
          ws.linkToken,
          nextWeekly,
          publishedAt,
          nextWeeklyByAthleteId,
          cached?.athletes,
          cachedSession,
          cached?.tokenNorm,
        );
      } catch {
        // Publishing already succeeded; feedback reset is best-effort local cache hygiene.
      }
      setPublishedWeeklyFeedback({});
      Alert.alert(
        "Published to families",
        "Families see the shared weekly note for this invite. Private check-ins stay coach-only. Ask them to open Read together on This week together or pull to refresh on their linked phone.",
      );
    } catch (e) {
      const msg =
        e instanceof CoachWeeklySyncApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Publish failed.";
      Alert.alert("Could not publish", msg);
    } finally {
      setPublishingWeekly(false);
    }
  }, [kidId, weekStartYMD]);

  const requestDeleteSession = useCallback(
    (sessionId: string) => {
      Alert.alert("Delete session?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteSessionById(sessionId);
            await load();
          },
        },
      ]);
    },
    [load],
  );

  const requestArchiveAthleteFromCoachRoster = useCallback(() => {
    if (!isCoachKidDetail || !kidId) return;
    const label = kidName.trim() || "This athlete";
    Alert.alert(
      "Remove from roster?",
      `${label} will disappear from your active coach roster on this device. Sessions, competitions, and notes are kept locally. Weekly co-publishing stops showing this athlete in coach views; it does not delete the family’s linked athlete on the server.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove from roster",
          style: "destructive",
          onPress: () =>
            void (async () => {
              const next = await archiveKidForCoachRoster(kidId);
              if (!next) {
                Alert.alert("Could not remove", "Try again from the roster.");
                return;
              }
              clearActiveKidId();
              router.replace("/coach");
            })(),
        },
      ],
    );
  }, [isCoachKidDetail, kidId, kidName]);

  return (
    <>
      <Stack.Screen options={{ title: "Athlete" }} />
      <ReadTogetherStoryModal
        visible={readTogetherPreviewOpen}
        onRequestClose={closeReadTogetherPreview}
        safeAreaTop={insets.top}
        safeAreaBottom={insets.bottom}
        stepIndex={readTogetherPreviewStep}
        cards={readTogetherPreviewCards}
        onStepBack={() => setReadTogetherPreviewStep((s) => Math.max(0, s - 1))}
        onStepNext={() =>
          setReadTogetherPreviewStep((s) => {
            const max = Math.max(0, readTogetherPreviewCards.length - 1);
            return Math.min(max, s + 1);
          })
        }
        onFinished={closeReadTogetherPreview}
        onOpenPublishedUrl={(url) => void openHttpsUrl(url)}
        primaryFill={UI.publishAccent}
        primaryFillPressed={UI.publishAccentPressed}
        accentBorder={UI.familyLaneBorder}
        accentBg="#ecfdf5"
        accentBgPressed="#d1fae5"
      />
      <KeyboardAwareScrollView
        ref={keyboardAwareRef}
        enableOnAndroid
        enableAutomaticScroll
        enableResetScrollToCoords={false}
        keyboardOpeningTime={120}
        viewIsInsideTabBar
        extraHeight={headerHeight + 24}
        extraScrollHeight={Math.max(300, insets.bottom + 150)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        style={{ flex: 1, backgroundColor: UI.screenBg }}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 280,
        }}
      >
        <Pressable
          onPress={() => {
            if (isCoachKidDetail) {
              router.replace("/coach");
            } else if (isThisWeekKidDetail) {
              router.replace("/this-week/kids");
            } else {
              router.back();
            }
          }}
          style={({ pressed }) => ({
            marginBottom: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
            alignSelf: "flex-start",
          })}
        >
          <Text style={{ fontSize: 14, color: UI.textPrimary }}>
            {isCoachKidDetail ? "Back to Coach" : "Back to Kids"}
          </Text>
        </Pressable>

        {!isThisWeekKidDetail ? (
          <View style={{ gap: 5 }}>
            <Text
              style={{
                fontSize: 11,
                letterSpacing: 0.9,
                fontWeight: "900",
                color: UI.textSecondary,
                textTransform: "uppercase",
              }}
            >
              Coach workspace
            </Text>
            <Text style={{ fontSize: 24, fontWeight: "900", color: UI.textPrimary, lineHeight: 29 }}>
              {kidName}
            </Text>
            <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
              Current tendencies, intended evolution, and family reinforcement.
            </Text>
          </View>
        ) : (
          <>
            <Text style={{ fontSize: 22, fontWeight: "800", color: UI.textPrimary, marginBottom: 6 }}>
              {kidName}
            </Text>
            <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
              This athlete's detail lives in This Week. Notes you keep here stay on your device. The green
              section is what you can share when you publish to your coach's linked invite.
            </Text>
          </>
        )}

        <View style={{ height: 12 }} />

        {false ? (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
            gap: 8,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              letterSpacing: 0.5,
              fontWeight: "700",
              color: UI.textSecondary,
            }}
          >
            Roster · Household
          </Text>
          <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 16 }}>
            {isThisWeekKidDetail
              ? "Groups this athlete in your list for your own organization only."
              : "Groups this athlete on your roster view only — does not change coaching data."}
          </Text>
          <TextInput
            value={householdDraft}
            onChangeText={(t) => {
              setHouseholdSavedAck(false);
              setHouseholdDraft(t);
            }}
            placeholder="No household"
            placeholderTextColor={UI.textSecondary}
            autoCapitalize="words"
            editable={ready}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.rowMutedBg,
              color: UI.textPrimary,
            }}
          />
          <Pressable
            disabled={!ready || savingHousehold || !householdDirty}
            onPress={() => void onSaveHousehold()}
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
              opacity: !ready || savingHousehold || !householdDirty ? 0.55 : 1,
            })}
          >
            <Text style={{ fontSize: 13, color: UI.textPrimary, fontWeight: "800" }}>
              {savingHousehold
                ? "Saving…"
                : householdSavedAck && !householdDirty
                  ? "Saved"
                  : "Save household"}
            </Text>
          </Pressable>
        </View>
        ) : null}

        <View style={{ height: 16 }} />

        <View
          style={{
            display: "none",
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: UI.familyLaneBorder,
            backgroundColor: UI.familyLaneBg,
            padding: 12,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: "#a7f3d0",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "800", color: "#065f46" }}>FAMILY / PUBLISH</Text>
            </View>
            <Text style={{ fontSize: 12, color: "#047857", flex: 1, minWidth: 140, lineHeight: 17 }}>
              Publishing updates the shared weekly note for this invite. Private check-ins stay coach-only.
            </Text>
          </View>

          <View
            style={{
              padding: 12,
              borderRadius: CARD_RADIUS,
              borderWidth: 1,
              borderColor: UI.familyLaneBorder,
              backgroundColor: "#d1fae5",
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text
                style={{
                  fontSize: 12,
                  letterSpacing: 0.4,
                  fontWeight: "800",
                  color: "#065f46",
                  flex: 1,
                  minWidth: 140,
                }}
              >
                Shared family note
              </Text>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor:
                    feedbackStatus === "acknowledged"
                      ? "#d1fae5"
                      : feedbackStatus === "viewed"
                        ? "#ecfdf5"
                        : "#f3f4f6",
                  borderWidth: 1,
                  borderColor:
                    feedbackStatus === "acknowledged"
                      ? UI.familyLaneBorder
                      : feedbackStatus === "viewed"
                        ? "#bbf7d0"
                        : UI.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "800",
                    color:
                      feedbackStatus === "acknowledged"
                        ? "#047857"
                        : feedbackStatus === "viewed"
                          ? "#065f46"
                          : UI.textSecondary,
                    includeFontPadding: false,
                  }}
                >
                  {feedbackStatusLabel}
                </Text>
              </View>
            </View>
            {familyHuddleSourceMapRows.map((row, index) => (
              <View key={`${row.heading}-${index}`} style={{ gap: 4 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: "800",
                      color: UI.textPrimary,
                    }}
                    numberOfLines={2}
                  >
                    {row.heading}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 999,
                      backgroundColor: "#ecfdf5",
                      borderWidth: 1,
                      borderColor: UI.familyLaneBorder,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "800",
                        color: "#047857",
                        includeFontPadding: false,
                      }}
                    >
                      {row.badge}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 15 }} numberOfLines={3}>
                  {row.status}
                </Text>
              </View>
            ))}
          </View>

          <WeeklySuggestionCard
            suggestionText={suggestion.message}
            visible={showSuggestion}
            onUse={handleUseSuggestion}
            onEdit={handleEdit}
          />

          <View
            style={{
              padding: 12,
              borderRadius: CARD_RADIUS,
              borderWidth: 1,
              borderColor: UI.familyLaneBorder,
              backgroundColor: "#ecfdf5",
              gap: 8,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                letterSpacing: 0.4,
                fontWeight: "800",
                color: "#065f46",
              }}
            >
              Why this matters
            </Text>
            <TextInput
              value={weeklyWhyThisMatters}
              onChangeText={(text) => {
                setWeeklyWhyThisMatters(text);
                setHasUserEditedWeekly(true);
              }}
              onFocus={handleEdit}
              placeholder="Add a parent-facing weekly note"
              placeholderTextColor={UI.textSecondary}
              multiline
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.familyLaneBorder,
                backgroundColor: UI.bgCard,
                color: UI.textPrimary,
                minHeight: 80,
                padding: 12,
                textAlignVertical: "top",
              }}
            />
          </View>

          <View
            style={{
              padding: 16,
              borderRadius: CARD_RADIUS,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 13, letterSpacing: 0.3, fontWeight: "800", color: UI.textPrimary }}>
              Weekly focus
            </Text>
            {recommendedFocusArea ? (
              <View style={{ gap: 10 }}>
                <Text
                  style={{
                    fontSize: 11,
                    color: UI.textSecondary,
                    lineHeight: 16,
                    fontStyle: "italic",
                  }}
                >
                  Suggested focus from recent competitions:{" "}
                  <Text style={{ fontStyle: "normal", fontWeight: "700", color: UI.textSecondary }}>
                    {recommendedFocusArea}
                  </Text>
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Pressable
                    onPress={handleUseRecommendedFocusArea}
                    style={({ pressed }) => ({
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: UI.familyLaneBorder,
                      backgroundColor: pressed ? "#d1fae5" : "#ecfdf5",
                    })}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#065f46" }}>
                      Use suggested focus
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={openSuggestedFocusModal}
                    style={({ pressed }) => ({
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: UI.coachLaneBorder,
                      backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
                    })}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "800", color: UI.textPrimary }}>
                      Edit focus
                    </Text>
                  </Pressable>
                </View>
                <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 15 }}>
                  Inserts copy into Why this matters above—you save when ready; nothing publishes on its own.
                </Text>
              </View>
            ) : null}
            {lastCompetitionWeekly ? (
              <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 17 }}>
                Based on last competition
                {typeof lastCompetitionWeekly!.lastCompetitionResult !== "undefined"
                  ? ` · ${getPlacementLabel(lastCompetitionWeekly!.lastCompetitionResult)}`
                  : ""}
                {lastCompetitionWeekly!.lastCompetitionName
                  ? ` · ${lastCompetitionWeekly!.lastCompetitionName}`
                  : ""}
                {lastCompetitionWeekly!.lastCompetitionMatchSummary
                  ? ` · ${lastCompetitionWeekly!.lastCompetitionMatchSummary}`
                  : ""}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: UI.textPrimary, flex: 1, minWidth: 0 }}>
                {focusTitle ?? "No focus saved yet"}
              </Text>
              {focusTitle && currentWeekEntry && isUsableYoutubeUrl(currentWeekEntry.youtubeUrl) ? (
                <Pressable
                  onPress={() => void openYoutubeUrl(currentWeekEntry!.youtubeUrl)}
                  style={({ pressed }) => ({
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: UI.border,
                    backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
                  })}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: UI.textPrimary }}>
                    YT video
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {focusTitle && currentWeekEntry?.youtubeUrl?.trim() ? (
              <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 15 }}>
                Reference link — coach only, not published.
              </Text>
            ) : null}

            {focusTitle && currentWeekEntry?.familyResourceUrl?.trim() ? (
              <Pressable
                onPress={() => void openHttpsUrl(currentWeekEntry!.familyResourceUrl!)}
                style={({ pressed }) => ({
                  alignSelf: "flex-start",
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: UI.familyLaneBorder,
                  backgroundColor: pressed ? "#d1fae5" : "#ecfdf5",
                })}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#065f46" }}>
                  {(() => {
                    const n = familyResourceUrlForLinking(currentWeekEntry!.familyResourceUrl!);
                    const primary =
                      n != null
                        ? defaultFamilyLinkButtonLabel(n, currentWeekEntry!.familyResourceLabel)
                        : (currentWeekEntry!.familyResourceLabel ?? "").trim() || "Family link";
                    return `${primary} · open`;
                  })()}
                </Text>
                <Text
                  style={{ marginTop: 2, fontSize: 11, color: UI.textSecondary }}
                  numberOfLines={1}
                >
                  {familyResourceUrlForLinking(currentWeekEntry!.familyResourceUrl!) ??
                    currentWeekEntry!.familyResourceUrl!.trim()}
                </Text>
              </Pressable>
            ) : null}

            {focusTitle ? (
              <Text style={{ fontSize: 12, color: UI.textSecondary }}>
                Week of <Text style={{ fontWeight: "700" }}>{weekStartYMD}</Text>
              </Text>
            ) : (
              <Text style={{ fontSize: 12, color: UI.textSecondary }}>
                Edit weekly focus, then publish.
              </Text>
            )}

            <Pressable
              onPress={() =>
                currentWeekEntry
                  ? router.push(
                      `${kidLaneBase}/weekly-focus?entryId=${encodeURIComponent(currentWeekEntry.id)}` as Href,
                    )
                  : router.push(`${kidLaneBase}/weekly-focus` as Href)
              }
              style={({ pressed }) => ({
                marginTop: 6,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#1d4ed8",
                backgroundColor: pressed ? "#1e40af" : "#1d4ed8",
                alignSelf: "stretch",
              })}
            >
              <Text style={{ fontSize: 14, color: "#ffffff", fontWeight: "800", textAlign: "center" }}>
                {currentWeekEntry ? "Edit weekly focus & family link" : "Set this week's focus"}
              </Text>
            </Pressable>

            <Pressable
              disabled={!currentWeekEntry || publishingWeekly}
              onPress={() => void onPublishWeeklyToFamilies()}
              style={({ pressed }) => ({
                marginTop: 10,
                paddingVertical: 14,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: UI.publishAccent,
                backgroundColor: pressed ? UI.publishAccentPressed : UI.publishAccent,
                alignSelf: "stretch",
                opacity: !currentWeekEntry || publishingWeekly ? 0.55 : 1,
              })}
            >
              <Text style={{ fontSize: 15, color: "#ffffff", fontWeight: "900", textAlign: "center" }}>
                {publishingWeekly ? "Publishing…" : "Publish to family phones"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setReadTogetherPreviewStep(0);
                setReadTogetherPreviewOpen(true);
              }}
              disabled={!currentWeekEntry}
              style={({ pressed }) => ({
                marginTop: 8,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.familyLaneBorder,
                backgroundColor: pressed ? "#d1fae5" : "#ecfdf5",
                alignSelf: "stretch",
                opacity: !currentWeekEntry ? 0.5 : 1,
              })}
            >
              <Text style={{ fontSize: 14, color: "#065f46", fontWeight: "800", textAlign: "center" }}>
                Preview Family Huddle
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push(`${kidLaneBase}/history` as Href)}
              style={({ pressed }) => ({
                paddingVertical: 4,
                alignSelf: "flex-start",
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Text style={{ fontSize: 12, color: UI.textSecondary, fontWeight: "600" }}>History</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: 16 }} />

        <View
          style={{
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: "#d8e0ea",
            backgroundColor: "#f5f7fa",
            padding: 14,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: "#e5e7eb",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "800", color: "#1f2937" }}>COACH ONLY</Text>
            </View>
            <Text style={{ fontSize: 12, color: UI.textSecondary, flex: 1, minWidth: 140, lineHeight: 17 }}>
              Current tendency, intended evolution, and coach memory.
            </Text>
          </View>

          <View
          style={{
              paddingVertical: 20,
              paddingHorizontal: 16,
              borderRadius: CARD_RADIUS,
              borderWidth: 1,
              borderColor: "#d5deea",
              backgroundColor: "#ffffff",
              gap: 13,
            }}
          >
            <View style={{ gap: 3 }}>
              <Text
                style={{
                  fontSize: 11,
                  letterSpacing: 1,
                  fontWeight: "800",
                  color: "#334155",
                  textTransform: "uppercase",
              }}
            >
                Direction of growth
              </Text>
              <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 17 }}>
                The shift you keep shaping through class, rounds, and competition.
              </Text>
            </View>
            {standingIsActive ? (
              <Text style={{ fontSize: 17, fontWeight: "800", color: UI.textPrimary, lineHeight: 23 }}>
                {standingPrimary}
              </Text>
            ) : (
              <Text style={{ fontSize: 15, color: UI.textSecondary, lineHeight: 22, fontWeight: "700" }}>
                Name what they are now and where you are guiding them next.
              </Text>
            )}
            {standingSecondaryMuted ? (
              <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 19 }}>
                {standingSecondaryMuted}
              </Text>
            ) : null}
            <Pressable
              onPress={() =>
                router.push(`${kidLaneBase}/what-matters-next` as Href)
              }
              style={({ pressed }) => ({
                marginTop: 1,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#cbd5e1",
                backgroundColor: pressed ? "#eef2f6" : "#ffffff",
                alignSelf: "flex-start",
              })}
            >
              <Text style={{ fontSize: 14, color: UI.textPrimary, fontWeight: "800" }}>Review guidance</Text>
            </Pressable>
          </View>

        <View
          style={{
            marginTop: 2,
            gap: 0,
          }}
        >
        <View
          style={{
            paddingVertical: 20,
            paddingHorizontal: 16,
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: "#d8e0ea",
            backgroundColor: "#ffffff",
            gap: 13,
            opacity: canEditOutcome ? 1 : 0.65,
          }}
        >
          <View style={{ gap: 3 }}>
            <Text
              style={{
                fontSize: 11,
                letterSpacing: 1,
                fontWeight: "800",
                color: "#334155",
                textTransform: "uppercase",
              }}
            >
              Behavior under pressure
            </Text>
            <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 17 }}>
              Notice what stays with them when pace rises, grips tighten, or rounds get messy.
            </Text>
          </View>

          {!canEditOutcome ? (
            <Text style={{ fontSize: 13, color: UI.textSecondary }}>
              {"Set this week's focus first to notice behavior under real resistance."}
            </Text>
          ) : (
            <>
              <Text style={{ fontSize: 12, color: UI.textSecondary, fontWeight: "700" }}>
                What is practiced shows up
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["not_yet", "sometimes", "yes"] as const).map((o) => {
                  const active = sparringDraft === o;
                  return (
                    <Pressable
                      key={o}
                      disabled={!canEditOutcome || savingOutcome}
                      onPress={() => setSparringDraft(o)}
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: active ? "#1d4ed8" : UI.border,
                        backgroundColor: active ? "#edf2ff" : UI.bgCard,
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <Text
                        style={{
                          textAlign: "center",
                          fontSize: 12,
                          color: UI.textPrimary,
                          fontWeight: active ? "800" : "700",
                        }}
                      >
                        {sparringApplicationLabel(o)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={{ marginTop: 4, fontSize: 12, color: UI.textSecondary, lineHeight: 17 }}>
                Capture commitment, hesitation, composure, or old habits as they show up.
              </Text>

              <TextInput
                key={progressNotesInputKey}
                value={notesDraft}
                scrollEnabled={false}
                onChangeText={setNotesDraft}
                onFocus={bumpScrollToFocusedInput}
                onContentSizeChange={bumpScrollToFocusedInput}
                placeholder="Add what you saw on the mat"
                placeholderTextColor={UI.textSecondary}
                multiline
                style={{
                  marginTop: 6,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: UI.bgCard,
                  padding: 12,
                  minHeight: 92,
                  color: UI.textPrimary,
                  textAlignVertical: "top",
                }}
              />

              <Pressable
                disabled={savingOutcome}
                onPress={() => void onSaveOutcome()}
                style={({ pressed }) => ({
                  marginTop: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#1d4ed8",
                  backgroundColor: pressed ? "#1d4ed8" : "#1d4ed8",
                  opacity: savingOutcome ? 0.6 : 1,
                  alignSelf: "flex-start",
                })}
              >
                <Text style={{ fontSize: 14, color: "#ffffff", fontWeight: "800" }}>
                  Carry forward
                </Text>
              </Pressable>
            </>
          )}

          <View style={{ marginTop: 14, gap: 10 }}>
            <Text style={{ fontSize: 11, letterSpacing: 0.5, fontWeight: "800", color: UI.textSecondary }}>
              Kept patterns
            </Text>

            {thisWeekReflections.length === 0 ? (
              <Text style={{ fontSize: 13, color: UI.textSecondary }}>
                No patterns carried forward yet.
              </Text>
            ) : (
              <>
                {thisWeekReflections.slice(0, 3).map((r) => {
                  const outcomeText =
                    typeof r.coachOutcome !== "undefined" ? outcomeLabel(r.coachOutcome) : null;
                  const notesText = (r.coachNotes ?? "").trim();
                  return (
                    <Swipeable
                      key={r.id}
                      friction={1.1}
                      rightThreshold={24}
                      overshootRight
                      dragOffsetFromRightEdge={10}
                      renderRightActions={() => (
                        <Pressable
                          onPress={() => requestDeleteReflection(r.id)}
                          accessibilityLabel="Delete check-in"
                          style={({ pressed }) => ({
                            justifyContent: "center",
                            backgroundColor: pressed ? "#b91c1c" : UI.danger,
                            borderRadius: 12,
                            marginLeft: 8,
                            paddingHorizontal: 20,
                          })}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "800", color: "#ffffff" }}>Delete</Text>
                        </Pressable>
                      )}
                    >
                      <Pressable
                        onPress={() =>
                          router.push(
                            `${kidLaneBase}/progress-reflection?entryId=${encodeURIComponent(r.id)}` as Href,
                          )
                        }
                        style={({ pressed }) => ({
                          alignSelf: "stretch",
                          paddingVertical: 11,
                          paddingHorizontal: 12,
                          gap: 5,
                          backgroundColor: pressed ? "#eef2ff" : "#f8fafc",
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: UI.border,
                          overflow: "hidden",
                        })}
                      >
                        <Text style={{ fontSize: 10, color: UI.textSecondary, fontWeight: "700" }} numberOfLines={1}>
                          {new Date(r.createdAt).toLocaleString()}
                        </Text>
                        {outcomeText ? (
                          <Text style={{ fontSize: 12, color: UI.textPrimary, fontWeight: "800" }}>{outcomeText}</Text>
                        ) : null}
                        {notesText ? (
                          <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 17 }} numberOfLines={2}>
                            {notesText}
                          </Text>
                        ) : null}
                        {!outcomeText && !notesText ? (
                          <Text style={{ fontSize: 12, color: UI.textSecondary }}>(no pattern text)</Text>
                        ) : null}
                      </Pressable>
                    </Swipeable>
                  );
                })}
                {thisWeekReflections.length > 3 ? (
                  <Pressable
                    onPress={() => router.push(`${kidLaneBase}/history` as Href)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1, alignSelf: "flex-start" })}
                  >
                    <Text style={{ fontSize: 12, color: UI.textSecondary, fontWeight: "600" }}>
                      +{thisWeekReflections.length - 3} more carried forward
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        </View>
        </View>

        </View>

        <View style={{ height: 16 }} />

        {true ? (
        <View
          style={{
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: "rgba(16, 185, 129, 0.24)",
            backgroundColor: "#f7faf8",
            padding: 12,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: "#dff7e8",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "800", color: "#166534" }}>PARENT REINFORCEMENT</Text>
            </View>
            <Text style={{ fontSize: 12, color: "#47705c", flex: 1, minWidth: 140, lineHeight: 17 }}>
              Family support for the direction you are helping this athlete grow toward.
            </Text>
          </View>

          <View
            style={{
              padding: 12,
              borderRadius: CARD_RADIUS,
              borderWidth: 1,
              borderColor: "rgba(16, 185, 129, 0.2)",
              backgroundColor: "#edf8f1",
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text
                style={{
                  fontSize: 12,
                  letterSpacing: 0.4,
                  fontWeight: "800",
                  color: "#166534",
                  flex: 1,
                  minWidth: 140,
                }}
              >
                Family-facing framing
              </Text>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor:
                    feedbackStatus === "acknowledged"
                      ? "#d1fae5"
                      : feedbackStatus === "viewed"
                        ? "#ecfdf5"
                        : "#f3f4f6",
                  borderWidth: 1,
                  borderColor:
                    feedbackStatus === "acknowledged"
                      ? UI.familyLaneBorder
                      : feedbackStatus === "viewed"
                        ? "#bbf7d0"
                        : UI.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "800",
                    color:
                      feedbackStatus === "acknowledged"
                        ? "#047857"
                        : feedbackStatus === "viewed"
                          ? "#065f46"
                          : UI.textSecondary,
                    includeFontPadding: false,
                  }}
                >
                  {feedbackStatusLabel}
                </Text>
              </View>
            </View>
            {familyHuddleSourceMapRows.map((row, index) => (
              <View key={`${row.heading}-${index}`} style={{ gap: 4 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: "800",
                      color: UI.textPrimary,
                    }}
                    numberOfLines={2}
                  >
                    {row.heading}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 999,
                      backgroundColor: "#ecfdf5",
                      borderWidth: 1,
                      borderColor: UI.familyLaneBorder,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "800",
                        color: "#047857",
                        includeFontPadding: false,
                      }}
                    >
                      {row.badge}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 15 }} numberOfLines={3}>
                  {row.status}
                </Text>
              </View>
            ))}
          </View>

          <WeeklySuggestionCard
            suggestionText={suggestion.message}
            visible={showSuggestion}
            onUse={handleUseSuggestion}
            onEdit={handleEdit}
          />

          <View
            style={{
              padding: 12,
              borderRadius: CARD_RADIUS,
              borderWidth: 1,
              borderColor: "rgba(16, 185, 129, 0.2)",
              backgroundColor: "#f2fbf5",
              gap: 8,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                letterSpacing: 0.4,
                fontWeight: "800",
                color: "#166534",
              }}
            >
              At-home reinforcement
            </Text>
            <TextInput
              value={weeklyWhyThisMatters}
              onChangeText={(text) => {
                setWeeklyWhyThisMatters(text);
                setHasUserEditedWeekly(true);
              }}
              onFocus={handleEdit}
              placeholder="Add parent-friendly context for the direction of growth"
              placeholderTextColor={UI.textSecondary}
              multiline
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.familyLaneBorder,
                backgroundColor: UI.bgCard,
                color: UI.textPrimary,
                minHeight: 80,
                padding: 12,
                textAlignVertical: "top",
              }}
            />
          </View>

          <View
            style={{
              padding: 16,
              borderRadius: CARD_RADIUS,
              borderWidth: 1,
              borderColor: "#e2e8f0",
              backgroundColor: "#ffffff",
              gap: 9,
            }}
          >
            <Text style={{ fontSize: 13, letterSpacing: 0.3, fontWeight: "800", color: UI.textPrimary }}>
              This week's evolution cycle
            </Text>
            <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
              Weekly support for the behavior you want to become more natural.
            </Text>
            {recommendedFocusArea ? (
              <View style={{ gap: 10 }}>
                <Text
                  style={{
                    fontSize: 11,
                    color: UI.textSecondary,
                    lineHeight: 16,
                    fontStyle: "italic",
                  }}
                >
                  Suggested focus from recent competitions:{" "}
                  <Text style={{ fontStyle: "normal", fontWeight: "700", color: UI.textSecondary }}>
                    {recommendedFocusArea}
                  </Text>
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Pressable
                    onPress={handleUseRecommendedFocusArea}
                    style={({ pressed }) => ({
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: "rgba(16, 185, 129, 0.28)",
                      backgroundColor: pressed ? "#dff7e8" : "#f2fbf5",
                    })}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#065f46" }}>
                      Use suggested focus
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={openSuggestedFocusModal}
                    style={({ pressed }) => ({
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: UI.coachLaneBorder,
                      backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
                    })}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "800", color: UI.textPrimary }}>
                      Edit focus
                    </Text>
                  </Pressable>
                </View>
                <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 15 }}>
                  Moves this wording into the reinforcement note above; nothing sends until you choose it.
                </Text>
              </View>
            ) : null}
            {lastCompetitionWeekly ? (
              <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 17 }}>
                Based on last competition
                {typeof lastCompetitionWeekly!.lastCompetitionResult !== "undefined"
                  ? ` · ${getPlacementLabel(lastCompetitionWeekly!.lastCompetitionResult)}`
                  : ""}
                {lastCompetitionWeekly!.lastCompetitionName
                  ? ` · ${lastCompetitionWeekly!.lastCompetitionName}`
                  : ""}
                {lastCompetitionWeekly!.lastCompetitionMatchSummary
                  ? ` · ${lastCompetitionWeekly!.lastCompetitionMatchSummary}`
                  : ""}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: UI.textPrimary, flex: 1, minWidth: 0 }}>
                {focusTitle ?? "No focus saved yet"}
              </Text>
              {focusTitle && currentWeekEntry && isUsableYoutubeUrl(currentWeekEntry!.youtubeUrl) ? (
                <Pressable
                  onPress={() => void openYoutubeUrl(currentWeekEntry!.youtubeUrl)}
                  style={({ pressed }) => ({
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: UI.border,
                    backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
                  })}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: UI.textPrimary }}>
                    YT video
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {focusTitle && currentWeekEntry?.youtubeUrl?.trim() ? (
              <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 15 }}>
                Reference link — coach only, not published.
              </Text>
            ) : null}

            {focusTitle && currentWeekEntry?.familyResourceUrl?.trim() ? (
              <Pressable
                onPress={() => void openHttpsUrl(currentWeekEntry!.familyResourceUrl!)}
                style={({ pressed }) => ({
                  alignSelf: "flex-start",
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "rgba(16, 185, 129, 0.28)",
                  backgroundColor: pressed ? "#dff7e8" : "#f2fbf5",
                })}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#065f46" }}>
                  {(() => {
                    const n = familyResourceUrlForLinking(currentWeekEntry!.familyResourceUrl!);
                    const primary =
                      n != null
                        ? defaultFamilyLinkButtonLabel(n ?? "", currentWeekEntry!.familyResourceLabel)
                        : (currentWeekEntry!.familyResourceLabel ?? "").trim() || "Family link";
                    return `${primary} · open`;
                  })()}
                </Text>
                <Text
                  style={{ marginTop: 2, fontSize: 11, color: UI.textSecondary }}
                  numberOfLines={1}
                >
                  {familyResourceUrlForLinking(currentWeekEntry!.familyResourceUrl!) ??
                    currentWeekEntry!.familyResourceUrl!.trim()}
                </Text>
              </Pressable>
            ) : null}

            {focusTitle ? (
              <Text style={{ fontSize: 12, color: UI.textSecondary }}>
                Week of <Text style={{ fontWeight: "700" }}>{weekStartYMD}</Text>
              </Text>
            ) : (
              <Text style={{ fontSize: 12, color: UI.textSecondary }}>
                Edit weekly focus, then publish.
              </Text>
            )}

            <Pressable
              onPress={() =>
                currentWeekEntry
                  ? router.push(
                      `${kidLaneBase}/weekly-focus?entryId=${encodeURIComponent(currentWeekEntry.id)}` as Href,
                    )
                  : router.push(`${kidLaneBase}/weekly-focus` as Href)
              }
              style={({ pressed }) => ({
                marginTop: 6,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#1d4ed8",
                backgroundColor: pressed ? "#1e40af" : "#1d4ed8",
                alignSelf: "stretch",
              })}
            >
              <Text style={{ fontSize: 14, color: "#ffffff", fontWeight: "800", textAlign: "center" }}>
                {currentWeekEntry ? "Edit weekly focus & family link" : "Set this week's focus"}
              </Text>
            </Pressable>

            <Pressable
              disabled={!currentWeekEntry || publishingWeekly}
              onPress={() => void onPublishWeeklyToFamilies()}
              style={({ pressed }) => ({
                marginTop: 10,
                paddingVertical: 14,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.publishAccent,
                backgroundColor: pressed ? UI.publishAccentPressed : UI.publishAccent,
                alignSelf: "stretch",
                opacity: !currentWeekEntry || publishingWeekly ? 0.55 : 1,
              })}
            >
              <Text style={{ fontSize: 15, color: "#ffffff", fontWeight: "900", textAlign: "center" }}>
                {publishingWeekly ? "Publishing…" : "Publish to family phones"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setReadTogetherPreviewStep(0);
                setReadTogetherPreviewOpen(true);
              }}
              disabled={!currentWeekEntry}
              style={({ pressed }) => ({
                marginTop: 8,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.familyLaneBorder,
                backgroundColor: pressed ? "#d1fae5" : "#ecfdf5",
                alignSelf: "stretch",
                opacity: !currentWeekEntry ? 0.5 : 1,
              })}
            >
              <Text style={{ fontSize: 14, color: "#065f46", fontWeight: "800", textAlign: "center" }}>
                Preview Family Huddle
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push(`${kidLaneBase}/history` as Href)}
              style={({ pressed }) => ({
                paddingVertical: 4,
                alignSelf: "flex-start",
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Text style={{ fontSize: 12, color: UI.textSecondary, fontWeight: "600" }}>History</Text>
            </Pressable>
          </View>
        </View>
        ) : null}

        {false ? (
        <>
          <View style={{ height: 16 }} />

          <Text style={{ fontSize: 15, fontWeight: "800", color: UI.textPrimary, marginBottom: 4 }}>
            This week in action
          </Text>

          <View
          style={{
            padding: 14,
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "700", color: UI.textSecondary }}>
              {"This week's training"}
            </Text>
            <Text style={{ fontSize: 12, color: UI.textSecondary, fontWeight: "600" }}>
              {kidWeekSessions.length} logged
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable
              onPress={() =>
                router.push(
                  `/training?date=${encodeURIComponent(todayYMD())}&kidId=${encodeURIComponent(kidId)}`,
                )
              }
              style={({ pressed }) => ({
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
              })}
            >
              <Text style={{ fontSize: 13, color: UI.textPrimary, fontWeight: "800" }}>Log session</Text>
            </Pressable>
            {kidWeekSessions.length > 0 ? (
              <Pressable
                onPress={() =>
                  router.push(
                    `/training?date=${encodeURIComponent(weekStartYMD)}&kidId=${encodeURIComponent(kidId)}`,
                  )
                }
                style={({ pressed }) => ({
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: pressed ? "#f9fafb" : UI.rowMutedBg,
                })}
              >
                <Text style={{ fontSize: 13, color: UI.textSecondary, fontWeight: "700" }}>Open in Training</Text>
              </Pressable>
            ) : null}
          </View>

          {kidWeekSessions.length === 0 ? (
            <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 18 }}>
              None for this week yet.
            </Text>
          ) : (
            <View style={{ gap: 6 }}>
              {kidWeekSessions.slice(0, 3).map((s) => {
                const badges = sessionBadges(s);

                return (
                  <Swipeable
                    key={s.id}
                    friction={1.1}
                    rightThreshold={24}
                    overshootRight
                    dragOffsetFromRightEdge={10}
                    renderRightActions={() => (
                      <Pressable
                        onPress={() => requestDeleteSession(s.id)}
                        accessibilityLabel="Delete training session"
                        style={({ pressed }) => ({
                          justifyContent: "center",
                          backgroundColor: pressed ? "#b91c1c" : UI.danger,
                          borderRadius: 10,
                          marginLeft: 8,
                          paddingHorizontal: 10,
                        })}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "800", color: "#ffffff" }}>Delete</Text>
                      </Pressable>
                    )}
                  >
                    <Pressable
                      onPress={() =>
                        router.push(`/training/${s.id}?kidId=${encodeURIComponent(kidId)}`)
                      }
                      style={({ pressed }) => ({
                        alignSelf: "stretch",
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        gap: 4,
                        backgroundColor: pressed ? "#eef2ff" : UI.rowMutedBg,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: UI.border,
                        overflow: "hidden",
                      })}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "800", color: UI.textPrimary }} numberOfLines={1}>
                        {s.date} · {resolveSystemLabel(s.system)}
                      </Text>
                      <Text style={{ fontSize: 12, color: UI.textSecondary }} numberOfLines={1}>
                        {techniqueSummaryForKidSession(s)}
                      </Text>
                      {badges.length > 0 ? (
                        <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                          {badges.map((label) => (
                            <Pressable
                              key={label}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              onPress={(e) => {
                                e.stopPropagation?.();
                                (e as { preventDefault?: () => void }).preventDefault?.();

                                if (label === "YT") {
                                  void openYoutubeUrl(s.youtubeUrl);
                                  return;
                                }

                                if (label === "IMG") {
                                  const raw = (s.imageUri ?? "").trim();
                                  if (!raw) return;
                                  setMediaPreview({
                                    type: "image",
                                    uri: raw,
                                    assetId: s.imageAssetId ?? null,
                                  });
                                  return;
                                }

                                if (label === "VID") {
                                  const raw = (s.videoUri ?? "").trim();
                                  if (!raw) return;
                                  setMediaPreview({
                                    type: "video",
                                    uri: raw,
                                    assetId: s.videoAssetId ?? null,
                                  });
                                }
                              }}
                              style={({ pressed }) => ({
                                opacity: pressed ? 0.95 : 1,
                              })}
                            >
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
                                <Text style={{ color: UI.textSecondary, fontSize: 10, fontWeight: "700" }}>
                                  {label}
                                </Text>
                              </View>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </Pressable>
                  </Swipeable>
                );
              })}
              {kidWeekSessions.length > 3 ? (
                <Pressable
                  onPress={() =>
                    router.push(
                      `/training?date=${encodeURIComponent(weekStartYMD)}&kidId=${encodeURIComponent(kidId)}`,
                    )
                  }
                  style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1, alignSelf: "flex-start" })}
                >
                  <Text style={{ fontSize: 12, color: UI.textSecondary, fontWeight: "600" }}>
                    +{kidWeekSessions.length - 3} more in Training
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
          </View>
        </>
        ) : null}

        {false ? (
        <>
          <View style={{ height: 14 }} />

          <View
          style={{
            padding: 14,
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "700", color: UI.textSecondary }}>
            Competition
          </Text>
          <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 17 }}>
            Local tournament log · grouped by month.
          </Text>
          {headerRefreshing ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ActivityIndicator size="small" color={UI.textSecondary} />
              <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16, flex: 1 }}>
                Syncing shared entries from the parent invite (this can take a few seconds).
              </Text>
            </View>
          ) : null}
          {competitionHeaderRefreshLabel && !headerRefreshing ? (
            <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16, opacity: 0.92 }}>
              {competitionHeaderRefreshLabel}
            </Text>
          ) : null}

          <Pressable
            onPress={() => router.push(competitionEditBaseHref as Href)}
            style={({ pressed }) => ({
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
              alignSelf: "flex-start",
            })}
          >
            <Text style={{ fontSize: 13, color: UI.textPrimary, fontWeight: "800" }}>Add competition</Text>
          </Pressable>

          {ready && competitions.length === 0 ? (
            <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 18 }}>
              No entries yet — add name, date, and result when ready.
            </Text>
          ) : null}
          {ready && competitions.length > 0 ? (
            <View style={{ gap: 6 }}>
              {monthGroups.map(({ monthKey, entries }) => {
                const expanded = expandedMonths.has(monthKey);
                const chevron = expanded ? "▼" : "▶";
                return (
                  <View
                    key={monthKey}
                    style={{
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: UI.border,
                      overflow: "hidden",
                    }}
                  >
                    <Pressable
                      onPress={() => toggleMonth(monthKey)}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        paddingVertical: 10,
                        paddingHorizontal: 10,
                        backgroundColor: pressed ? UI.rowMutedBg : UI.bgCard,
                      })}
                    >
                      <Text style={{ fontSize: 13, color: UI.textSecondary, width: 20 }}>{chevron}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary }}>
                          {formatMonthHeading(monthKey)}
                        </Text>
                        <Text style={{ marginTop: 1, fontSize: 11, color: UI.textSecondary }}>
                          {entries.length} {entries.length === 1 ? "event" : "events"}
                        </Text>
                      </View>
                    </Pressable>

                    {expanded ? (
                      <View style={{ paddingHorizontal: 8, paddingBottom: 8, gap: 6 }}>
                        {entries.map((row) => {
                          const isSyncedRow = Boolean(row.sharedCompetitionId);
                          const competitionMeta = competitionMetaLine(row);
                          const compVideoRefs = coachCompetitionVideoRefsForRow(row);
                          return (
                          <Swipeable
                            key={row.id}
                            friction={1.1}
                            rightThreshold={24}
                            overshootRight
                            dragOffsetFromRightEdge={10}
                            enabled={!isSyncedRow}
                            renderRightActions={() => (
                              <Pressable
                                onPress={() => requestDeleteCompetition(row)}
                                accessibilityLabel="Delete competition entry"
                                style={({ pressed }) => ({
                                  justifyContent: "center",
                                  backgroundColor: pressed ? "#b91c1c" : UI.danger,
                                  borderRadius: 10,
                                  marginLeft: 8,
                                  paddingHorizontal: 10,
                                })}
                              >
                                <Text style={{ fontSize: 11, fontWeight: "800", color: "#ffffff" }}>Delete</Text>
                              </Pressable>
                            )}
                          >
                            <Pressable
                              disabled={isSyncedRow}
                              onPress={() => {
                                if (isSyncedRow) return;
                                router.push(
                                  `${competitionEditBaseHref}?entryId=${encodeURIComponent(row.id)}` as Href,
                                );
                              }}
                              style={({ pressed }) => ({
                                alignSelf: "stretch",
                                paddingVertical: 10,
                                paddingHorizontal: 10,
                                gap: 3,
                                backgroundColor: isSyncedRow ? "#f8fafc" : pressed ? "#eef2ff" : UI.rowMutedBg,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: UI.border,
                                overflow: "hidden",
                                opacity: isSyncedRow ? 0.95 : 1,
                              })}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: "800",
                                    color: UI.textPrimary,
                                    flex: 1,
                                    minWidth: 0,
                                  }}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {row.tournamentName}
                                </Text>
                                {compVideoRefs.length > 0 ? (
                                  <Pressable
                                    onPress={(e) => {
                                      e.stopPropagation?.();
                                      (e as { preventDefault?: () => void }).preventDefault?.();
                                      openCoachCompetitionVideos(row);
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  >
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
                                      <Text
                                        style={{
                                          color: UI.textSecondary,
                                          fontSize: 10,
                                          fontWeight: "700",
                                        }}
                                      >
                                        {compVideoRefs.length === 1
                                          ? "1 video"
                                          : `${compVideoRefs.length} videos`}
                                      </Text>
                                    </View>
                                  </Pressable>
                                ) : null}
                              </View>
                              <Text style={{ fontSize: 11, color: UI.textSecondary }}>
                                <Text style={{ fontWeight: "800", color: UI.textPrimary }}>
                                  {coachCompetitionRowStatusLabel(row, competitionListTodayYMD)}
                                </Text>
                                {" · "}
                                {row.eventDate}
                                {" · "}
                                {competitionResultLabel(row.result)}
                              </Text>
                              {isSyncedRow ? (
                                <Text style={{ fontSize: 10, color: UI.textSecondary }}>
                                  Synced from parent link (read-only here)
                                </Text>
                              ) : null}
                              {competitionMeta ? (
                                <Text
                                  style={{ fontSize: 10, color: UI.textSecondary, opacity: 0.95 }}
                                  numberOfLines={2}
                                >
                                  {competitionMeta}
                                </Text>
                              ) : null}
                              {row.coachNotes ? (
                                <Text style={{ fontSize: 11, color: UI.textSecondary }} numberOfLines={1}>
                                  {row.coachNotes}
                                </Text>
                              ) : null}
                            </Pressable>
                          </Swipeable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}
          </View>
        </>
        ) : null}

        {!ready ? (
          <Text style={{ marginTop: 14, fontSize: 13, color: UI.textSecondary }}>
            Loading…
          </Text>
        ) : null}

        <View
          style={{
            marginTop: 18,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "rgba(148, 163, 184, 0.22)",
            backgroundColor: "rgba(248, 250, 252, 0.62)",
            gap: householdUtilityExpanded ? 10 : 0,
          }}
        >
          <Pressable
            onPress={() => setHouseholdUtilityExpanded((value) => !value)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 11, letterSpacing: 0.5, fontWeight: "800", color: UI.textSecondary }}>
                Roster / Household
              </Text>
              <Text style={{ marginTop: 2, fontSize: 12, color: UI.textSecondary, lineHeight: 16 }}>
                Utility settings for roster organization.
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: UI.textSecondary, fontWeight: "800" }}>
              {householdUtilityExpanded ? "Hide" : "Edit"}
            </Text>
          </Pressable>

          {householdUtilityExpanded ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 16 }}>
                {isThisWeekKidDetail
                  ? "Groups this athlete in your list for your own organization only."
                  : "Groups this athlete on your roster view only — does not change coaching data."}
              </Text>
              <TextInput
                value={householdDraft}
                onChangeText={(t) => {
                  setHouseholdSavedAck(false);
                  setHouseholdDraft(t);
                }}
                placeholder="No household"
                placeholderTextColor={UI.textSecondary}
                autoCapitalize="words"
                editable={ready}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: UI.rowMutedBg,
                  color: UI.textPrimary,
                }}
              />
              <Pressable
                disabled={!ready || savingHousehold || !householdDirty}
                onPress={() => void onSaveHousehold()}
                style={({ pressed }) => ({
                  alignSelf: "flex-start",
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
                  opacity: !ready || savingHousehold || !householdDirty ? 0.55 : 1,
                })}
              >
                <Text style={{ fontSize: 13, color: UI.textPrimary, fontWeight: "800" }}>
                  {savingHousehold
                    ? "Saving…"
                    : householdSavedAck && !householdDirty
                      ? "Saved"
                      : "Save household"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {isCoachKidDetail && ready && !coachRosterRowArchived ? (
          <View
            style={{
              marginTop: 28,
              padding: 16,
              borderRadius: CARD_RADIUS,
              borderWidth: 1,
              borderColor: "#fecaca",
              backgroundColor: "#fef2f2",
              gap: 12,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                letterSpacing: 0.6,
                fontWeight: "800",
                color: "#991b1b",
                textTransform: "uppercase",
              }}
            >
              Danger zone
            </Text>
            <Text style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 20 }}>
              Remove this athlete from your active coach roster. This is a soft archive: nothing is permanently
              erased from this device.
            </Text>
            <Pressable
              onPress={requestArchiveAthleteFromCoachRoster}
              style={({ pressed }) => ({
                alignSelf: "flex-start",
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: pressed ? "#b91c1c" : UI.danger,
              })}
            >
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#ffffff" }}>Remove from roster</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={{ marginTop: 12, fontSize: 12, color: UI.textSecondary, opacity: 0.9 }}>
          Coach view — not shown to families
        </Text>
      </KeyboardAwareScrollView>

      <Modal
        visible={!!mediaPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setMediaPreview(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)" }}
          onPress={() => setMediaPreview(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              padding: 16,
            }}
          >
            <Pressable
              onPress={() => setMediaPreview(null)}
              style={{ alignSelf: "flex-end", paddingVertical: 10, paddingHorizontal: 12 }}
            >
              <Text style={{ color: "white", fontSize: 16 }}>Close</Text>
            </Pressable>

            {mediaPreview?.type === "video" ? (
              <View style={{ width: "100%", gap: 12 }}>
                {playableMediaUri ? (
                  <Video
                    source={{ uri: playableMediaUri }}
                    style={{
                      width: "100%",
                      height: Math.round(SCREEN_W * 0.9),
                      borderRadius: 12,
                    }}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                  />
                ) : (
                  <Text style={{ color: "white" }}>Resolving video from camera roll...</Text>
                )}
              </View>
            ) : mediaPreview?.type === "image" ? (
              <View style={{ width: "100%", gap: 12 }}>
                {playableMediaUri ? (
                  <Image
                    source={{ uri: playableMediaUri }}
                    style={{
                      width: "100%",
                      height: Math.round(SCREEN_W * 0.9),
                      borderRadius: 12,
                    }}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={{ color: "white" }}>Resolving image from camera roll...</Text>
                )}
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={suggestedFocusEditOpen}
        animationType="slide"
        transparent
        onRequestClose={closeSuggestedFocusModal}
      >
        <Pressable
          onPress={closeSuggestedFocusModal}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: UI.bgCard,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: insets.bottom + 20,
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "800", color: UI.textPrimary }}>
              Edit focus
            </Text>
            <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 18 }}>
              Starts from the system suggestion. Moves into the current evolution cycle; nothing sends until you choose it.
            </Text>
            <TextInput
              value={suggestedFocusDraft}
              onChangeText={setSuggestedFocusDraft}
              multiline
              placeholder="Coach wording for this week’s training focus…"
              placeholderTextColor={UI.textSecondary}
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgCard,
                color: UI.textPrimary,
                minHeight: 100,
                padding: 12,
                textAlignVertical: "top",
              }}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={closeSuggestedFocusModal}
                style={({ pressed }) => ({
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: pressed ? UI.rowMutedBg : UI.bgCard,
                })}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: UI.textPrimary }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleApplySuggestedFocusEdit}
                style={({ pressed }) => ({
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#1d4ed8",
                  backgroundColor: pressed ? "#1e40af" : "#1d4ed8",
                })}
              >
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#ffffff" }}>
                  Insert into weekly note
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
