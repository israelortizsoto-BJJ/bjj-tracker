import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StorageKeys } from "../../src/storage/storageKeys";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { ResizeMode, Video } from "expo-av";
import * as MediaLibrary from "expo-media-library";
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { Calendar } from "react-native-calendars";
import { toDateKey } from "../../src/_domain/dateKey";

import { buildTechniqueIndex, getTechniqueById } from "../../src/fundamentals/index";
import { FUNDAMENTALS_TAXONOMY } from "../../src/fundamentals/taxonomy";
import type { TechniqueIndexItem } from "../../src/fundamentals/types";

import type { Session } from "../../src/types";

import {
  computeCompletedWeekStreak,
  computeCurrentFocus14d,
  computeGiNoGi14d,
  computeTopSystemThisWeek,
  computeTopTechniqueThisWeek,
  computeWeekCount,
  computeWeekTotals,
} from "../../src/domain/metrics";



type PreviewState =
  | null
  | { type: "image"; uri: string; assetId?: string | null }
  | { type: "video"; uri: string; assetId?: string | null };

const openBetaFeedbackEmail = async () => {
  const subject = encodeURIComponent("MatMind Beta Feedback");
  const body = encodeURIComponent(
    [
      "Device model:",
      "iOS version:",
      "",
      "What you expected:",
      "",
      "What happened:",
      "",
      "Steps to reproduce (if you can):",
      "",
      "Screenshot/video:",
    ].join("\n")
  );

  const url = `mailto:support@ortizdigitalstudio.com?subject=${subject}&body=${body}`;

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    Alert.alert("Email not available", "Please email support@ortizdigitalstudio.com");
    return;
  }
  await Linking.openURL(url);
};

// System id -> label (for week list + cards)
const SYSTEM_LABEL_BY_ID = new Map<string, string>([
  ["ALL", "All"],
  ["All", "All"], // backward compat
  ...FUNDAMENTALS_TAXONOMY.map((l1) => [l1.id, l1.label] as const),
]);

function resolveSystemLabel(systemId: string | undefined | null) {
  const key = (systemId ?? "").trim();
  if (!key) return "—";
  return SYSTEM_LABEL_BY_ID.get(key) ?? key;
}

function resolveTechniqueLabelById(
  index: TechniqueIndexItem[],
  techniqueId: string | undefined | null
) {
  const id = (techniqueId ?? "").trim();
  if (!id) return "—";
  const selected = getTechniqueById(index, id);
  return selected?.label ?? id;
}



// ------------------------------
// 2) Pure helper functions
// ------------------------------

function todayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
const CARD_W = Math.min(360, Dimensions.get("window").width - 32);
const SCREEN_W = Dimensions.get("window").width;
const GAP = 12;
const SIDE_PAD = Math.max(0, (SCREEN_W - CARD_W) / 2);
const SNAP = CARD_W + GAP;

function startOfWeekMonday(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0 Sun - 6 Sat
  const diffToMonday = (day + 6) % 7;
  date.setDate(date.getDate() - diffToMonday);
  return date;
}
function startOfWeekMondayYMD(ymd: string) {
  return dateToYMD(startOfWeekMonday(ymd));
}

function dateToYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function dayLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString(undefined, { weekday: "short" }); // Mon
  const monthDay = dt.toLocaleDateString(undefined, { month: "short", day: "numeric" }); // Jan 21
  return `${weekday} • ${monthDay}`;
}

function addDaysYMD(ymd: string, delta: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return dateToYMD(dt); // IMPORTANT: uses your padded formatter
}

function normalizeUrl(url?: string) {
  if (!url) return "";
  const u = url.trim();
  if (!u) return "";
  return u.startsWith("http://") || u.startsWith("https://") ? u : `https://${u}`;
}

async function openUrl(url?: string) {
  const u = normalizeUrl(url);
  if (!u) return;

  try {
    const can = await Linking.canOpenURL(u);
    if (!can) {
      Alert.alert("Can't open link", "Please check the YouTube URL.");
      return;
    }
    await Linking.openURL(u);
  } catch {
    Alert.alert("Can't open link", "Please check the YouTube URL.");
  }
}



async function resolveMediaUri(
  uri?: string | null,
  assetId?: string | null
): Promise<string | null> {
  const u = uri?.trim();
  if (!u) return null;

  // Already a real file path
  if (u.startsWith("file://")) return u;

  // iOS Photos library URIs (camera roll)
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

function sessionTitle(s: Session) {
  // Auto-title: System + Technique (fallbacks)
  const tech = (s.technique || "").trim();
  const sys = resolveSystemLabel(s.system);
  const base = tech ? `${sys} • ${tech}` : sys;

  // Optional hint if this session contains multiple techniques.
  const extraCount = (s.techniques?.length ?? 0) - 1;
  return extraCount > 0 ? `${base} (+${extraCount} more)` : base;
}

function sessionSummary(s: Session) {
  const drill = (s.drill || "").trim();
  const notes = (s.notes || "").trim();
  const parts = [];

  if (drill) parts.push(`Drill: ${drill}`);
  if (notes) parts.push(`Notes: ${notes}`);

  return parts.join(" • ");
}

function sessionBadges(s: Session) {
  const badges: string[] = [];
  if (s.youtubeUrl?.trim()) badges.push("YT");
  if (s.imageUri) badges.push("IMG");
  if (s.videoUri) badges.push("VID");
  return badges;
}

type BadgeAction =
  | { type: "yt"; uri: string }
  | { type: "image"; uri: string }
  | { type: "video"; uri: string };

function getBadgeAction(labelRaw: any, s: Session): BadgeAction | null {
  const label = String(labelRaw).trim().toLowerCase();

  if (label === "yt" && !!s.youtubeUrl?.trim()) {
    return { type: "yt", uri: s.youtubeUrl.trim() };
  }
  if (label === "img" && !!s.imageUri?.trim()) {
    return { type: "image", uri: s.imageUri.trim() };
  }
  if (label === "vid" && !!s.videoUri?.trim()) {
    return { type: "video", uri: s.videoUri.trim() };
  }
  return null;
}
async function loadSessions(): Promise<Session[]> {
  const raw = await AsyncStorage.getItem(StorageKeys.sessions);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  bgCardActive: "#edf2ff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  textHeader: "#111827",
  badgeBg: "#f3f4f6",
  accent: "#1d4ed8",
};
const CARD_RADIUS = 18;
const SECTION_LABEL = { fontSize: 11, letterSpacing: 1.1, color: "#6b7280", fontWeight: "600" as const };
const INSIGHT_STYLES = {
  hero: { color: UI.textPrimary, fontSize: 28, fontWeight: "900" as const },
  title: { color: UI.textPrimary, fontSize: 14, fontWeight: "800" as const, marginTop: 6 },
  sub: { color: UI.textSecondary, fontSize: 12, marginTop: 4 },
};
const INSIGHT_CARD_CONTAINER = {
  width: CARD_W,
  marginRight: GAP,
  padding: 18,
  borderRadius: CARD_RADIUS,
  borderWidth: 1,
  borderColor: UI.border,
  backgroundColor: UI.bgCard,
} as const;
// ------------------------------
// 3) Component setup (state + navigation + derived constants)
// ------------------------------

export default function Training() {
// 3A) Navigation / params
  const router = useRouter();
  const params = useLocalSearchParams();

  const initialDate =
    typeof params.date === "string" && params.date ? params.date : todayYMD();
// 3B) State
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [weekStartYMD, setWeekStartYMD] = useState(startOfWeekMondayYMD(todayYMD()));
  const [systemFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [preview, setPreview] = useState<PreviewState>(null);
  const [playableVideoUri, setPlayableVideoUri] = useState<string | null>(null);
  // Insight cards (horizontal carousel)
  const [insightIndex, setInsightIndex] = useState(0);

// Collapsible week groups (expanded/collapsed by day)
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

// Technique index (for resolving techniqueId -> label)
const TECH_INDEX = useMemo<TechniqueIndexItem[]>(
  () => buildTechniqueIndex(FUNDAMENTALS_TAXONOMY),
  []
);
// 3D) Gestures / interaction (week swipe)
// tweakable
const swipeThreshold = 40;

const panResponder = useMemo(
  () =>
    PanResponder.create({
      // ✅ capture early so Pressable/ScrollView don't steal it
    onStartShouldSetPanResponder: () => false,
onStartShouldSetPanResponderCapture: () => viewMode === "week",

onMoveShouldSetPanResponder: (_, g) => {
  if (viewMode !== "week") return false;
  const dx = Math.abs(g.dx);
  const dy = Math.abs(g.dy);
  return dx > 20 && dx > dy + 8;
},

onMoveShouldSetPanResponderCapture: (_, g) => {
  if (viewMode !== "week") return false;
  const dx = Math.abs(g.dx);
  const dy = Math.abs(g.dy);
  return dx > 20 && dx > dy + 8;
},

      onPanResponderTerminationRequest: () => false,

      onPanResponderRelease: (_, g) => {
        if (viewMode !== "week") return;

        if (g.dx > swipeThreshold) {
          // swipe right => previous week
          setWeekStartYMD((prev) => addDaysYMD(prev, -7));
        } else if (g.dx < -swipeThreshold) {
          // swipe left => next week
          setWeekStartYMD((prev) => addDaysYMD(prev, 7));
        } else {
        }
      },
    }),
  // ✅ IMPORTANT: include viewMode so responder behavior updates when you toggle tabs
  [viewMode, setWeekStartYMD]
);

// 3C) Simple constants
  const today = todayYMD();
  const yesterday = addDaysYMD(today, -1);
  const isTodayActive = viewMode === "day" && selectedDate === today;
  const isYesterdayActive = viewMode === "day" && selectedDate === yesterday;
  const isThisWeekActive = viewMode === "week";

// ------------------------------------------------------------
// 4) Data loading + sync (effects)
//    4A) refresh() -> loads AsyncStorage into state
//    4B) Effects: route param sync (params.date) + useFocusEffect refresh
// ------------------------------------------------------------
const refresh = useCallback(async () => {
  setIsLoadingSessions(true);
  try {
    const next = await loadSessions();
const normalized = next.map((s) => ({
  ...s,
  date: toDateKey(s.date) || todayYMD(),
}));
setSessions(normalized);
  } finally {
    setIsLoadingSessions(false);
  }
}, []);

useEffect(() => {
  if (typeof params.date === "string" && params.date) {
    setSelectedDate(params.date);
  }
}, [params.date]);

useEffect(() => {
  if (typeof params.date !== "string") return;
  const p = params.date;
  if (!p) return;
  if (selectedDate !== p) return;

  router.setParams({ date: "" });
}, [params.date, selectedDate, router]);

useFocusEffect(
  useCallback(() => {
    refresh();
  }, [refresh])
);
useEffect(() => {
  let cancelled = false;

  async function run() {
    // reset each time preview changes
    setPlayableVideoUri(null);

    if (!preview || preview.type !== "video") return;

    const resolved = await resolveMediaUri(preview.uri, preview.assetId ?? null);
    if (cancelled) return;

    setPlayableVideoUri(resolved);
  }

  run();

  return () => {
    cancelled = true;
  };
}, [preview]);

// -----------------------------------------------------------
// 5) Derived data (computed "view model" for rendering)
// -----------------------------------------------------------

const sessionsByDate = useMemo(() => {
    const map: Record<string, Session[]> = {};
    for (const s of sessions) {
      const key = s.date ?? todayYMD();
      map[key] = map[key] ? [...map[key], s] : [s];
    }
    return map;
  }, [sessions]);

const weekDates = useMemo(() => {
  const monday = new Date(weekStartYMD);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(dateToYMD(d));
  }
  return dates;
}, [weekStartYMD]);

useEffect(() => {
  if (viewMode !== "week") return;

  setExpandedDays((prev) => {
    const next = { ...prev };

    for (const ymd of weekDates) {
      const hasSessions = (sessionsByDate[ymd]?.length ?? 0) > 0;
      if (next[ymd] === undefined) next[ymd] = hasSessions;
    }
    // Always expand "today" by default (even if 0 sessions)
if (next[today] === undefined) next[today] = true;

    return next;
  });
}, [viewMode, weekDates, sessionsByDate, today]);

// Week grouped-by-day (best for your Week UI)

const weekSessionsByDate = useMemo(() => {
  const map: Record<string, Session[]> = {};

  for (const ymd of weekDates) {
    map[ymd] = (sessionsByDate[ymd] ?? [])
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  return map;
}, [weekDates, sessionsByDate]);

// Week flat list (useful for counts + filtering/search across the week)
const weekSessionsRaw = useMemo(() => {
  const list: Session[] = [];
  for (const ymd of weekDates) {
    list.push(...(sessionsByDate[ymd] ?? []));
  }
  // newest first
  return list.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

}, [weekDates, sessionsByDate]);
    const topSystemThisWeek = useMemo(() => {
  return computeTopSystemThisWeek(weekSessionsRaw);
}, [weekSessionsRaw]);

  const topTechniqueThisWeek = useMemo(() => {
  return computeTopTechniqueThisWeek(weekSessionsRaw);
}, [weekSessionsRaw]);
  const WEEKLY_GOAL = 3;
  const currentWeekStartYMD = dateToYMD(startOfWeekMonday(today));
  const completedWeekStreak = useMemo(() => {
  return computeCompletedWeekStreak(
    sessionsByDate,
    currentWeekStartYMD,
    WEEKLY_GOAL
  );
}, [sessionsByDate, currentWeekStartYMD]);

 const currentWeekCount = useMemo(() => {
  return computeWeekCount(sessionsByDate, currentWeekStartYMD);
}, [sessionsByDate, currentWeekStartYMD]);


const displayWeekStreak =
  completedWeekStreak + (currentWeekCount >= WEEKLY_GOAL ? 1 : 0);


const thisWeekTotal = useMemo(() => {
  return weekSessionsRaw.length;
}, [weekSessionsRaw]);
const currentFocusSystem14d = useMemo(() => {
  return computeCurrentFocus14d(sessionsByDate, today);
}, [sessionsByDate, today]);

const giNoGi14d = useMemo(() => {
  return computeGiNoGi14d(sessionsByDate, today);
}, [sessionsByDate, today]);
const weekTotals4w = useMemo(() => {
  return computeWeekTotals(sessionsByDate, currentWeekStartYMD, 4);
}, [sessionsByDate, currentWeekStartYMD]);

const trendDelta = useMemo(() => {
  const thisW = weekTotals4w[0] ?? 0;
  const lastW = weekTotals4w[1] ?? 0;
  return thisW - lastW;
}, [weekTotals4w]);

const insightCards = [
  // Card 0: Narrative Intro
(
 <View
  key="insight-0"
  style={[
    INSIGHT_CARD_CONTAINER,
    { opacity: insightIndex === 0 ? 1 : 0.92 },
  ]}
>
    <Text style={INSIGHT_STYLES.hero} numberOfLines={1} ellipsizeMode="tail">
      Your Game
    </Text>

    <Text style={INSIGHT_STYLES.title}>
      Training patterns
    </Text>

    <Text style={INSIGHT_STYLES.sub}>
      Reveal how you&apos;re building your jiu-jitsu
    </Text>
  </View>
),
  // Card 1: Sessions This Week
  (
    <View
  key="insight-1"
  style={[
    INSIGHT_CARD_CONTAINER,
    { opacity: insightIndex === 0 ? 1 : 0.92 },
  ]}
>
      <Text style={INSIGHT_STYLES.hero}>{thisWeekTotal}</Text>
      <Text style={INSIGHT_STYLES.title}>Sessions This Week</Text>
      <Text style={INSIGHT_STYLES.sub}>Goal: 3+</Text>
    </View>
  ),

  // Card 2: Top System
  (
    <View
  key="insight-2"
  style={[
    INSIGHT_CARD_CONTAINER,
    { opacity: insightIndex === 1 ? 1 : 0.92 },
  ]}
>
      <Text style={INSIGHT_STYLES.hero} numberOfLines={2}>
       {topSystemThisWeek ? resolveSystemLabel(topSystemThisWeek.systemId) : "—"}
      </Text>
      <Text style={INSIGHT_STYLES.title}>Top System</Text>
      <Text style={INSIGHT_STYLES.sub}>
        {topSystemThisWeek
  ? `${topSystemThisWeek.count} session${topSystemThisWeek.count === 1 ? "" : "s"}`
  : ""}
      </Text>
    </View>
  ),

  // Card 3: Top Technique
  (
    <View
  key="insight-3"
  style={[
    INSIGHT_CARD_CONTAINER,
    { opacity: insightIndex === 2 ? 1 : 0.92 },
  ]}
>
     <Text
      style={INSIGHT_STYLES.hero}
      numberOfLines={1}
      ellipsizeMode="tail"
      >
      {topTechniqueThisWeek
  ? resolveTechniqueLabelById(TECH_INDEX, topTechniqueThisWeek.techniqueId)
  : "—"}
    </Text>
      <Text style={INSIGHT_STYLES.title}>Top Technique</Text>
      <Text style={INSIGHT_STYLES.sub}>
        {topTechniqueThisWeek
          ? `${topTechniqueThisWeek.count} session${topTechniqueThisWeek.count === 1 ? "" : "s"}`
          : ""}
      </Text>
    </View>
  ),

  // Card 4: Current Focus (14d)
(
  <View
    key="insight-4"
    style={[
      INSIGHT_CARD_CONTAINER,
      { opacity: insightIndex === 3 ? 1 : 0.92 },
    ]}
  >
    <Text
      style={INSIGHT_STYLES.hero}
      numberOfLines={2}
      ellipsizeMode="tail"
    >
      {currentFocusSystem14d
        ? resolveSystemLabel(currentFocusSystem14d.systemId)
        : "—"}
    </Text>

    <Text style={INSIGHT_STYLES.title}>Current Focus (14d)</Text>

    <Text style={INSIGHT_STYLES.sub}>
      {currentFocusSystem14d
        ? `${currentFocusSystem14d.count} session${currentFocusSystem14d.count === 1 ? "" : "s"}`
        : ""}
    </Text>
  </View>
),
// Card 5: Gi vs No-Gi (14d)
(
  <View
    key="insight-5"
    style={[
      INSIGHT_CARD_CONTAINER,
      { opacity: insightIndex === 4 ? 1 : 0.92 },
    ]}
  >
    <Text style={INSIGHT_STYLES.hero}>
      {giNoGi14d ? giNoGi14d.primary : "—"}
    </Text>
    <Text style={INSIGHT_STYLES.title}>Gi vs No-Gi (14d)</Text>
    <Text style={INSIGHT_STYLES.sub}>
      {giNoGi14d ? `Gi ${giNoGi14d.gi} • No-Gi ${giNoGi14d.nogi}` : ""}
    </Text>
  </View>
),

  // Card 6: Weekly Goal Streak
  (
    <View
  key="insight-6"
  style={[
    INSIGHT_CARD_CONTAINER,
    { opacity: insightIndex === 5 ? 1 : 0.92 },
  ]}
>
      <Text style={INSIGHT_STYLES.hero}>{displayWeekStreak}</Text>
      <Text style={INSIGHT_STYLES.title}>Weekly Goal Streak</Text>
      <Text style={INSIGHT_STYLES.sub}>3+ sessions/week</Text>
    </View>
  ),

  // Card 7: Consistency Trend (4w)
  (
    <View
      key="insight-7"
      style={[
        INSIGHT_CARD_CONTAINER,
        { opacity: insightIndex === 6 ? 1 : 0.92 },
      ]}
    >
      <Text style={INSIGHT_STYLES.hero}>
        {trendDelta === 0
          ? "—"
          : (trendDelta > 0 ? "+" : "−") + String(Math.abs(trendDelta))}
      </Text>

      <Text style={INSIGHT_STYLES.title}>Consistency Trend (4w)</Text>
      <Text style={INSIGHT_STYLES.sub}>
        {(weekTotals4w[0] ?? 0)} this week • {(weekTotals4w[1] ?? 0)} last week
      </Text>
    </View>
  ),
];
const insightsCount = insightCards.length;
const showDots = insightsCount > 1;
const snapEnabled = insightsCount > 1;
const safeInsightIndex = Math.max(0, Math.min(insightIndex, insightsCount - 1));



  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    for (const date of Object.keys(sessionsByDate)) {
      marks[date] = { marked: true };
    }
    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: UI.accent,
    };
    return marks;
  }, [sessionsByDate, selectedDate]);

  // A2) Canonical list (single source of truth)
const allSessionsSorted = useMemo(() => {
  return sessions.slice().sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return bTime - aTime; // newest first
  });
}, [sessions]);
  // A3.1 Day list (from canonical list)
const todaysSessionsRaw = useMemo(() => {
  return allSessionsSorted.filter((s) => toDateKey(s.date) === toDateKey(selectedDate));
}, [allSessionsSorted, selectedDate]);
const baseSessionsRaw = useMemo<Session[]>(() => {
  return viewMode === "week" ? weekSessionsRaw : todaysSessionsRaw;
}, [viewMode, weekSessionsRaw, todaysSessionsRaw]);

const filteredSessions = useMemo(() => {
  if (systemFilter === "ALL") return baseSessionsRaw ?? [];
  return baseSessionsRaw.filter((s) => s.system === systemFilter);
}, [baseSessionsRaw, systemFilter]);

// 5X) Filter + sort helpers (used by week/day rendering)

const filterAndSort = useCallback(
  (list: Session[]) => {
    const q = searchQuery.trim().toLowerCase();

    return list
      .filter((s: Session) => {
        // System filter
        if (systemFilter !== "ALL" && s.system !== systemFilter) return false;

        // Search filter
        if (!q) return true;

        const haystack = [
          s.system,
          resolveSystemLabel(s.system),
          s.technique,
          s.drill,
          s.notes,
          s.youtubeUrl,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      })
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  },
  [systemFilter, searchQuery]
);
const searchedSessions = useMemo(() => {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return filteredSessions;

  return filteredSessions.filter((s) => {
    const haystack = [
      s.system,
      resolveSystemLabel(s.system),
      s.technique,
      s.drill,
      s.notes,
      s.youtubeUrl,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });
}, [filteredSessions, searchQuery]);

const weekHasVisibleSessions = useMemo(() => {
  if (viewMode !== "week") return true;

  for (const ymd of weekDates) {
    const dayListRaw: Session[] = weekSessionsByDate[ymd] ?? [];
    const dayList: Session[] = filterAndSort(dayListRaw);
    if (dayList.length > 0) return true;
  }

  return false;
}, [viewMode, weekDates, weekSessionsByDate, filterAndSort]);

const renderTitleAndIntro = () => (
  <>
    <Text style={{ fontSize: 24, fontWeight: "700", color: UI.textPrimary, letterSpacing: 0.3 }}>
      Training Calendar
    </Text>
    <Text style={{ color: UI.textSecondary, fontSize: 15, marginTop: 4 }}>
      Tap a date to view sessions, or add a new one for that day.
    </Text>
  </>
);
// 7B) Search bar row
const renderSearchBar = () => (
  <View
    style={{
      borderWidth: 1,
      borderColor: UI.border,
      backgroundColor: UI.bgCard,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    }}
  >
    <TextInput
      value={searchQuery}
      onChangeText={setSearchQuery}
      placeholder="Search your logged techniques, drills, and notes"
      placeholderTextColor={UI.textSecondary}
      autoCapitalize="none"
      style={{ color: UI.textPrimary, fontSize: 15, flex: 1 }}
    />

    {searchQuery.trim().length > 0 && (
      <TouchableOpacity
        onPress={() => setSearchQuery("")}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: UI.border,
          backgroundColor: UI.bgCardActive,
        }}
      >
        <Text style={{ color: UI.textSecondary, fontWeight: "700", fontSize: 12 }}>×</Text>
      </TouchableOpacity>
    )}
  </View>
);
const DAY_WEEK_CHIP_BASE = {
  flex: 1,
  padding: 10,
  borderRadius: 12,
  borderWidth: 1,
} as const;

const getDayWeekChipStyle = (isActive: boolean) => ({
  ...DAY_WEEK_CHIP_BASE,
  borderColor: isActive ? UI.border : UI.border,
  backgroundColor: isActive ? UI.bgCardActive : UI.bgCard,
});

const getDayWeekChipTitleStyle = (isActive: boolean) => ({
  color: UI.textPrimary,
  fontWeight: "800" as const,
});

const getDayWeekChipSubtitleStyle = (isActive: boolean) => ({
  color: UI.textSecondary,
});

// 7C) Day / Week header row
const renderDayWeekHeader = () => (
  <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
    <Pressable
      onPress={() => {
        setViewMode("day");
        setSelectedDate(today);
      }}
      style={getDayWeekChipStyle(isTodayActive)}
    >
      <Text style={getDayWeekChipTitleStyle(isTodayActive)}>Today</Text>
      <Text style={getDayWeekChipSubtitleStyle(isTodayActive)}>
        {(sessionsByDate[today]?.length ?? 0)} sessions
      </Text>
    </Pressable>

    <Pressable
      onPress={() => {
        setViewMode("day");
        setSelectedDate(yesterday);
      }}
      style={getDayWeekChipStyle(isYesterdayActive)}
    >
      <Text style={getDayWeekChipTitleStyle(isYesterdayActive)}>Yesterday</Text>
      <Text style={getDayWeekChipSubtitleStyle(isYesterdayActive)}>
        {(sessionsByDate[yesterday]?.length ?? 0)} sessions
      </Text>
    </Pressable>

    <Pressable
      onPress={() => {
        setViewMode("week");
        setSelectedDate(today);
        setWeekStartYMD(startOfWeekMondayYMD(today));
      }}
      style={getDayWeekChipStyle(isThisWeekActive)}
    >
      <Text style={getDayWeekChipTitleStyle(isThisWeekActive)}>This Week</Text>
      <Text style={getDayWeekChipSubtitleStyle(isThisWeekActive)}>
        {weekSessionsRaw.length} sessions
      </Text>
    </Pressable>
  </View>
);
// 7D) New session CTA row
const renderNewSessionCTA = () => (
  <Pressable
    onPress={() => router.push(`/training/new?date=${encodeURIComponent(selectedDate)}`)}
    style={({ pressed }) => ({
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderRadius: CARD_RADIUS,
      borderWidth: 1,
      borderColor: UI.border,
      backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
      alignItems: "center",
      justifyContent: "center",
    })}
  >
    <Text style={{ color: UI.textPrimary, fontSize: 16, fontWeight: "700", textAlign: "center" }}>
      Add Session for Selected Day
    </Text>
  </Pressable>
);
  // Main Return.
  return (
  <View style={{ flex: 1, backgroundColor: UI.screenBg }}>
    <ScrollView
    keyboardShouldPersistTaps="handled"
    keyboardDismissMode="on-drag"
    directionalLockEnabled
    contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 32, gap: 18 }}
    >
  <Pressable
  onPress={openBetaFeedbackEmail}
  style={({ pressed }) => ({
    marginTop: 4,
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
  })}
>
  <Text style={{ color: UI.textPrimary, fontSize: 15, fontWeight: "700" }}>
    Send Beta Feedback
  </Text>
  <Text style={{ color: UI.textSecondary, fontSize: 13, marginTop: 4 }}>
    Email support@ortizdigitalstudio.com
  </Text>
</Pressable>    
      {renderTitleAndIntro()}

      <Text style={[SECTION_LABEL, { marginTop: 4 }]}>
        LOG TRAINING
      </Text>

      <Calendar
        markedDates={markedDates}
        onDayPress={(day) => setSelectedDate(day.dateString)}
      />

      {renderNewSessionCTA()}
      {renderDayWeekHeader()}

      <Text style={[SECTION_LABEL, { marginTop: 8 }]}>
        REVIEW TRAINING
      </Text>

      {renderSearchBar()}

{/* 6E Sessions list */}
{viewMode === "week" ? (
  <View style={{ flex: 1 }}>
    {/* Swipe rail: captures horizontal swipes to change week WITHOUT stealing vertical scroll or Pressables.
        Keep handlers on this invisible rail only (not the whole list). */}

  {/* Week header (uses the same source-of-truth as swipe: weekStartYMD) */}
  	{/* Important: clips swipe rail so it can't steal taps on first row */}
  <View style={{ gap: 2, marginTop: 6, position: "relative", overflow: "hidden" }}>
    <View
      {...panResponder.panHandlers}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 80,
        zIndex: 10,
      }}
    />
  <Text style={{ fontSize: 18, fontWeight: "800", color: UI.textPrimary }}>
    This Week
  </Text>

  <Text style={{ color: UI.textSecondary, fontWeight: "600", fontSize: 13 }}>
    {weekStartYMD} → {addDaysYMD(weekStartYMD, 6)}
  </Text>

  </View>
    {!weekHasVisibleSessions ? (
      <View
        style={{
          marginTop: 14,
          padding: 18,
          borderRadius: CARD_RADIUS,
          borderWidth: 1,
          borderColor: UI.border,
          backgroundColor: UI.bgCard,
          gap: 8,
        }}
      >
        <Text style={{ color: UI.textPrimary, fontWeight: "700", fontSize: 15 }}>
          {weekSessionsRaw.length === 0 ? "No sessions this week yet" : "No sessions match your search"}
        </Text>

        <Text style={{ color: UI.textSecondary, fontSize: 13 }}>
          {weekSessionsRaw.length === 0
            ? "Log a session to start building your weekly streak."
            : "Try clearing your search to see your sessions for this week."}
        </Text>
      </View>
    ) : null}
    {weekDates.map((ymd) => {
      const dayListRaw: Session[] = weekSessionsByDate[ymd] ?? [];
      const dayList: Session[] = filterAndSort(dayListRaw);
      if (dayList.length === 0) return null;

      return (
  <View key={ymd} style={{ gap: 8, marginBottom: 10 }}>
    <Pressable
  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
  pressRetentionOffset={12}
  onPress={() =>
    setExpandedDays((prev) => ({ ...prev, [ymd]: !prev[ymd] }))
  }
  style={{
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.bgCard,
    flexDirection: "row",
    alignItems: "center",
    opacity: expandedDays[ymd] ? 1 : 0.92,
    justifyContent: "space-between",
  }}
>
            <Text style={{ color: UI.textPrimary, fontWeight: "800", fontSize: 14 }}>
              {dayLabel(ymd)}
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: UI.textSecondary, fontWeight: "700", fontSize: 12 }}>
            {(expandedDays[ymd] ? "Hide sessions" : "Show sessions") + " • " + dayList.length}
            </Text>
              <Text style={{ color: UI.textSecondary, fontWeight: "800" }}>
                {expandedDays[ymd] ? "▾" : "▸"}
              </Text>
            </View>
          </Pressable>

          {expandedDays[ymd] && (
            <>
              {dayList.map((s) => {
                const badges = sessionBadges(s);

                return (
                  <Pressable
                    key={s.id}
                    onPress={(e) => {
  // If a child handled the tap (YT pill), don’t navigate.
  if ((e as any)?.defaultPrevented) return;
  router.push(`/training/${s.id}`);
}}
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: 14,
                      borderRadius: CARD_RADIUS,
                      borderWidth: 1,
                      borderColor: UI.border,
                      backgroundColor: UI.bgCard,
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                     <Text
                      style={{ fontWeight: "700", color: UI.textPrimary, flex: 1, flexShrink: 1, minWidth: 0 }}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {sessionTitle(s)}
                    </Text>
                       {badges.length > 0 && (
                        <View style={{ flexDirection: "row", gap: 6 }}>
                       {badges.map((b) => {
  const label = String(b);
  const action = getBadgeAction(label, s);
  const isInteractive = !!action;

  return (
    <Pressable
      key={label}
      disabled={!isInteractive}
      onPress={(e) => {
        if (!action) return;

        // stop the row Pressable from also firing
        e.stopPropagation?.();
        (e as any).preventDefault?.();

        if (action.type === "yt") {
          openUrl(action.uri);
          return;
        }

        // IMG / VID
        setPreview({
  type: action.type,
  uri: action.uri,
  assetId: action.type === "image" ? s.imageAssetId : s.videoAssetId,
});
      }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={{
        opacity: isInteractive ? 1 : 0.35,
        // keep the rest of your existing pill style lines BELOW this
      }}
    >
                                <View
                                  style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 999,
                                    backgroundColor: UI.bgCardActive,
                                    borderWidth: 1,
                                    borderColor: UI.border,
                                  }}
                                >
                                  <Text style={{ color: UI.textSecondary, fontSize: 12, fontWeight: "700" }}>
                                    {label}
                                  </Text>
                                </View>
                              </Pressable>
                            );
                              })}
                              </View>
                            )}

                    </View>

                    {!!sessionSummary(s) && (
                      <Text
                        style={{ color: UI.textSecondary, fontSize: 14 }}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                      {sessionSummary(s)}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </>
          )}
  </View>
      );
    })}
  </View>
  ) : searchedSessions.length === 0 ? (
  <View
    style={{
      marginTop: 14,
      padding: 18,
      borderRadius: CARD_RADIUS,
      borderWidth: 1,
      borderColor: UI.border,
      backgroundColor: UI.bgCard,
      gap: 8,
    }}
  >
    <Text style={{ color: UI.textPrimary, fontWeight: "700", fontSize: 15 }}>
      No sessions yet
    </Text>

    <Text style={{ color: UI.textSecondary, fontSize: 14 }}>
      For this date.
    </Text>

    <Text style={{ color: UI.textSecondary, fontSize: 13 }}>
      Tap Add Session for Selected Day to log one.
    </Text>
  </View>
) : (
  <>
    {searchedSessions.map((s) => {
      const badges = sessionBadges(s);

      return (
        <Pressable
          key={s.id}
          onPress={(e) => {
          // If a child already handled the tap (YT pill), don't navigate.
          if ((e as any)?.defaultPrevented) return;
          router.push(`/training/${s.id}`);
        }}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 14,
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
            gap: 6,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
            }}
          >
            <Text
              style={{ fontWeight: "700", color: UI.textPrimary, flex: 1, flexShrink: 1, minWidth: 0 }}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {sessionTitle(s)}
            </Text>

            {badges.length > 0 && (
              <View style={{ flexDirection: "row", gap: 6 }}>
               {badges.map((b) => {
  const label = String(b);
  const action = getBadgeAction(label, s);
  const isInteractive = !!action;

  return (
    <Pressable
      key={label}
      disabled={!isInteractive}
      onPress={(e) => {
        if (!action) return;

        // stop the row Pressable from also firing
        e.stopPropagation?.();
        (e as any).preventDefault?.();

        if (action.type === "yt") {
          openUrl(action.uri);
          return;
        }

        // IMG / VID
        setPreview({
  type: action.type,
  uri: action.uri,
  assetId: action.type === "image" ? s.imageAssetId : s.videoAssetId,
});
      }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={{ opacity: isInteractive ? 1 : 0.35 }}
    >
      {/* keep your existing pill UI exactly like week renderer */}
      <View
        style={{
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: UI.bgCardActive,
          borderWidth: 1,
          borderColor: UI.border,
        }}
      >
        <Text style={{ color: UI.textSecondary, fontSize: 12, fontWeight: "700" }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
})}
              </View>
            )}

          </View>

          {!!sessionSummary(s) && (
            <Text
              style={{ color: UI.textSecondary, fontSize: 14 }}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {sessionSummary(s)}
            </Text>
          )}

        </Pressable>
      );
    })}
  </>
)}

{/* Insights */}
{isLoadingSessions ? null : (
  <View style={{ marginTop: 10, marginBottom: 6 }} pointerEvents="box-none">
    <View style={{ position: "relative" }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        directionalLockEnabled
        decelerationRate="fast"
        snapToAlignment="center"
        bounces={false}
        snapToInterval={snapEnabled ? SNAP : undefined}
        disableIntervalMomentum={snapEnabled}
        onMomentumScrollEnd={
          snapEnabled
            ? (e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / SNAP);
                setInsightIndex(index);
              }
            : undefined
        }
        contentContainerStyle={{
          paddingVertical: 8,
          paddingLeft: SIDE_PAD,
          paddingRight: SIDE_PAD,
        }}
      >
        {insightCards.map((card, i) => (
          <View key={i}>{card}</View>
        ))}
      </ScrollView>

      {showDots && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 10,
            left: 0,
            right: 0,
            flexDirection: "row",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {Array.from({ length: insightsCount }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  i === safeInsightIndex
                    ? "#111827"
                    : "#d1d5db",
              }}
            />
          ))}
        </View>
      )}
    </View>
  </View>
)}

<Pressable
        onPress={refresh}
        style={({ pressed }) => ({
          marginTop: 8,
          paddingVertical: 12,
          paddingHorizontal: 18,
          borderRadius: CARD_RADIUS,
          borderWidth: 1,
          borderColor: UI.border,
          backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
          alignSelf: "flex-start",
        })}
      >
        <Text style={{ color: UI.textSecondary, fontSize: 14, fontWeight: "600" }}>↻ Refresh</Text>
      </Pressable>
</ScrollView>
<Modal
  visible={!!preview}
  transparent
  animationType="fade"
  onRequestClose={() => setPreview(null)}
>
  <Pressable
    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)" }}
    onPress={() => setPreview(null)}
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
        onPress={() => setPreview(null)}
        style={{ alignSelf: "flex-end", paddingVertical: 10, paddingHorizontal: 12 }}
      >
        <Text style={{ color: "white", fontSize: 16 }}>Close</Text>
      </Pressable>

    {preview && preview.type === "video" && (
  <View style={{ width: "100%", gap: 12 }}>
    {playableVideoUri ? (
      <Video
        source={{ uri: playableVideoUri }}
        style={{ width: "100%", height: Math.round(SCREEN_W * 0.9), borderRadius: 12 }}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
      />
    ) : (
      <Text style={{ color: "white" }}>
        Resolving video from camera roll...
      </Text>
    )}
  </View>
)}
{preview && preview.type === "image" && (
  <Image
    source={{ uri: preview.uri }}
    style={{ width: "100%", height: Math.round(SCREEN_W * 0.9), borderRadius: 12 }}
    resizeMode="contain"
  />
)}
    </Pressable>
  </Pressable>
</Modal>
</View>
);
}

