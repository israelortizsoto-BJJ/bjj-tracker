import AsyncStorage from "@react-native-async-storage/async-storage";

import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  Button,
  Keyboard,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { Calendar } from "react-native-calendars";

type Session = {
  id: string;
  createdAt: string;
  date: string; // YYYY-MM-DD
  system: string;
  technique: string;
  drill: string;
  notes: string;
  youtubeUrl: string;
  imageUri?: string | null;
  videoUri?: string | null;
};

const STORAGE_KEY = "bjj.sessions.v1";

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

function addDaysYMD(ymd: string, deltaDays: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaDays);
  return dateToYMD(date);
}

function sessionTitle(s: Session) {
  // Auto-title: System + Technique (fallbacks)
  const tech = (s.technique || "").trim();
  return tech ? `${s.system} • ${tech}` : s.system;
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
async function loadSessions(): Promise<Session[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}


const SYSTEMS = [
  "Guard Retention",
  "Half Guard",
  "Closed Guard",
  "Open Guard",
  "Passing",
  "Side Control",
  "Mount",
  "Back Control",
  "Escapes",
  "Takedowns",
  "Submissions",
];
const SYSTEM_FILTERS = ["All", ...SYSTEMS];

const UI = {
  bgCard: "#0f172a",       // softer than pure black
  bgCardActive: "#111827",
  border: "#233047",       // subtle border
  textPrimary: "#f8fafc",  // off-white (less harsh than white)
  textSecondary: "#cbd5e1",// muted gray
  textHeader: "#111827",   // slate dark for light surfaces
  badgeBg: "#111827",
};
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
  const [weekStartYMD, setWeekStartYMD] = useState(startOfWeekMondayYMD(todayYMD()));
  const [systemFilter, setSystemFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
// Collapsible week groups (expanded/collapsed by day)
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

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

// ------------------------------------------------------------
// 4) Data loading + sync (effects)
//    4A) refresh() -> loads AsyncStorage into state
//    4B) Effects: route param sync (params.date) + useFocusEffect refresh
// ------------------------------------------------------------  
const refresh = useCallback(async () => {
    const data = await loadSessions();
    setSessions(data);
  }, []);

useEffect(() => {
  if (typeof params.date === "string" && params.date) {
    setSelectedDate(params.date);
  }
}, [params.date]);

useFocusEffect(
  useCallback(() => {
    refresh();
  }, [refresh])
);
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

  const thisWeekCount = useMemo(() => weekSessionsRaw.length, [weekSessionsRaw]);
  const topSystemThisWeek = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const s of weekSessionsRaw) {
      const key = (s.system ?? "").trim();
      if (!key) continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }

    let bestKey = "";
    let bestCount = 0;

    // deterministic: highest count, then alphabetical
    for (const key of Object.keys(counts).sort()) {
      const c = counts[key]!;
      if (c > bestCount) {
        bestCount = c;
        bestKey = key;
      }
    }

    return bestKey ? { system: bestKey, count: bestCount } : null;
  }, [weekSessionsRaw]);

  const topTechniqueThisWeek = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const s of weekSessionsRaw) {
      const key = (s.technique ?? "").trim();
      if (!key) continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }

    let bestKey = "";
    let bestCount = 0;

    // deterministic: highest count, then alphabetical
    for (const key of Object.keys(counts).sort()) {
      const c = counts[key]!;
      if (c > bestCount) {
        bestCount = c;
        bestKey = key;
      }
    }

    return bestKey ? { technique: bestKey, count: bestCount } : null;
  }, [weekSessionsRaw]);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    for (const date of Object.keys(sessionsByDate)) {
      marks[date] = { marked: true };
    }
    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: "#2563eb",
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
  return allSessionsSorted.filter((s) => s.date === selectedDate);
}, [allSessionsSorted, selectedDate]);
const baseSessionsRaw = useMemo<Session[]>(() => {
  return viewMode === "week" ? weekSessionsRaw : todaysSessionsRaw;
}, [viewMode, weekSessionsRaw, todaysSessionsRaw]);

const filteredSessions = useMemo(() => {
  if (systemFilter === "All") return baseSessionsRaw ?? [];
  return baseSessionsRaw.filter((s) => s.system === systemFilter);
}, [baseSessionsRaw, systemFilter]);

// 5X) Filter + sort helpers (used by week/day rendering)

const filterAndSort = useCallback(
  (list: Session[]) => {
    const q = searchQuery.trim().toLowerCase();

    return list
      .filter((s: Session) => {
        // System filter
        if (systemFilter !== "All" && s.system !== systemFilter) return false;

        // Search filter
        if (!q) return true;

        const haystack = [s.system, s.technique, s.drill, s.notes, s.youtubeUrl]
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

const renderTitleAndIntro = () => (
  <>
    <Text style={{ fontSize: 22, fontWeight: "700" }}>Training Calendar</Text>
    <Text style={{ opacity: 0.8 }}>
      Tap a date to view sessions, or add a new one for that day.
    </Text>
  </>
);
// 7A) Filter chips row
const renderFilterChips = () => (
  <View style={{ marginTop: 6 }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {SYSTEM_FILTERS.map((name) => {
          const active = systemFilter === name;
          return (
            <Pressable
              key={name}
              onPress={() => setSystemFilter(name)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "#2a2a3a",
                backgroundColor: active ? "#1b1c2a" : "#161621",
              }}
            >
              <Text
                style={{
                  color: active ? "white" : "#cfcfe6",
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  </View>
);
// 7B) Search bar row
const renderSearchBar = () => (
  <View
    style={{
      borderWidth: 1,
      borderColor: "#2a2a3a",
      backgroundColor: "#161621",
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    }}
  >
    <TextInput
      value={searchQuery}
      onChangeText={setSearchQuery}
      placeholder="Search technique, drill, notes..."
      placeholderTextColor="#b9b9c4"
      autoCapitalize="none"
      style={{ color: "white", fontSize: 14, flex: 1 }}
    />

    {searchQuery.trim().length > 0 && (
      <TouchableOpacity
        onPress={() => setSearchQuery("")}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: "#2a2a3a",
          backgroundColor: "#1b1c2a",
        }}
      >
        <Text style={{ color: "#cfcfe6", fontWeight: "700", fontSize: 12 }}>×</Text>
      </TouchableOpacity>
    )}
  </View>
);
// 7C) Day / Week header row
const renderDayWeekHeader = () => (
  <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
    {/* Today button */}
    <Pressable
      onPress={() => {
        setViewMode("day");
        setSelectedDate(today);
      }}
      style={{
        flex: 1,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#2a2a3a",
        backgroundColor: selectedDate === today ? "#1b1c2a" : "#161621",
      }}
    >
      <Text style={{ color: "white", fontWeight: "800" }}>Today</Text>
      <Text style={{ color: "#b9b9c4" }}>
        {(sessionsByDate[today]?.length ?? 0)} sessions
      </Text>
    </Pressable>
    {/* Yesterday button */}
    <Pressable
    onPress={() => {
    setViewMode("day");
    setSelectedDate(yesterday);
  }}
  style={{
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: selectedDate === yesterday ? UI.bgCardActive : UI.bgCard,
  }}
>
  <Text style={{ color: UI.textPrimary, fontWeight: "800" }}>Yesterday</Text>
  <Text style={{ color: UI.textSecondary }}>
    {(sessionsByDate[yesterday]?.length ?? 0)} sessions
  </Text>
</Pressable>
    {/* This Week button */}
    <Pressable
      onPress={() => {
      setViewMode("week");
      setSelectedDate(today);
        
  // If you're not currently on the current week, snap back to current week.
      setWeekStartYMD(startOfWeekMondayYMD(today));
}}
      style={{
        flex: 1,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#2a2a3a",
        backgroundColor: viewMode === "week" ? "#1b1c2a" : "#161621",
      }}
    >
      <Text style={{ color: "white", fontWeight: "800" }}>This Week</Text>
      <Text style={{ color: "#b9b9c4" }}>
        {weekSessionsRaw.length} sessions
      </Text>
    </Pressable>
  </View>
);
// 7D) New session CTA row
const renderNewSessionCTA = () => (
  <View style={{ gap: 8 }}>
    <Button
      title="+ New Session for selected day"
      onPress={() =>
        router.push(`/training/new?date=${encodeURIComponent(selectedDate)}`)
      }
    />
  </View>
);
  // Main Return.  
  return (
  <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1 }}>
    <ScrollView
    keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      {renderTitleAndIntro()}

      <Calendar
        markedDates={markedDates}
        onDayPress={(day) => setSelectedDate(day.dateString)}
      />
{renderFilterChips()}
{renderSearchBar()}
{renderDayWeekHeader()}
{renderNewSessionCTA()}

{/* First Insight Moment */}
<View
  style={{
    marginTop: 10,
    marginBottom: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#0f172a", // dark slate
  }}
>
  <Text
    style={{
      color: "#e5e7eb", // near-white
      fontSize: 14,
      fontWeight: "800",
    }}
  >
    This week: {thisWeekCount} sessions
  </Text>
  <Text
  style={{
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  }}
>
  Top system:{" "}
  {topSystemThisWeek ? `${topSystemThisWeek.system} (${topSystemThisWeek.count})` : "—"}
</Text>
  <Text
  style={{
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  }}
>
  Top technique:{" "}
  {topTechniqueThisWeek
    ? topTechniqueThisWeek.technique + " (" + topTechniqueThisWeek.count + ")"
    : "—"}
</Text>
</View>

{/* Sessions list */}
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
  <Text style={{ fontSize: 18, fontWeight: "900", color: UI.textHeader }}>
    This Week
  </Text>

  <Text style={{ color: UI.textSecondary, fontWeight: "600", fontSize: 13 }}>
    {weekStartYMD} → {addDaysYMD(weekStartYMD, 6)}
  </Text>

  </View>
    {weekDates.map((ymd) => {
      const dayListRaw = weekSessionsByDate[ymd] ?? [];
      const dayList = filterAndSort(dayListRaw);
      if (dayList.length === 0) return null;

      return (
  <View key={ymd} style={{ gap: 8, marginBottom: 8 }}>
    <Pressable
  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
  pressRetentionOffset={12}
  onPress={() =>
    setExpandedDays((prev) => ({ ...prev, [ymd]: !prev[ymd] }))
  }
  style={{
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
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
                    onPress={() => router.push(`/training/${s.id}`)}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: "#2a2a3a",
                      backgroundColor: "#161621",
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
                      <Text style={{ fontWeight: "800", color: "white", flex: 1 }}>
                        {sessionTitle(s)}
                      </Text>

                      {badges.length > 0 && (
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          {badges.map((b) => (
                            <View
                              key={b}
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 999,
                                backgroundColor: "#1b1c2a",
                                borderWidth: 1,
                                borderColor: "#2a2a3a",
                              }}
                            >
                              <Text
                                style={{
                                  color: "#cfcfe6",
                                  fontSize: 12,
                                  fontWeight: "700",
                                }}
                              >
                                {b}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>

                    {!!sessionSummary(s) && (
                      <Text numberOfLines={2} style={{ color: "#b9b9c4" }}>
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
      marginTop: 10,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: UI.border,
      backgroundColor: UI.bgCard,
      gap: 6,
    }}
  >
    <Text style={{ color: UI.textPrimary, fontWeight: "800", fontSize: 14 }}>
      No sessions yet
    </Text>

    <Text style={{ color: UI.textSecondary, fontSize: 13 }}>
      {systemFilter !== "All" ? `for ${systemFilter}.` : "for this date."}
    </Text>

    <Text style={{ color: UI.textSecondary, fontSize: 13 }}>
      Tap + to add one.
    </Text>
  </View>
) : (
  <>
    {searchedSessions.map((s) => {
      const badges = sessionBadges(s);

      return (
        <Pressable
          key={s.id}
          onPress={() => router.push(`/training/${s.id}`)}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#2a2a3a",
            backgroundColor: "#161621",
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
            <Text style={{ fontWeight: "800", color: "white", flex: 1 }}>
              {sessionTitle(s)}
            </Text>

            {badges.length > 0 && (
              <View style={{ flexDirection: "row", gap: 6 }}>
                {badges.map((b) => (
                  <View
                    key={b}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: "#1b1c2a",
                      borderWidth: 1,
                      borderColor: "#2a2a3a",
                    }}
                  >
                    <Text
                      style={{
                        color: "#cfcfe6",
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {b}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {!!sessionSummary(s) && (
            <Text numberOfLines={2} style={{ color: "#b9b9c4" }}>
              {sessionSummary(s)}
            </Text>
          )}
        </Pressable>
      );
    })}
  </>
)}
<Button title="↻ Refresh" onPress={refresh} />
</ScrollView>
</View>
</TouchableWithoutFeedback>
);
}
  