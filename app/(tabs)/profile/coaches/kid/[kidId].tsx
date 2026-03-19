import { Stack, router, useLocalSearchParams } from "expo-router";
import { ResizeMode, Video } from "expo-av";
import * as MediaLibrary from "expo-media-library";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Linking,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useFocusEffect } from "@react-navigation/native";

import {
  getKidsById,
  getLatestKidWeeklyFocusForWeek,
  patchKidWeeklyFocusCoachFields,
  startOfWeekMondayYMD,
  todayYMD,
} from "../../../../../src/storage/coachKidStore";
import { getKidCompetitionEntriesForKid } from "../../../../../src/storage/kidCompetitionStore";
import type {
  CoachOutcome,
  KidCompetitionEntry,
  KidCompetitionResult,
  KidWeeklyFocusEntry,
} from "../../../../../src/types/coachKid";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  bgCardActive: "#edf2ff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
};

const CARD_RADIUS = 16;
const SCREEN_W = Dimensions.get("window").width;

type VideoPreviewState = { type: "video"; uri: string; assetId?: string | null };

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

function competitionResultLabel(r: KidCompetitionResult): string {
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

function formatMonthHeading(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  const d = new Date(y, m - 1, 1);
  if (Number.isNaN(d.getTime())) return monthKey;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
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
  const [currentWeekEntry, setCurrentWeekEntry] = useState<KidWeeklyFocusEntry | null>(null);

  const [outcomeDraft, setOutcomeDraft] = useState<CoachOutcome>("not_yet");
  const [notesDraft, setNotesDraft] = useState<string>("");
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [competitions, setCompetitions] = useState<KidCompetitionEntry[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [videoPreview, setVideoPreview] = useState<VideoPreviewState | null>(null);
  const [playableVideoUri, setPlayableVideoUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!kidId || !weekStartYMD) return;
    setReady(false);
    try {
      const kids = await getKidsById();
      const kid = kids[kidId];
      setKidName(kid?.name ?? "—");

      const entry = await getLatestKidWeeklyFocusForWeek(kidId, weekStartYMD);
      setCurrentWeekEntry(entry);

      const initialOutcome: CoachOutcome = entry?.coachOutcome ?? "not_yet";
      setOutcomeDraft(initialOutcome);
      setNotesDraft(entry?.coachNotes ?? "");

      const compRows = await getKidCompetitionEntriesForKid(kidId);
      setCompetitions(compRows);
    } finally {
      setReady(true);
    }
  }, [kidId, weekStartYMD]);

  const monthGroups = useMemo(
    () => groupCompetitionsByMonth(competitions),
    [competitions],
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
      setPlayableVideoUri(null);

      if (!videoPreview || videoPreview.type !== "video") return;

      const resolved = await resolveMediaUri(videoPreview.uri, videoPreview.assetId ?? null);
      if (cancelled) return;

      setPlayableVideoUri(resolved);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [videoPreview]);

  useEffect(() => {
    if (!kidId) {
      Alert.alert("Missing kid id", "This pilot route requires a kid selection.");
      router.replace("/profile/coaches/kids");
    }
  }, [kidId]);

  const canEditOutcome = Boolean(currentWeekEntry);

  const focusTitle = currentWeekEntry?.title ?? null;

  const onSaveOutcome = useCallback(async () => {
    if (!currentWeekEntry) return;
    setSavingOutcome(true);
    try {
      await patchKidWeeklyFocusCoachFields(currentWeekEntry.id, {
        coachOutcome: outcomeDraft,
        coachNotes: notesDraft.trim() ? notesDraft : undefined,
      });
      await load();
    } finally {
      setSavingOutcome(false);
    }
  }, [currentWeekEntry, notesDraft, outcomeDraft, load]);

  return (
    <>
      <Stack.Screen options={{ title: "Kid (Pilot)" }} />
      <KeyboardAwareScrollView
        enableOnAndroid
        extraScrollHeight={80}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: UI.screenBg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
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
          Kid-specific weekly focus tracking (internal pilot).
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
          <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "700", color: UI.textSecondary }}>
            THIS WEEK
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
                  YT
                </Text>
              </Pressable>
            ) : null}
          </View>

          {focusTitle ? (
            <Text style={{ fontSize: 13, color: UI.textSecondary }}>
              Saved for week of <Text style={{ fontWeight: "700" }}>{weekStartYMD}</Text>
            </Text>
          ) : (
            <Text style={{ fontSize: 13, color: UI.textSecondary }}>
              Choose a weekly focus to start building kid history over time.
            </Text>
          )}

          <Pressable
            onPress={() => router.push(`/profile/coaches/kid/${kidId}/weekly-focus`)}
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
              Set Weekly Focus
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push(`/profile/coaches/kid/${kidId}/history`)}
            style={({ pressed }) => ({
              marginTop: 6,
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
              View History
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
            OPTIONAL COACH OUTCOME + NOTES
          </Text>

          {!canEditOutcome ? (
            <Text style={{ fontSize: 13, color: UI.textSecondary }}>
              Set weekly focus first to enable outcome tracking.
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

              <TextInput
                value={notesDraft}
                onChangeText={setNotesDraft}
                placeholder="Coach notes (optional)"
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
                  Save Outcome / Notes
                </Text>
              </Pressable>
            </>
          )}
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
          }}
        >
          <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "700", color: UI.textSecondary }}>
            COMPETITION
          </Text>
          <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 20 }}>
            Tournament log for this kid (local pilot). Grouped by month.
          </Text>

          <Pressable
            onPress={() =>
              router.push(`/profile/coaches/kid/${kidId}/competition/edit`)
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
              Add competition
            </Text>
          </Pressable>

          {ready && competitions.length === 0 ? (
            <View
              style={{
                marginTop: 4,
                paddingVertical: 14,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: "#f9fafb",
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary }}>
                No competition entries yet
              </Text>
              <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 18 }}>
                Add a tournament name, date, result, notes, and optional video.
              </Text>
            </View>
          ) : null}
          {ready && competitions.length > 0 ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              {monthGroups.map(({ monthKey, entries }) => {
                const expanded = expandedMonths.has(monthKey);
                const chevron = expanded ? "▼" : "▶";
                return (
                  <View
                    key={monthKey}
                    style={{
                      borderRadius: 12,
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
                          {formatMonthHeading(monthKey)}
                        </Text>
                        <Text style={{ marginTop: 2, fontSize: 12, color: UI.textSecondary }}>
                          {entries.length} {entries.length === 1 ? "event" : "events"}
                        </Text>
                      </View>
                    </Pressable>

                    {expanded ? (
                      <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
                        {entries.map((row) => (
                          <Pressable
                            key={row.id}
                            onPress={(e) => {
                              if ((e as { defaultPrevented?: boolean })?.defaultPrevented) return;
                              router.push(
                                `/profile/coaches/kid/${kidId}/competition/edit?entryId=${encodeURIComponent(row.id)}`,
                              );
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
                                justifyContent: "space-between",
                                gap: 10,
                                alignItems: "center",
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
                                numberOfLines={2}
                                ellipsizeMode="tail"
                              >
                                {row.tournamentName}
                              </Text>
                              {row.videoUri?.trim() ? (
                                <Pressable
                                  onPress={(e) => {
                                    e.stopPropagation?.();
                                    (e as { preventDefault?: () => void }).preventDefault?.();
                                    setVideoPreview({
                                      type: "video",
                                      uri: row.videoUri!.trim(),
                                      assetId: row.videoAssetId ?? null,
                                    });
                                  }}
                                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
                                    <Text
                                      style={{
                                        color: UI.textSecondary,
                                        fontSize: 12,
                                        fontWeight: "700",
                                      }}
                                    >
                                      VID
                                    </Text>
                                  </View>
                                </Pressable>
                              ) : null}
                            </View>
                            <Text style={{ fontSize: 12, color: UI.textSecondary }}>
                              {row.eventDate} · {competitionResultLabel(row.result)}
                            </Text>
                            {row.coachNotes ? (
                              <Text
                                style={{ fontSize: 12, color: UI.textSecondary }}
                                numberOfLines={2}
                              >
                                {row.coachNotes}
                              </Text>
                            ) : null}
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}
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
        visible={!!videoPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setVideoPreview(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)" }}
          onPress={() => setVideoPreview(null)}
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
              onPress={() => setVideoPreview(null)}
              style={{ alignSelf: "flex-end", paddingVertical: 10, paddingHorizontal: 12 }}
            >
              <Text style={{ color: "white", fontSize: 16 }}>Close</Text>
            </Pressable>

            {videoPreview && videoPreview.type === "video" ? (
              <View style={{ width: "100%", gap: 12 }}>
                {playableVideoUri ? (
                  <Video
                    source={{ uri: playableVideoUri }}
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
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

