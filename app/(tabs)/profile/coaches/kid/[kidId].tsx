import { useHeaderHeight } from "@react-navigation/elements";
import { Stack, router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ResizeMode, Video } from "expo-av";
import * as MediaLibrary from "expo-media-library";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getKidsById,
  getLatestKidWeeklyFocusForWeek,
  appendKidWeeklyFocus,
  getKidWeeklyFocusEntriesForKid,
  startOfWeekMondayYMD,
  todayYMD,
} from "../../../../../src/storage/coachKidStore";
import { getKidStandingGuidance } from "../../../../../src/storage/kidStandingGuidanceStore";
import { StorageKeys } from "../../../../../src/storage/storageKeys";
import { getKidCompetitionEntriesForKid } from "../../../../../src/storage/kidCompetitionStore";
import type { Session } from "../../../../../src/types";
import type {
  CoachOutcome,
  KidCompetitionEntry,
  KidCompetitionResult,
  KidStandingGuidance,
  KidWeeklyFocusEntry,
} from "../../../../../src/types/coachKid";
import { toDateKey } from "../../../../../src/_domain/dateKey";
import { FUNDAMENTALS_TAXONOMY } from "../../../../../src/fundamentals/taxonomy";

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

function sessionDrillNotesSummary(s: Session) {
  const drill = (s.drill || "").trim();
  const notes = (s.notes || "").trim();
  const parts: string[] = [];

  if (drill) parts.push(`Drill: ${drill}`);
  if (notes) parts.push(`Notes: ${notes}`);

  return parts.join(" • ");
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

  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const keyboardAwareRef = useRef<InstanceType<typeof KeyboardAwareScrollView> | null>(null);

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

  const load = useCallback(async (opts?: { prefillProgressInputs?: boolean }) => {
    if (!kidId || !weekStartYMD) return;
    const prefillProgressInputs = opts?.prefillProgressInputs ?? true;
    setReady(false);
    try {
      const kids = await getKidsById();
      const kid = kids[kidId];
      setKidName(kid?.name ?? "—");

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

      const compRows = await getKidCompetitionEntriesForKid(kidId);
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

  const canEditOutcome = Boolean(currentWeekEntry);

  const focusTitle = currentWeekEntry?.title ?? null;

  const standingHeadline = (standingGuidance?.headline ?? "").trim();
  const standingDetail = (standingGuidance?.detail ?? "").trim();
  const standingPrimary =
    standingHeadline || standingDetail;
  const standingSecondaryMuted =
    standingHeadline && standingDetail ? standingDetail : "";
  const standingIsActive = Boolean(standingPrimary);

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
          }}
        >
          <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "700", color: UI.textSecondary }}>
            This Week’s Private Session Focus
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {focusTitle && currentWeekEntry ? (
              <Pressable
                onPress={() =>
                  router.push(
                    `/profile/coaches/kid/${kidId}/weekly-focus?entryId=${encodeURIComponent(currentWeekEntry.id)}`,
                  )
                }
                style={({ pressed }) => ({
                  flex: 1,
                  minWidth: 0,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ fontSize: 16, fontWeight: "800", color: UI.textPrimary }}>
                  {focusTitle}
                </Text>
              </Pressable>
            ) : (
              <Text style={{ fontSize: 16, fontWeight: "800", color: UI.textPrimary, flex: 1, minWidth: 0 }}>
                {focusTitle ?? "No focus saved yet"}
              </Text>
            )}
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
          }}
        >
          <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "700", color: UI.textSecondary }}>
            This Week’s Training Sessions
          </Text>
          <Text style={{ fontSize: 13, color: UI.textSecondary }}>
            {kidWeekSessions.length}{" "}
            {kidWeekSessions.length === 1 ? "session" : "sessions"} logged
          </Text>

          <Pressable
            onPress={() =>
              router.push(
                `/training/new?date=${encodeURIComponent(
                  todayYMD(),
                )}&kidId=${encodeURIComponent(kidId)}`,
              )
            }
            style={({ pressed }) => ({
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
              Log Training for This Kid
            </Text>
          </Pressable>

          {kidWeekSessions.length === 0 ? (
            <Text style={{ fontSize: 13, color: UI.textSecondary }}>
              No training sessions logged yet for this week.
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {kidWeekSessions.slice(0, 3).map((s) => {
                const badges = sessionBadges(s);
                const summary = sessionDrillNotesSummary(s);

                return (
                  <Pressable
                    key={s.id}
                    onPress={(e) => {
                      if ((e as any)?.defaultPrevented) return;
                      router.push(`/training/${s.id}?kidId=${encodeURIComponent(kidId)}`);
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: 14,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: UI.border,
                      backgroundColor: pressed ? "#edf2ff" : "#f9fafb",
                      gap: 6,
                    })}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "800", color: UI.textPrimary }}>
                      {s.date} · {resolveSystemLabel(s.system)}
                    </Text>
                    <Text style={{ fontSize: 12, color: UI.textSecondary }} numberOfLines={4}>
                      {techniqueSummaryForKidSession(s)}
                    </Text>

                    {badges.length > 0 ? (
                      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                        {badges.map((label) => (
                          <Pressable
                            key={label}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              (e as any).preventDefault?.();

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
                        ))}
                      </View>
                    ) : null}

                    {summary ? (
                      <Text style={{ fontSize: 12, color: UI.textSecondary }} numberOfLines={2}>
                        {summary}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
              {kidWeekSessions.length > 3 ? (
                <Text style={{ fontSize: 12, color: UI.textSecondary }}>
                  +{kidWeekSessions.length - 3} more
                </Text>
              ) : null}
            </View>
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
                                        setMediaPreview({
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
            PROGRESS ON THIS WEEK’S FOCUS
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

              <Text style={{ marginTop: 4, fontSize: 12, color: UI.textSecondary, lineHeight: 16 }}>
                New notes start empty here. Each save adds an entry in the list below (history stays
                visible).
              </Text>

              <TextInput
                key={progressNotesInputKey}
                value={notesDraft}
                scrollEnabled={false}
                onChangeText={setNotesDraft}
                onFocus={bumpScrollToFocusedInput}
                onContentSizeChange={bumpScrollToFocusedInput}
                placeholder="Add new weekly progress notes"
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

          <View style={{ marginTop: 10, gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: UI.textSecondary }}>
              Saved weekly progress reflections (this week)
            </Text>

            {thisWeekReflections.length === 0 ? (
              <Text style={{ fontSize: 13, color: UI.textSecondary }}>
                No saved reflections yet.
              </Text>
            ) : (
              <>
                {thisWeekReflections.slice(0, 3).map((r) => {
                  const outcomeText =
                    typeof r.coachOutcome !== "undefined" ? outcomeLabel(r.coachOutcome) : null;
                  const notesText = (r.coachNotes ?? "").trim();
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() =>
                        router.push(
                          `/profile/coaches/kid/${kidId}/progress-reflection?entryId=${encodeURIComponent(r.id)}`,
                        )
                      }
                      style={({ pressed }) => ({
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: UI.border,
                        backgroundColor: pressed ? "#eef2ff" : "#f9fafb",
                        gap: 6,
                      })}
                    >
                      {outcomeText ? (
                        <Text style={{ fontSize: 12, color: UI.textSecondary }}>
                          Outcome: {outcomeText}
                        </Text>
                      ) : null}
                      {notesText ? (
                        <Text style={{ fontSize: 12, color: UI.textSecondary }} numberOfLines={3}>
                          Notes: {notesText}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
                {thisWeekReflections.length > 3 ? (
                  <Text style={{ fontSize: 12, color: UI.textSecondary }}>
                    +{thisWeekReflections.length - 3} more
                  </Text>
                ) : null}
              </>
            )}
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

