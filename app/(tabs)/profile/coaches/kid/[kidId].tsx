import { useHeaderHeight } from "@react-navigation/elements";
import { Stack, router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ResizeMode, Video } from "expo-av";
import * as MediaLibrary from "expo-media-library";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import { kidWeeklyFocusToPublishPayload } from "../../../../../src/coach/weeklyFocusPublish";
import {
  CoachWeeklySyncApiError,
  coachSyncFetchSession,
  coachSyncPublishWeekly,
} from "../../../../../src/services/coachWeeklySyncApi";
import { getCoachLinks } from "../../../../../src/storage/coachShareStore";
import type { CoachLink } from "../../../../../src/types/coachShare";
import {
  getKidsById,
  getLatestKidWeeklyFocusForWeek,
  appendKidWeeklyFocus,
  getKidWeeklyFocusEntriesForKid,
  deleteKidWeeklyFocusEntryById,
  startOfWeekMondayYMD,
  todayYMD,
  updateKidHouseholdLabel,
} from "../../../../../src/storage/coachKidStore";
import { deleteSessionById } from "../../../../../src/storage/sessionsStore";
import { getKidStandingGuidance } from "../../../../../src/storage/kidStandingGuidanceStore";
import { StorageKeys } from "../../../../../src/storage/storageKeys";
import {
  deleteKidCompetitionEntry,
  getKidCompetitionEntriesForKid,
  upsertSharedCompetitionsForKid,
} from "../../../../../src/storage/kidCompetitionStore";
import type { Session } from "../../../../../src/types";
import type {
  CoachOutcome,
  KidCompetitionEntry,
  KidCompetitionFormat,
  KidCompetitionOutcomeKind,
  KidCompetitionResult,
  KidStandingGuidance,
  KidWeeklyFocusEntry,
} from "../../../../../src/types/coachKid";
import type { SyncedSharedCompetition } from "../../../../../src/types/coachWeeklySync";
import { toDateKey } from "../../../../../src/_domain/dateKey";
import { FUNDAMENTALS_TAXONOMY } from "../../../../../src/fundamentals/taxonomy";

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
  switch (r) {
    case "gold":
      return "Gold";
    case "silver":
      return "Silver";
    case "bronze":
      return "Bronze";
    case "participated":
      return "Participated";
    case "dnf":
      return "DNF";
    case "other":
      return "Other";
  }
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

/** Matches kids roster invite list: one entry per link token, excludes revoked / empty secrets. */
function dedupeActiveCoachWriterLinks(links: CoachLink[]): CoachLink[] {
  const m = new Map<string, CoachLink>();
  for (const l of links) {
    if (l.status !== "active" || l.revokedAt) continue;
    const ws = l.weeklySync;
    const secret = typeof ws?.writerSecret === "string" ? ws.writerSecret.trim() : "";
    const tokenRaw = typeof ws?.linkToken === "string" ? ws.linkToken.trim() : "";
    if (!ws || !secret || !tokenRaw) continue;
    const token = tokenRaw.toLowerCase();
    const cur = m.get(token);
    if (
      !cur ||
      l.updatedAt.localeCompare(cur.updatedAt) > 0 ||
      (l.updatedAt === cur.updatedAt && l.createdAt.localeCompare(cur.createdAt) > 0)
    ) {
      m.set(token, l);
    }
  }
  return [...m.values()];
}

/** Newest invite first — same ordering as kids roster primary row; used to pick one canonical session per athlete. */
function sortCoachWriterLinksNewestFirst(links: CoachLink[]): CoachLink[] {
  return [...links].sort((a, b) => {
    const u = b.updatedAt.localeCompare(a.updatedAt);
    if (u !== 0) return u;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function compareCoachCompYMD(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Coach list: always show a clear lifecycle label even when the family left `eventStatus` unset.
 */
function coachCompetitionRowStatusLabel(row: KidCompetitionEntry, todayYMD: string): string {
  const st = row.eventStatus;
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

function normalizeOpenableHttpUrl(raw?: string): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const candidate =
    t.startsWith("http://") || t.startsWith("https://") ? t : `https://${t}`;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

async function openHttpsUrl(rawUrl: string | undefined) {
  const normalized = normalizeOpenableHttpUrl(rawUrl);
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

  const weekStartYMD = useMemo(() => {
    if (!kidId) return "";
    return startOfWeekMondayYMD(todayYMD());
  }, [kidId]);

  const [ready, setReady] = useState(false);
  const [kidName, setKidName] = useState<string>("—");
  const [householdDraft, setHouseholdDraft] = useState("");
  const [savingHousehold, setSavingHousehold] = useState(false);
  const [householdSavedAck, setHouseholdSavedAck] = useState(false);
  const [currentWeekEntry, setCurrentWeekEntry] = useState<KidWeeklyFocusEntry | null>(null);
  const [thisWeekReflections, setThisWeekReflections] = useState<KidWeeklyFocusEntry[]>([]);

  const [outcomeDraft, setOutcomeDraft] = useState<CoachOutcome>("not_yet");
  const [notesDraft, setNotesDraft] = useState<string>("");
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [competitions, setCompetitions] = useState<KidCompetitionEntry[]>([]);
  const [kidWeekSessions, setKidWeekSessions] = useState<Session[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [mediaPreview, setMediaPreview] = useState<MediaPreviewState | null>(null);
  const [playableMediaUri, setPlayableMediaUri] = useState<string | null>(null);
  const [standingGuidance, setStandingGuidance] = useState<KidStandingGuidance | null>(null);
  const [progressNotesInputKey, setProgressNotesInputKey] = useState(0);
  const [publishingWeekly, setPublishingWeekly] = useState(false);
  const [headerRefreshing, setHeaderRefreshing] = useState(false);
  /** Set when a header refresh completes successfully (ISO timestamp for display). */
  const [lastHeaderRefreshAtIso, setLastHeaderRefreshAtIso] = useState<string | null>(null);

  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const keyboardAwareRef = useRef<InstanceType<typeof KeyboardAwareScrollView> | null>(null);
  /** Monotonic per screen mount: correlates logs and drops stale async `load()` completions. */
  const coachKidDetailLoadGenRef = useRef(0);
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

  const load = useCallback(async (opts?: { prefillProgressInputs?: boolean; keepPreviousUiReady?: boolean }) => {
    if (!kidId || !weekStartYMD) return false;
    const loadGen = ++coachKidDetailLoadGenRef.current;
    const prefillProgressInputs = opts?.prefillProgressInputs ?? true;
    const keepPreviousUiReady = opts?.keepPreviousUiReady ?? false;
    if (!keepPreviousUiReady) {
      setReady(false);
    }
    try {
      const kids = await getKidsById();
      if (loadGen !== coachKidDetailLoadGenRef.current) return false;
      const kid = kids[kidId];
      setKidName(kid?.name ?? "—");
      setHouseholdDraft(kid?.householdLabel ?? "");

      const entry = await getLatestKidWeeklyFocusForWeek(kidId, weekStartYMD);
      setCurrentWeekEntry(entry);

      if (prefillProgressInputs) {
        const initialOutcome: CoachOutcome = entry?.coachOutcome ?? "not_yet";
        setOutcomeDraft(initialOutcome);
        // Latest week row is often a saved reflection (newest createdAt) and includes coachNotes;
        // prefilling that into the draft looks like text "stuck" after save. Outcome can track forward.
        setNotesDraft("");
      } else {
        // After a successful save, we want a fresh blank input.
        setOutcomeDraft("not_yet");
        setNotesDraft("");
      }

      const allEntries = await getKidWeeklyFocusEntriesForKid(kidId);
      const weekReflections = allEntries.filter(
        (e) =>
          e.weekStartYMD === weekStartYMD &&
          (typeof e.coachOutcome !== "undefined" || Boolean((e.coachNotes ?? "").trim())),
      );
      weekReflections.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setThisWeekReflections(weekReflections);

      let compRows = await getKidCompetitionEntriesForKid(kidId);
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
        let remoteForKid: SyncedSharedCompetition[] = [];
        /** Which writer session we treat as canonical for this kid (newest link that contains the athlete). */
        let canonicalTokenTail: string | null = null;
        let sessionFetchFailures = 0;
        let sessionIndex = 0;
        for (const l of syncLinks) {
          sessionIndex += 1;
          const ws = l.weeklySync!;
          const token = ws.linkToken ?? "";
          const linkTokenTail = token.length > 8 ? token.slice(-8) : token;
          try {
            const session = await coachSyncFetchSession(ws.linkToken, ws.apiBaseUrl);
            if (loadGen !== coachKidDetailLoadGenRef.current) return false;

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
            // One session per athlete: merging every link’s competitions lets abandoned/stale sessions
            // resurrect ids the parent already deleted on their active invite.
            if (athleteInSession && canonicalTokenTail === null) {
              canonicalTokenTail = linkTokenTail;
              remoteForKid = matching;
            }
          } catch {
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
        if (__DEV__) {
          console.log("[bjj-coach-kid-detail] canonical remote for athlete", {
            loadGen,
            canonicalTokenTail,
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
      return loadGen === coachKidDetailLoadGenRef.current;
    } finally {
      if (loadGen === coachKidDetailLoadGenRef.current) {
        setReady(true);
      }
    }
  }, [kidId, weekStartYMD]);

  const onRefreshFromHeader = useCallback(async () => {
    if (!kidId) return;
    if (coachKidHeaderRefreshInFlightRef.current) return;
    coachKidHeaderRefreshInFlightRef.current = true;
    const refreshStartedAt = Date.now();
    setHeaderRefreshing(true);
    try {
      const applied = await load({ prefillProgressInputs: true, keepPreviousUiReady: true });
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
      Alert.alert("Missing kid id", "This pilot route requires a kid selection.");
      router.replace("/profile/coaches/kids");
    }
  }, [kidId]);

  useEffect(() => {
    setHouseholdSavedAck(false);
  }, [kidId]);

  const canEditOutcome = Boolean(currentWeekEntry);

  const competitionListTodayYMD = todayYMD();

  const focusTitle = currentWeekEntry?.title ?? null;

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
        router.replace("/profile/coaches/kids");
        return;
      }
      setHouseholdDraft(updated.householdLabel ?? "");
      setHouseholdSavedAck(true);
    } finally {
      setSavingHousehold(false);
    }
  }, [kidId, householdDraft]);

  const onSaveOutcome = useCallback(async () => {
    if (!currentWeekEntry) return;
    setSavingOutcome(true);
    try {
      const trimmedNotes = notesDraft.trim();

      if (currentWeekEntry.focusType === "template") {
        await appendKidWeeklyFocus({
          kidId,
          weekStartYMD,
          focusType: "template",
          templateId: currentWeekEntry.templateId,
          title: currentWeekEntry.title,
          metadata: currentWeekEntry.metadata,
          youtubeUrl: currentWeekEntry.youtubeUrl,
          familyResourceUrl: currentWeekEntry.familyResourceUrl,
          familyResourceLabel: currentWeekEntry.familyResourceLabel,
          coachOutcome: outcomeDraft,
          coachNotes: trimmedNotes ? trimmedNotes : undefined,
        });
      } else {
        await appendKidWeeklyFocus({
          kidId,
          weekStartYMD,
          focusType: "custom",
          title: currentWeekEntry.title,
          note: currentWeekEntry.note,
          youtubeUrl: currentWeekEntry.youtubeUrl,
          familyResourceUrl: currentWeekEntry.familyResourceUrl,
          familyResourceLabel: currentWeekEntry.familyResourceLabel,
          coachOutcome: outcomeDraft,
          coachNotes: trimmedNotes ? trimmedNotes : undefined,
        });
      }

      await load({ prefillProgressInputs: false });
      setProgressNotesInputKey((k) => k + 1);
    } finally {
      setSavingOutcome(false);
    }
  }, [currentWeekEntry, notesDraft, outcomeDraft, load, kidId, weekStartYMD]);

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
              await load({ prefillProgressInputs: true });
            },
          },
        ],
      );
    },
    [kidId, load],
  );

  const requestDeleteCompetition = useCallback(
    (entryId: string, tournamentName: string) => {
      const label = tournamentName.trim() || "this entry";
      Alert.alert("Delete competition?", `Delete “${label}”? This cannot be undone.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteKidCompetitionEntry(entryId);
            await load({ prefillProgressInputs: false });
          },
        },
      ]);
    },
    [load],
  );

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
    if (__DEV__) {
      console.log("[bjj-coach-publish-latest-entry]", {
        entryId: latestEntry.id,
        familyResourceUrl: (latestEntry.familyResourceUrl ?? "").trim() || null,
        familyResourceLabel: (latestEntry.familyResourceLabel ?? "").trim() || null,
      });
    }
    const links = await getCoachLinks();
    const cred = dedupeActiveCoachWriterLinks(links)
      .filter((l) => l.weeklySync?.writerSecret?.trim())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (!cred?.weeklySync?.writerSecret) {
      Alert.alert(
        "No invite on this device",
        "Create a family invite from Kids (Pilot) on this coach phone first.",
      );
      return;
    }
    const payload = kidWeeklyFocusToPublishPayload(latestEntry, weekStartYMD);
    setPublishingWeekly(true);
    try {
      await coachSyncPublishWeekly(
        cred.weeklySync.linkToken,
        cred.weeklySync.writerSecret,
        payload,
        cred.weeklySync.apiBaseUrl,
      );
      Alert.alert(
        "Published to families",
        "Parents see this week’s title, family note, and any family link you added — not check-ins or your private reference video. They need to open This week together (or Refresh) on their linked phone.",
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
            await load({ prefillProgressInputs: false });
          },
        },
      ]);
    },
    [load],
  );

  return (
    <>
      <Stack.Screen options={{ title: "Kid (Pilot)" }} />
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
          onPress={() => router.push("/profile/coaches/kids")}
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
          <Text style={{ fontSize: 14, color: UI.textPrimary }}>Back to Kids</Text>
        </Pressable>

        <Text style={{ fontSize: 22, fontWeight: "800", color: UI.textPrimary, marginBottom: 6 }}>
          {kidName}
        </Text>
        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
          Coach-only notes stay here. The green section is what you can publish to linked parent phones.
        </Text>

        <View style={{ height: 12 }} />

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
            Used only to group kids on the pilot roster. Same kid id; does not change coaching data.
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
            disabled={!ready || savingHousehold}
            onPress={() => void onSaveHousehold()}
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
              opacity: !ready || savingHousehold ? 0.55 : 1,
            })}
          >
            <Text style={{ fontSize: 13, color: UI.textPrimary, fontWeight: "800" }}>
              {savingHousehold
                ? "Saving…"
                : householdSavedAck
                  ? "Saved"
                  : "Save household"}
            </Text>
          </Pressable>
          {householdSavedAck && !savingHousehold ? (
            <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 16 }}>
              Household saved
            </Text>
          ) : null}
        </View>

        <View style={{ height: 16 }} />

        <View
          style={{
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: UI.coachLaneBorder,
            backgroundColor: UI.coachLaneBg,
            padding: 12,
            gap: 14,
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
              Not shared with families. Direction, check-ins, your training log, and competitions stay on this phone.
            </Text>
          </View>

          <View
            style={{
              padding: 16,
              borderRadius: CARD_RADIUS,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "700", color: UI.textSecondary }}>
              What matters next
            </Text>
          {standingIsActive ? (
            <Text style={{ fontSize: 16, fontWeight: "800", color: UI.textPrimary }}>
              {standingPrimary}
            </Text>
          ) : (
            <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 20 }}>
              Capture the main takeaway and next focus for this kid.
            </Text>
          )}
          {standingSecondaryMuted ? (
            <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 18 }}>
              {standingSecondaryMuted}
            </Text>
          ) : null}
          <Text
            style={{
              marginTop: 2,
              fontSize: 12,
              color: UI.textSecondary,
              lineHeight: 17,
              opacity: 0.92,
            }}
          >
            AI can help draft this and save time
          </Text>
          <Pressable
            onPress={() =>
              router.push(`/profile/coaches/kid/${kidId}/what-matters-next`)
            }
            style={({ pressed }) => ({
              marginTop: 4,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
              alignSelf: "flex-start",
            })}
          >
            <Text style={{ fontSize: 14, color: UI.textPrimary, fontWeight: "800" }}>
              {standingIsActive ? "Edit direction" : "Add note"}
            </Text>
          </Pressable>
        </View>

        <View style={{ height: 14 }} />

        <View
          style={{
            padding: 16,
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
            gap: 10,
            opacity: canEditOutcome ? 1 : 0.65,
          }}
        >
          <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "700", color: UI.textSecondary }}>
            {"How it's going"}
          </Text>

          {!canEditOutcome ? (
            <Text style={{ fontSize: 13, color: UI.textSecondary }}>
              {"Set this week's focus first to track outcome and notes."}
            </Text>
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["not_yet", "developing", "on_track"] as CoachOutcome[]).map((o) => {
                  const active = outcomeDraft === o;
                  return (
                    <Pressable
                      key={o}
                      disabled={!canEditOutcome}
                      onPress={() => setOutcomeDraft(o)}
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
                        {outcomeLabel(o)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={{ marginTop: 2, fontSize: 12, color: UI.textSecondary, lineHeight: 16 }}>
                Notes start empty; each save adds an entry below.
              </Text>

              <TextInput
                key={progressNotesInputKey}
                value={notesDraft}
                scrollEnabled={false}
                onChangeText={setNotesDraft}
                onFocus={bumpScrollToFocusedInput}
                onContentSizeChange={bumpScrollToFocusedInput}
                placeholder="Add check-in notes"
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
                  Save check-in
                </Text>
              </Pressable>
            </>
          )}

          <View style={{ marginTop: 10, gap: 8 }}>
            <Text style={{ fontSize: 11, letterSpacing: 0.4, fontWeight: "700", color: UI.textSecondary }}>
              This week
            </Text>

            {thisWeekReflections.length === 0 ? (
              <Text style={{ fontSize: 13, color: UI.textSecondary }}>
                No saved check-ins yet.
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
                      overshootRight={false}
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
                            `/profile/coaches/kid/${kidId}/progress-reflection?entryId=${encodeURIComponent(r.id)}`,
                          )
                        }
                        style={({ pressed }) => ({
                          alignSelf: "stretch",
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          gap: 4,
                          backgroundColor: pressed ? "#eef2ff" : UI.rowMutedBg,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: UI.border,
                          overflow: "hidden",
                        })}
                      >
                        {outcomeText ? (
                          <Text style={{ fontSize: 12, color: UI.textSecondary }}>{outcomeText}</Text>
                        ) : null}
                        {notesText ? (
                          <Text style={{ fontSize: 12, color: UI.textSecondary }} numberOfLines={2}>
                            {notesText}
                          </Text>
                        ) : null}
                        {!outcomeText && !notesText ? (
                          <Text style={{ fontSize: 12, color: UI.textSecondary }}>(empty check-in)</Text>
                        ) : null}
                      </Pressable>
                    </Swipeable>
                  );
                })}
                {thisWeekReflections.length > 3 ? (
                  <Pressable
                    onPress={() => router.push(`/profile/coaches/kid/${kidId}/history`)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1, alignSelf: "flex-start" })}
                  >
                    <Text style={{ fontSize: 12, color: UI.textSecondary, fontWeight: "600" }}>
                      +{thisWeekReflections.length - 3} more in history
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        </View>

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
                  `/training/new?date=${encodeURIComponent(
                    todayYMD(),
                  )}&kidId=${encodeURIComponent(kidId)}`,
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
                    overshootRight={false}
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
            onPress={() => router.push(`/profile/coaches/kid/${kidId}/competition/edit`)}
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
                          return (
                          <Swipeable
                            key={row.id}
                            overshootRight={false}
                            enabled={!isSyncedRow}
                            renderRightActions={() => (
                              <Pressable
                                onPress={() => requestDeleteCompetition(row.id, row.tournamentName)}
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
                                  `/profile/coaches/kid/${kidId}/competition/edit?entryId=${encodeURIComponent(row.id)}`,
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
                                {row.videoUri?.trim() ? (
                                  <Pressable
                                    onPress={(e) => {
                                      e.stopPropagation?.();
                                      (e as { preventDefault?: () => void }).preventDefault?.();
                                      setMediaPreview({
                                        type: "video",
                                        uri: row.videoUri!.trim(),
                                        assetId: row.videoAssetId ?? null,
                                      });
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
                                        VID
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
        </View>

        <View style={{ height: 16 }} />

        <View
          style={{
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
              Linked parents see this only after you publish. Set the weekly focus, then use the green button.
            </Text>
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
            <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "700", color: UI.textSecondary }}>
              {"This week's focus (published title + family note)"}
            </Text>
            <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
              Parents get the title, the family-facing note from the editor, and an optional family link — not your
              check-ins or the reference video field below.
            </Text>
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
                Reference video / IG — coach device only, not sent to parents.
              </Text>
            ) : null}

            {focusTitle && currentWeekEntry?.familyResourceUrl?.trim() ? (
              <Pressable
                onPress={() => void openHttpsUrl(currentWeekEntry!.familyResourceUrl)}
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
                  {(currentWeekEntry.familyResourceLabel ?? "").trim() || "Family link"} · open
                </Text>
                <Text
                  style={{ marginTop: 2, fontSize: 11, color: UI.textSecondary }}
                  numberOfLines={1}
                >
                  {currentWeekEntry.familyResourceUrl.trim()}
                </Text>
              </Pressable>
            ) : null}

            {focusTitle ? (
              <Text style={{ fontSize: 12, color: UI.textSecondary }}>
                Week of <Text style={{ fontWeight: "700" }}>{weekStartYMD}</Text>
              </Text>
            ) : (
              <Text style={{ fontSize: 12, color: UI.textSecondary }}>
                Pick a focus, add a family link if you want, then publish.
              </Text>
            )}

            <Pressable
              onPress={() =>
                currentWeekEntry
                  ? router.push(
                      `/profile/coaches/kid/${kidId}/weekly-focus?entryId=${encodeURIComponent(currentWeekEntry.id)}`,
                    )
                  : router.push(`/profile/coaches/kid/${kidId}/weekly-focus`)
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
              <Text style={{ marginTop: 6, fontSize: 12, color: "#ecfdf5", textAlign: "center", lineHeight: 17 }}>
                {"Required for parents to see this week's note. Sends title, family note, and family link only."}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push(`/profile/coaches/kid/${kidId}/history`)}
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

        {!ready ? (
          <Text style={{ marginTop: 14, fontSize: 13, color: UI.textSecondary }}>
            Loading…
          </Text>
        ) : null}

        <Text style={{ marginTop: 12, fontSize: 12, color: UI.textSecondary, opacity: 0.9 }}>
          Internal pilot (coach-side)
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
    </>
  );
}

