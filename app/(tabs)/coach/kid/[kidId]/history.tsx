import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import {
  getKidWeeklyFocusEntriesForKid,
  startOfWeekMondayYMD,
  todayYMD,
} from "../../../../../src/storage/coachKidStore";
import type { CoachOutcome, KidWeeklyFocusEntry } from "../../../../../src/types/coachKid";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
};

const CARD_RADIUS = 16;

function formatWeekShort(weekStartYMD: string) {
  const d = new Date(`${weekStartYMD}T00:00:00`);
  if (Number.isNaN(d.getTime())) return weekStartYMD;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function outcomeLabel(o?: CoachOutcome) {
  if (!o) return null;
  switch (o) {
    case "not_yet":
      return "Not yet";
    case "developing":
      return "Developing";
    case "on_track":
      return "On track";
  }
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

function entryHasCoachReflection(e: KidWeeklyFocusEntry) {
  return (
    typeof e.coachOutcome !== "undefined" || Boolean((e.coachNotes ?? "").trim())
  );
}

function openEntryEditor(kidId: string, entry: KidWeeklyFocusEntry) {
  const hasCoach = entryHasCoachReflection(entry);

  const goFocus = () =>
    router.push({
      pathname: "/coach/kid/[kidId]/weekly-focus",
      params: { kidId, entryId: entry.id },
    });

  const goProgress = () =>
    router.push({
      pathname: "/coach/kid/[kidId]/progress-reflection",
      params: { kidId, entryId: entry.id },
    });

  if (!hasCoach) {
    goFocus();
    return;
  }

  Alert.alert("Edit log entry", "This save includes weekly focus details and/or progress notes.", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Focus & video link",
      onPress: goFocus,
    },
    {
      text: "Outcome / notes",
      onPress: goProgress,
    },
  ]);
}

function groupEntriesByWeek(entries: KidWeeklyFocusEntry[]): {
  weekStartYMD: string;
  entries: KidWeeklyFocusEntry[];
}[] {
  const map = new Map<string, KidWeeklyFocusEntry[]>();
  for (const e of entries) {
    const arr = map.get(e.weekStartYMD) ?? [];
    arr.push(e);
    map.set(e.weekStartYMD, arr);
  }
  const keys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
  return keys.map((weekStartYMD) => ({
    weekStartYMD,
    entries: map.get(weekStartYMD)!,
  }));
}

export default function KidWeeklyHistoryScreen() {
  const params = useLocalSearchParams<{ kidId?: string }>();
  const kidId = params.kidId ? String(params.kidId) : "";

  const weekStartYMD = useMemo(() => {
    if (!kidId) return "";
    return startOfWeekMondayYMD(todayYMD());
  }, [kidId]);

  const [ready, setReady] = useState(false);
  const [kidsHistory, setKidsHistory] = useState<KidWeeklyFocusEntry[]>([]);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (weekStartYMD) {
      setExpandedWeeks(new Set([weekStartYMD]));
    }
  }, [weekStartYMD]);

  const load = useCallback(async () => {
    if (!kidId) return;
    setReady(false);
    try {
      const entries = await getKidWeeklyFocusEntriesForKid(kidId);
      setKidsHistory(entries);
    } finally {
      setReady(true);
    }
  }, [kidId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const weekGroups = useMemo(
    () => groupEntriesByWeek(kidsHistory),
    [kidsHistory],
  );

  const toggleWeek = useCallback((week: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week);
      else next.add(week);
      return next;
    });
  }, []);

  const hasHistory = kidsHistory.length > 0;

  return (
    <>
      <Stack.Screen options={{ title: "Kid Weekly History (Pilot)" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: UI.screenBg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <Pressable
          onPress={() => router.push(`/coach/kid/${kidId}`)}
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
          <Text style={{ fontSize: 14, color: UI.textPrimary }}>Back to Kid</Text>
        </Pressable>

        <Text style={{ fontSize: 22, fontWeight: "900", marginBottom: 6, color: UI.textPrimary }}>
          Weekly History
        </Text>
        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
          Focus logs grouped by week (internal pilot).
        </Text>

        <View style={{ height: 16 }} />

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
          <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "800", color: UI.textSecondary }}>
            FOCUS HISTORY
          </Text>

          {!ready ? (
            <Text style={{ fontSize: 13, color: UI.textSecondary }}>Loading…</Text>
          ) : !hasHistory ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: UI.textPrimary, fontWeight: "800" }}>No history yet</Text>
              <Text style={{ fontSize: 13, color: UI.textSecondary }}>
                Set a weekly focus for this kid to start building history over time.
              </Text>
              <Pressable
                onPress={() => router.push(`/coach/kid/${kidId}/weekly-focus`)}
                style={({ pressed }) => ({
                  marginTop: 8,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
                  alignSelf: "flex-start",
                })}
              >
                <Text style={{ fontSize: 14, color: UI.textPrimary, fontWeight: "900" }}>
                  Set Weekly Focus
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {weekGroups.map(({ weekStartYMD: w, entries }) => {
                const expanded = expandedWeeks.has(w);
                const chevron = expanded ? "▼" : "▶";
                const isThisWeek = w === weekStartYMD;
                return (
                  <View
                    key={w}
                    style={{
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: UI.border,
                      overflow: "hidden",
                    }}
                  >
                    <Pressable
                      onPress={() => toggleWeek(w)}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        backgroundColor: pressed ? "#f9fafb" : UI.bgCard,
                      })}
                    >
                      <Text style={{ fontSize: 14, color: UI.textSecondary, width: 22 }}>
                        {chevron}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "900", color: UI.textPrimary }}>
                          Week of {formatWeekShort(w)}
                          {isThisWeek ? " · This week" : ""}
                        </Text>
                        <Text style={{ marginTop: 2, fontSize: 12, color: UI.textSecondary }}>
                          {entries.length} {entries.length === 1 ? "log" : "logs"}
                        </Text>
                      </View>
                    </Pressable>

                    {expanded ? (
                      <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
                        {entries.map((entry) => {
                          const outcomeText = outcomeLabel(entry.coachOutcome);
                          return (
                            <Pressable
                              key={entry.id}
                              onPress={(e) => {
                                if ((e as { defaultPrevented?: boolean })?.defaultPrevented) return;
                                openEntryEditor(kidId, entry);
                              }}
                              style={({ pressed }) => ({
                                padding: 12,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: UI.border,
                                backgroundColor: pressed ? "#eef2ff" : "#f9fafb",
                                gap: 6,
                              })}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 14,
                                    fontWeight: "800",
                                    color: UI.textPrimary,
                                    flex: 1,
                                    minWidth: 0,
                                  }}
                                >
                                  {entry.title}
                                </Text>
                                {isUsableYoutubeUrl(entry.youtubeUrl) ? (
                                  <Pressable
                                    onPress={(ev) => {
                                      ev.stopPropagation?.();
                                      (ev as { preventDefault?: () => void }).preventDefault?.();
                                      void openYoutubeUrl(entry.youtubeUrl);
                                    }}
                                    style={({ pressed }) => ({
                                      paddingVertical: 6,
                                      paddingHorizontal: 10,
                                      borderRadius: 999,
                                      borderWidth: 1,
                                      borderColor: UI.border,
                                      backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
                                    })}
                                  >
                                    <Text
                                      style={{ fontSize: 11, fontWeight: "700", color: UI.textPrimary }}
                                    >
                                      YT
                                    </Text>
                                  </Pressable>
                                ) : null}
                              </View>
                              {outcomeText ? (
                                <Text style={{ fontSize: 12, color: UI.textSecondary }}>
                                  Outcome: {outcomeText}
                                </Text>
                              ) : null}
                              {entry.coachNotes ? (
                                <Text
                                  style={{ fontSize: 12, color: UI.textSecondary }}
                                  numberOfLines={3}
                                >
                                  Notes: {entry.coachNotes}
                                </Text>
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <Text style={{ marginTop: 12, fontSize: 12, color: UI.textSecondary, opacity: 0.9 }}>
          Internal pilot (coach-side)
        </Text>
      </ScrollView>
    </>
  );
}
