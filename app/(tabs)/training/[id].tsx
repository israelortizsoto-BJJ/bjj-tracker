import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { ResizeMode, Video } from "expo-av";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useDeviceRole } from "../../../src/deviceRole/DeviceRoleProvider";
import { toDateKey } from "../../../src/_domain/dateKey";
import { buildTechniqueIndex, getTechniqueById } from "../../../src/fundamentals/index";
import { FUNDAMENTALS_TAXONOMY } from "../../../src/fundamentals/taxonomy";
import {
  persistMediaFromCameraRoll,
  requestMediaLibraryPermission,
} from "../../../src/media/persistCameraRollMedia";
import { getSessions, setSessions } from "../../../src/storage/sessionsStore";
import type { Session, TechniqueEntry } from "../../../src/types";

// Fundamentals: build static search index once (do NOT move inside component)
const TECH_INDEX = buildTechniqueIndex(FUNDAMENTALS_TAXONOMY);

function techniqueToLabel(t: any): string {
  if (!t) return "";

  // If path is already a string, use it
  if (typeof t.path === "string") return t.path;

  // NEW shape: path.l1/ l2/ l3 with { id, label }
  if (t.path && typeof t.path === "object" && t.path.l1?.label) {
    const parts = [t.path.l1?.label, t.path.l2?.label, t.path.l3?.label].filter(Boolean);
    return parts.join(" > ") || "Selected technique";
  }

  // OLD/legacy shape: level1Label / level2Label
  if (t.path && typeof t.path === "object") {
    const parts = [t.path.level1Label, t.path.level2Label].filter(Boolean);
    return parts.join(" > ") || "Selected technique";
  }

  return "Selected technique";
}
// Block 2: Level 1 "Systems" from taxonomy (Option A)
// We store the *level1Id* in `system`, not the label.

// Block 2: Level 1 "Systems" from taxonomy
// We store the *level1Id* in `system`, not the label.

const TAX_L1 = FUNDAMENTALS_TAXONOMY;
const SYSTEMS_L1 = [
  { id: "ALL", label: "All" },
  ...TAX_L1.map((l1: { id: string; label: string }) => ({ id: l1.id, label: l1.label })),
];


function todayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
const RECENT_TECH_IDS_KEY = "mm.tech.recentIds.v1";
const FAVORITE_TECH_IDS_KEY = "mm.tech.favoriteIds.v1";



async function loadSessions(): Promise<Session[]> {
  return getSessions();
}

async function saveSessions(sessions: Session[]) {
  await setSessions(sessions);
}
// --- Tech Picker Prefs: Caps + Dedupe (Pure Helpers) ---
const RECENT_CAP = 3;
const FAVS_CAP = 5;

function normalizeId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  const v = id.trim();
  return v.length ? v : null;
}

function dedupePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function sanitizeIds(raw: unknown, cap: number): string[] {
  const arr = Array.isArray(raw) ? raw : [];
  const normalized = (arr.map(normalizeId).filter(Boolean) as string[]);
  return dedupePreserveOrder(normalized).slice(0, cap);
}

function sanitizeTechPickerPrefs(input: { recent: unknown; favs: unknown }) {
  return {
    recent: sanitizeIds(input.recent, RECENT_CAP),
    favs: sanitizeIds(input.favs, FAVS_CAP),
  };
}
// Technique picker prefs (Recent + Favorites)
async function loadTechPickerPrefs() {
  try {
    const [r, f] = await Promise.all([
      AsyncStorage.getItem(RECENT_TECH_IDS_KEY),
      AsyncStorage.getItem(FAVORITE_TECH_IDS_KEY),
    ]);

    const recent = r ? (JSON.parse(r) as string[]) : [];
    const favs = f ? (JSON.parse(f) as string[]) : [];

    return sanitizeTechPickerPrefs({ recent, favs });
  } catch {
    return { recent: [], favs: [] };
  }
}

async function saveRecentTechIds(next: string[]) {
  const cleaned = sanitizeIds(next, RECENT_CAP);
  await AsyncStorage.setItem(RECENT_TECH_IDS_KEY, JSON.stringify(cleaned));
}

async function saveFavoriteTechIds(next: string[]) {
  const cleaned = sanitizeIds(next, FAVS_CAP);
  await AsyncStorage.setItem(FAVORITE_TECH_IDS_KEY, JSON.stringify(cleaned));
}

// State Variables Block1 //
export default function TrainingSessionEditor() {
  const router = useRouter();
  const { role: deviceRole } = useDeviceRole();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const prefillDate = String(params.date || "");
  const prefillSystem = typeof params.system === "string" ? params.system : "";
  const effectivePrefillSystem =
  prefillSystem && prefillSystem !== "ALL" ? prefillSystem : "ALL";
  const sessionId = String(params.id || "");
  const kidIdParam =
    typeof params.kidId === "string" && params.kidId.trim()
      ? params.kidId.trim()
      : undefined;
  const isNew = useMemo(() => sessionId === "new", [sessionId]);
  const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const [draftId, setDraftId] = useState(makeId());

  const [loading, setLoading] = useState(true);
  const [system, setSystem] = useState<string>(effectivePrefillSystem);
  // v1 multi-technique: technique entries for this session.
  const [techniques, setTechniques] = useState<TechniqueEntry[]>([
    {
      id: makeId(),
      position: "",
      grips: "",
      finish: "",
      techniqueId: "",
      technique: "",
      customTechnique: "",
    },
  ]);

  // MVP taxonomy picker (new)
  const [gear, setGear] = useState<"gi" | "nogi">("gi");
  const [techPickerOpen, setTechPickerOpen] = useState(false);
  const [techQuery, setTechQuery] = useState("");
  // Which technique entry is currently being edited by the picker modal.
  const [pickerTargetIndex, setPickerTargetIndex] = useState<number | null>(0);

  function updateTechniqueAt(index: number, patch: Partial<TechniqueEntry>) {
    setTechniques((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...patch } : t))
    );
  }

  function addTechnique() {
    setTechniques((prev) => [
      ...prev,
      {
        id: makeId(),
        position: "",
        grips: "",
        finish: "",
        techniqueId: "",
        technique: "",
        customTechnique: "",
      },
    ]);
  }

  function removeTechnique(index: number) {
    setTechniques((prev) => {
      if (prev.length <= 1) return prev; // always keep at least one
      return prev.filter((_, i) => i !== index);
    });
  }

useEffect(() => {
  if (!techPickerOpen) return;

  (async () => {
    const { recent, favs } = await loadTechPickerPrefs();
    setRecentTechIds(recent);
    setFavoriteTechIds(favs);
  })();
}, [techPickerOpen]);

// Technique picker enhancements
type TechSortMode = "AZ" | "SYSTEM";
const [techSortMode, setTechSortMode] = useState<TechSortMode>("AZ");
const [recentTechIds, setRecentTechIds] = useState<string[]>([]);
const [favoriteTechIds, setFavoriteTechIds] = useState<string[]>([]);
const pushRecent = async (techId: string) => {
  const nextRaw = [techId, ...recentTechIds.filter((x) => x !== techId)];
  const next = sanitizeIds(nextRaw, RECENT_CAP);
  setRecentTechIds(next);
  await saveRecentTechIds(next);
};

const toggleFavorite = async (techId: string) => {
  const isFav = favoriteTechIds.includes(techId);

  const nextRaw = isFav
    ? favoriteTechIds.filter((x) => x !== techId)
    : [techId, ...favoriteTechIds];

  const next = sanitizeIds(nextRaw, FAVS_CAP);

  setFavoriteTechIds(next);
  await saveFavoriteTechIds(next);
};
const favoriteItems = useMemo(() => {
  const cappedIds = sanitizeIds(favoriteTechIds, FAVS_CAP);
  const items = cappedIds
    .map((id) => getTechniqueById(TECH_INDEX, id))
    .filter(Boolean) as any[];
 return items.sort((a, b) => String(a.label).localeCompare(String(b.label)));
}, [favoriteTechIds]);

const recentItems = useMemo(() => {
  const cappedIds = sanitizeIds(recentTechIds, RECENT_CAP);
  return cappedIds
    .map((id) => getTechniqueById(TECH_INDEX, id))
    .filter(Boolean) as any[];
}, [recentTechIds]);


// Legacy (keep for old sessions while we transition)
  const [notes, setNotes] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [date, setDate] = useState(prefillDate || todayYMD());
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [imageAssetId, setImageAssetId] = useState<string | null>(null);
  const [videoAssetId, setVideoAssetId] = useState<string | null>(null);
  const videoRef = useRef<Video>(null);
  const scrollRef = useRef<any>(null);
  const [videoKey, setVideoKey] = useState(0);

  const canSave = useMemo(() => {
    const hasTechniqueDetails = techniques.some((t) => {
      const pos = (t.position ?? "").trim();
      const gr = (t.grips ?? "").trim();
      const fin = (t.finish ?? "").trim();
      const tid = (t.techniqueId ?? "").trim();
      const legacyLabel = (t.technique ?? "").trim();
      const custom = (t.customTechnique ?? "").trim();
      return pos || gr || fin || tid || legacyLabel || custom;
    });

    return (
      hasTechniqueDetails ||
      notes.trim().length > 0 ||
      youtubeUrl.trim().length > 0 ||
      !!imageUri ||
      !!videoUri
    );
  }, [techniques, notes, youtubeUrl, imageUri, videoUri]);

async function replayVideo() {
  try {
    if (!videoRef.current) return;
    await videoRef.current.setPositionAsync(0);
    await videoRef.current.playAsync();
  } catch {}
}

useEffect(() => {
  if (loading) return;

  try {
    const node = scrollRef.current;
    if (!node) return;

    if (typeof node.scrollToPosition === "function") {
      node.scrollToPosition(0, 0, false);
    } else if (typeof node.scrollTo === "function") {
      node.scrollTo({ x: 0, y: 0, animated: false });
    }
  } catch {}
}, [loading]);
// UseState Block 2 //
  useFocusEffect(
  React.useCallback(() => {
    if (!isNew) return;

    setDraftId(makeId());
    setDate(prefillDate || todayYMD());

   setSystem(effectivePrefillSystem);

   // Reset technique entries to a single blank entry
   setTechniques([
     {
       id: makeId(),
       position: "",
       grips: "",
       finish: "",
       techniqueId: "",
       technique: "",
       customTechnique: "",
     },
   ]);

   setNotes("");
   setYoutubeUrl("");
   setImageUri(null);
   setVideoUri(null);
  }, [isNew, prefillDate, effectivePrefillSystem])
);

// Block 3.5: hard reset when opening a NEW session screen (prevents state carryover)
useFocusEffect(
  React.useCallback(() => {
    if (!isNew) return;

    // Reset fields so "New Session" never inherits the last edited session
    setSystem(effectivePrefillSystem);
    setTechniques([
      {
        id: makeId(),
        position: "",
        grips: "",
        finish: "",
        techniqueId: "",
        technique: "",
        customTechnique: "",
      },
    ]);
    setNotes("");
    setYoutubeUrl("");

    // attachments
    setImageUri(null);
    setVideoUri(null);
    setImageAssetId(null);
    setVideoAssetId(null);

    // UI state
    setTechQuery("");
    setTechPickerOpen(false);

    // date
    setDate(prefillDate || todayYMD());

    // we’re "ready" instantly for new
    setLoading(false);
 }, [isNew, prefillDate, effectivePrefillSystem])
);
// Block 4: useEffect to load session if editing existing, or set defaults if new
  useEffect(() => {
    (async () => {
      const sessions = await loadSessions();

      if (isNew) {
        // Reset fields so "New Session" never inherits the last edited session
        setSystem(effectivePrefillSystem);      // important: system was sticking too
        setTechniques([
          {
            id: makeId(),
            position: "",
            grips: "",
            finish: "",
            techniqueId: "",
            technique: "",
            customTechnique: "",
          },
        ]);
        setNotes("");
        setYoutubeUrl("");

        // attachments
        setImageUri(null);
        setVideoUri(null);
        setImageAssetId(null);
        setVideoAssetId(null);

        // date default for new sessions
        setDate(prefillDate || todayYMD());

        // MVP decision: keep gear sticky (don’t reset setGear)
        setLoading(false);
        return;
      }

      const found = sessions.find((s) => s.id === sessionId);
      if (!found) {
        Alert.alert("Not found", "That session no longer exists.");
        router.replace(kidIdParam ? `/training?kidId=${encodeURIComponent(kidIdParam)}` : "/training");
        return;
      }

      setSystem(found.system || "ALL");
      const loadedGear = found.gear === "both" ? "gi" : (found.gear ?? "gi");
      setGear(loadedGear);

      // v1 multi-technique: prefer stored techniques[], otherwise synthesize from legacy fields.
      if (Array.isArray(found.techniques) && found.techniques.length > 0) {
        setTechniques(
          found.techniques.map((t) => ({
            id: t.id || makeId(),
            position: t.position ?? "",
            grips: t.grips ?? "",
            finish: t.finish ?? "",
            techniqueId: t.techniqueId ?? "",
            technique: t.technique ?? "",
            customTechnique: t.customTechnique ?? "",
          }))
        );
      } else {
        const hasLegacy =
          !!found.position ||
          !!found.grips ||
          !!found.finish ||
          !!found.techniqueId ||
          !!found.technique ||
          !!found.customTechnique;

        if (hasLegacy) {
          setTechniques([
            {
              id: makeId(),
              position: found.position ?? "",
              grips: found.grips ?? "",
              finish: found.finish ?? "",
              techniqueId: found.techniqueId ?? "",
              technique: found.technique ?? "",
              customTechnique: found.customTechnique ?? "",
            },
          ]);
        } else {
          setTechniques([
            {
              id: makeId(),
              position: "",
              grips: "",
              finish: "",
              techniqueId: "",
              technique: "",
              customTechnique: "",
            },
          ]);
        }
      }

      setNotes(found.notes || "");
      setYoutubeUrl(found.youtubeUrl || "");
      setImageUri(found.imageUri ?? null);
      setVideoUri(found.videoUri ?? null);
      setImageAssetId(found.imageAssetId ?? null);
      setVideoAssetId(found.videoAssetId ?? null);
      setDate(found.date || todayYMD());

      setLoading(false);
    })();
    // Block 3: dependencies for useEffect - runs when sessionId changes (i.e. when navigating to edit a different session) or when isNew changes (i.e. when toggling between new/edit mode)
  }, [isNew, router, sessionId, prefillDate, effectivePrefillSystem, kidIdParam]);

// Block 5: Derived data (search results for technique picker modal, filtered by search query + gear + system)  
const techResults = useMemo(() => {
    const q = techQuery.trim().toLowerCase();
    const a = TECH_INDEX;

  const b = a.filter((t: any) => {
    const tg = String(t?.gear ?? "both").toLowerCase();
    if (gear === "gi") return tg === "gi" || tg === "both";
    if (gear === "nogi") return tg === "nogi" || tg === "both";
    return true;
  });

  const c = b.filter((t: any) => {
    if (!system || system === "ALL") return true;
    const l1 = String(t?.path?.level1Id ?? "");
    return l1 === String(system);
  });

  const d = c.filter((t: any) => {
    if (!q) return true;
    const hs = String(t?.haystack ?? "").toLowerCase();
    return hs.includes(q);
  });

  return d.slice(0, 50);
}, [techQuery, gear, system]);
  const techResultsForDisplay = useMemo(() => {
  if (techSortMode === "AZ") return techResults;

  return techResults.slice().sort((a: any, b: any) => {
    const ap = a.path;
    const bp = b.path;

    const aKey = `${ap?.level1Label ?? ""}|${ap?.level2Label ?? ""}|${ap?.level3Label ?? ""}|${a.label ?? ""}`;
    const bKey = `${bp?.level1Label ?? ""}|${bp?.level2Label ?? ""}|${bp?.level3Label ?? ""}|${b.label ?? ""}`;

    return aKey.localeCompare(bKey);
  });
  }, [techResults, techSortMode]);
    async function ensureMediaPermissions() {
    const ok = await requestMediaLibraryPermission();
    if (!ok) {
      Alert.alert("Permission needed", "Allow Photos access to attach media.");
      return false;
    }
    return true;
  }
  const groupedTechResults = useMemo(() => {
  if (techSortMode !== "SYSTEM") return null;

  const groups = new Map<string, any[]>();

  for (const t of techResultsForDisplay as any[]) {
    const p = t.path;
    const title =
      `${p?.level1Label ?? "Unknown"} > ${p?.level2Label ?? "Unknown"}`
      + (p?.level3Label ? ` > ${p.level3Label}` : "");

    const arr = groups.get(title) ?? [];
    arr.push(t);
    groups.set(title, arr);
  }

  const titles = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

  return titles.map((title) => ({
    title,
    items: groups.get(title) ?? [],
  }));
}, [techResultsForDisplay, techSortMode]);
async function pickImage() {
  if (!(await ensureMediaPermissions())) return;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });

  if (!result.canceled && result.assets?.[0]?.uri) {
  const asset = result.assets[0];
  const persisted = await persistMediaFromCameraRoll(asset.uri, "image");

  setImageUri(persisted);
  setImageAssetId(asset.assetId ?? null);
}
}
function onAddYoutube() {
  Alert.prompt(
    "Add YouTube link",
    "Paste a YouTube URL (or leave blank to cancel).",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Save",
        onPress: (val?: string) => setYoutubeUrl((val ?? "").trim()),
      },
    ],
    "plain-text",
    youtubeUrl
  );
}

async function pickVideo() {
  if (!(await ensureMediaPermissions())) return;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
  });

  if (!result.canceled && result.assets?.[0]?.uri) {
    const asset = result.assets[0];
    const persisted = await persistMediaFromCameraRoll(asset.uri, "video");

    setVideoUri(persisted);
    setVideoAssetId(asset.assetId ?? null);
  }
}

  async function onSave() {
    const now = new Date().toISOString();
    
    const realId = isNew ? draftId : sessionId;

    const sessions = await loadSessions();
    const existingSession = sessions.find((s) => s.id === realId);
    const paramDate = typeof params.date === "string" ? params.date : "";

  const finalDateRaw = isNew
  ? (paramDate || date || todayYMD())
  : (existingSession?.date || date || todayYMD());

const finalDate = toDateKey(finalDateRaw) || todayYMD();

  
// --- Technique display + payload (multi-tech v1) ---
// 1) Normalize techniques for persistence (filter out entries with no data)
const normalizedTechniques: TechniqueEntry[] = techniques
  .map((t) => ({
    id: t.id || makeId(),
    position: (t.position ?? "").trim() || undefined,
    grips: (t.grips ?? "").trim() || undefined,
    finish: (t.finish ?? "").trim() || undefined,
    techniqueId: (t.techniqueId ?? "").trim() || undefined,
    technique: (t.technique ?? "").trim() || undefined,
    customTechnique: (t.customTechnique ?? "").trim() || undefined,
  }))
  .filter((t) =>
    t.position ||
    t.grips ||
    t.finish ||
    t.techniqueId ||
    t.technique ||
    t.customTechnique
  );

const primaryPersisted = normalizedTechniques[0];

// 2) Derive legacy display label for top-level `technique` field
let legacyTechniqueLabel = "";
if (primaryPersisted?.techniqueId) {
  const selected = getTechniqueById(TECH_INDEX, primaryPersisted.techniqueId);
  legacyTechniqueLabel =
    selected?.label ||
    primaryPersisted.technique ||
    primaryPersisted.customTechnique ||
    "";
} else {
  legacyTechniqueLabel =
    primaryPersisted?.technique ||
    primaryPersisted?.customTechnique ||
    "";
}

// 3) Build payload with dual-write: techniques[] + mirrored top-level fields from first entry
const payload: Session = {
  id: realId,
  createdAt: isNew ? now : existingSession?.createdAt || now,
  date: finalDate,

  kidId: kidIdParam ?? existingSession?.kidId,

  // REQUIRED in Session type
  system: system ?? existingSession?.system ?? "",

  // Optional
  gear: gear ?? existingSession?.gear,

  // v1 multi-technique container
  techniques: normalizedTechniques.length ? normalizedTechniques : undefined,

  // Optional (but must be string if present) – mirror from primary entry
  techniqueId: primaryPersisted?.techniqueId,
  customTechnique: primaryPersisted?.customTechnique,

  // REQUIRED legacy + required text fields
  technique: legacyTechniqueLabel,
  drill: "",
  notes: notes ?? "",
  youtubeUrl: youtubeUrl ?? "",

  // Optional specifics mirrored from primary entry
  position: primaryPersisted?.position,
  grips: primaryPersisted?.grips,
  finish: primaryPersisted?.finish,

  // Optional media
  imageUri: imageUri ?? null,
  videoUri: videoUri ?? null,
  imageAssetId: imageAssetId ?? existingSession?.imageAssetId ?? null,
  videoAssetId: videoAssetId ?? existingSession?.videoAssetId ?? null,
};
    const next = isNew
      ? [payload, ...sessions]
      : sessions.map((s) => (s.id === realId ? payload : s));

    await saveSessions(next);
// 1) haptic
try {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
} catch {}

// 2) message + navigate after user acknowledges
Alert.alert(
  "Session logged",
  "Consistency builds your game.",
  [
    {
      text: "OK",
      onPress: () =>
        kidIdParam
          ? deviceRole === "parent"
            ? router.replace("/this-week")
            : router.replace(`/this-week/kid/${encodeURIComponent(kidIdParam)}`)
          : router.replace(`/training?date=${encodeURIComponent(finalDate)}`),
    },
  ]
);
return; // prevents any router.replace below from firing immediately
  }

  async function onDelete() {
    const backDate = toDateKey(prefillDate || date || todayYMD()) || todayYMD();
    if (isNew) {
      return router.replace(
        kidIdParam
          ? `/training?date=${encodeURIComponent(backDate)}&kidId=${encodeURIComponent(
              kidIdParam,
            )}`
          : `/training?date=${encodeURIComponent(backDate)}`
      );
    }

    Alert.alert("Delete session?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const sessions = await loadSessions();
          await saveSessions(sessions.filter((s) => s.id !== sessionId));
          router.replace(
            `/training?date=${encodeURIComponent(
              toDateKey(prefillDate || date || todayYMD()) || todayYMD(),
            )}${
              kidIdParam ? `&kidId=${encodeURIComponent(kidIdParam)}` : ""
            }`
          );
        },
      },
    ]);
  }

  async function onCancelSession() {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}

    Alert.alert(
      "Cancel this session?",
      "Your unsaved changes will be lost.",
      [
        { text: "Keep Editing", style: "cancel" },
        {
          text: "Cancel Session",
          style: "destructive",
          onPress: () => {
            router.replace(
              `/training?date=${encodeURIComponent(
                toDateKey(prefillDate || date || todayYMD()) || todayYMD(),
              )}${
                kidIdParam ? `&kidId=${encodeURIComponent(kidIdParam)}` : ""
              }`
            );
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.subtle}>Loading…</Text>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: 180 }]}
        enableOnAndroid
        enableAutomaticScroll
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        extraScrollHeight={24}
        innerRef={(ref) => {
          scrollRef.current = ref;
        }}
      >
        <View style={styles.headerRow}>
  <View style={styles.headerTextBlock}>
    <Text style={styles.h1}>{isNew ? "New Session" : "Edit Session"}</Text>
    <Text style={styles.motto}>What you train becomes your game.</Text>
  </View>

  <View style={styles.headerActions}>
    {!isNew && (
      <TouchableOpacity onPress={onDelete} style={styles.headerDeleteBtn}>
        <Text style={styles.headerDeleteText}>Delete</Text>
      </TouchableOpacity>
    )}
  </View>
</View>

<View style={styles.divider} />

  <Text style={styles.sectionTitle}>Gear</Text>
  <View style={styles.pillRow}>
    {(["gi", "nogi"] as const).map((g) => (
      <TouchableOpacity
        key={g}
        onPress={() => setGear(g)}
        style={[styles.pill, gear === g ? styles.pillActive : null]}
      >
        <Text style={[styles.pillText, gear === g ? styles.pillTextActive : null]}>
          {g}
        </Text>
      </TouchableOpacity>
    ))}
  </View>

  <Text style={styles.sectionTitle}>BJJ System</Text>
  <View style={styles.pillRow}>
    {SYSTEMS_L1.map((s) => (
      <TouchableOpacity
        key={s.id}
        onPress={() => setSystem(s.id)}
        style={[styles.pill, system === s.id ? styles.pillActive : null]}
      >
        <Text style={[styles.pillText, system === s.id ? styles.pillTextActive : null]}>
          {s.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>

  <Text style={styles.sectionTitle}>Techniques</Text>

  {techniques.map((t, index) => {
    const techId = (t.techniqueId ?? "").trim();
    const selected = techId ? getTechniqueById(TECH_INDEX, techId) : null;
    const labelFromTaxonomy = selected?.label || "";
    const path = selected ? techniqueToLabel(selected) : "";
    const legacyLabel = (t.technique ?? "").trim();
    const custom = (t.customTechnique ?? "").trim();
    const displayLabel =
      labelFromTaxonomy ||
      legacyLabel ||
      (!techId && custom ? custom : "");

    return (
      <View key={t.id} style={{ marginTop: index === 0 ? 8 : 16 }}>
        <Text style={styles.label}>
          {index === 0
            ? "Technique of the Day"
            : `Additional Technique ${index + 1}`}
        </Text>

        {/* Technique picker field (shows selected label + path) */}
        <View style={styles.techRow}>
          <TouchableOpacity
            style={[styles.input, styles.techField]}
            onPress={() => {
              setPickerTargetIndex(index);
              setTechQuery("");
              setTechPickerOpen(true);
            }}
          >
            <Text
              style={[
                styles.inputValueText,
                !displayLabel ? styles.inputPlaceholderText : null,
              ]}
            >
              {displayLabel || "Pick a technique..."}
            </Text>

            {!!path && (
              <Text style={styles.inputSubValueText}>{path}</Text>
            )}
          </TouchableOpacity>

          {(index === 0 ? (!!displayLabel || !!custom) : true) && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                if (index === 0) {
                  updateTechniqueAt(index, {
                    techniqueId: "",
                    technique: "",
                    customTechnique: "",
                  });
                  setTechQuery("");
                } else {
                  removeTechnique(index);
                }
              }}
            >
              <Text style={styles.clearBtnText}>
                {index === 0 ? "Clear" : "Remove"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {!techId && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.label}>Custom Technique (optional)</Text>
            <Text style={styles.helperText}>
              Use this if you can’t find your technique in the list above.
            </Text>
            <TextInput
              value={t.customTechnique ?? ""}
              onChangeText={(text) =>
                updateTechniqueAt(index, { customTechnique: text })
              }
              placeholder="Type your technique… (ex: Knee cut → far-side underhook)"
              placeholderTextColor="#6f6f86"
              style={styles.input}
            />
          </View>
        )}
      </View>
    );
  })}

  <View style={{ marginTop: 12 }}>
    <TouchableOpacity style={styles.primaryBtn} onPress={addTechnique}>
      <Text style={styles.primaryBtnText}>+ Add Technique</Text>
    </TouchableOpacity>
  </View>
<Modal
  visible={techPickerOpen}
  animationType="slide"
  presentationStyle="fullScreen"
  statusBarTranslucent={false}
>
  <SafeAreaView style={styles.modalContainer} edges={["top","left","right"]}>
    <View style={[styles.headerRow, { paddingTop: insets.top }]}>
  <Text style={styles.h1}>Pick Technique</Text>

  <TouchableOpacity onPress={() => setTechPickerOpen(false)}>
    <Text style={styles.headerDeleteText}>Close</Text>
  </TouchableOpacity>
</View>

    <TextInput
      value={techQuery}
      onChangeText={setTechQuery}
      placeholder="Search technique…"
      style={styles.input}
      autoFocus
    />
<View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
  <TouchableOpacity
    onPress={() => setTechSortMode("AZ")}
    style={[styles.pill, techSortMode === "AZ" ? styles.pillActive : null]}
  >
    <Text style={[styles.pillText, techSortMode === "AZ" ? styles.pillTextActive : null]}>
      A–Z
    </Text>
  </TouchableOpacity>

  <TouchableOpacity
    onPress={() => setTechSortMode("SYSTEM")}
    style={[styles.pill, techSortMode === "SYSTEM" ? styles.pillActive : null]}
  >
    <Text style={[styles.pillText, techSortMode === "SYSTEM" ? styles.pillTextActive : null]}>
      System
    </Text>
  </TouchableOpacity>
</View>
    <View style={{ flex: 1, marginTop: 12 }}>
  <Text style={{ color: UI.textPrimary, marginBottom: 8 }}>
    Results: {techResults.length}
  </Text>

  <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
  {/* Favorites + Recent only show when NOT searching */}
  {techQuery.trim().length === 0 && favoriteItems.length > 0 ? (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.sectionTitle}>★ Favorites</Text>

      {favoriteItems.map((t: any) => (
        <TouchableOpacity
          key={`fav-${t.id}`}
          style={styles.row}
          onPress={async () => {
            if (pickerTargetIndex == null) return;
            const label = String(t.label ?? "");
            setTechniques((prev) =>
              prev.map((entry, idx) =>
                idx === pickerTargetIndex
                  ? { ...entry, techniqueId: t.id, technique: label }
                  : entry
              )
            );
            await pushRecent(t.id);
            setTechPickerOpen(false);
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.rowTitle}>{String(t.label ?? "Technique")}</Text>
              <Text style={styles.helperText}>
                {techSortMode === "AZ"
  ? techniqueToLabel(t)
  : `${t.path?.level1Label} > ${t.path?.level2Label}${t.path?.level3Label ? ` > ${t.path.level3Label}` : ""}`}
              </Text>
            </View>

            <TouchableOpacity
              onPress={async () => toggleFavorite(t.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ color: UI.textPrimary, fontSize: 18 }}>★</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  ) : null}

  {techQuery.trim().length === 0 && recentItems.length > 0 ? (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.sectionTitle}>Recent</Text>

      {recentItems.map((t: any) => (
        <TouchableOpacity
          key={`rec-${t.id}`}
          style={styles.row}
          onPress={async () => {
            if (pickerTargetIndex == null) return;
            const label = String(t.label ?? "");
            setTechniques((prev) =>
              prev.map((entry, idx) =>
                idx === pickerTargetIndex
                  ? { ...entry, techniqueId: t.id, technique: label }
                  : entry
              )
            );
            await pushRecent(t.id);
            setTechPickerOpen(false);
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.rowTitle}>{String(t.label ?? "Technique")}</Text>
              <Text style={styles.helperText}>
               {techSortMode === "AZ"
  ? techniqueToLabel(t)
  : `${t.path?.level1Label} > ${t.path?.level2Label}${t.path?.level3Label ? ` > ${t.path.level3Label}` : ""}`}
              </Text>
            </View>

            <TouchableOpacity
              onPress={async () => toggleFavorite(t.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ color: favoriteTechIds.includes(t.id) ? UI.textPrimary : UI.textSecondary, fontSize: 18 }}>
                ★
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  ) : null}

  {/* Main results list (existing behavior) */}
  {/* Main results list */}
{techSortMode === "SYSTEM" && groupedTechResults ? (
  groupedTechResults.map((g) => (
    <View key={g.title} style={{ marginBottom: 14 }}>
      <Text style={{ color: UI.textPrimary, marginBottom: 6 }}>
        {g.title}
      </Text>

      {g.items.map((t: any) => (
        <TouchableOpacity
          key={t.id}
          style={styles.row}
          onPress={async () => {
            if (pickerTargetIndex == null) return;
            const label = String(t.label ?? "");
            setTechniques((prev) =>
              prev.map((entry, idx) =>
                idx === pickerTargetIndex
                  ? { ...entry, techniqueId: t.id, technique: label }
                  : entry
              )
            );
            await pushRecent(t.id);
            setTechPickerOpen(false);
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.rowTitle}>{String(t.label ?? "Technique")}</Text>
              <Text style={styles.helperText}>
                {`${t.path?.level1Label} > ${t.path?.level2Label}${t.path?.level3Label ? ` > ${t.path.level3Label}` : ""}`}
              </Text>
            </View>

            <TouchableOpacity
              onPress={async () => toggleFavorite(t.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ color: favoriteTechIds.includes(t.id) ? UI.textPrimary : UI.textSecondary, fontSize: 18 }}>
                ★
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  ))
) : (
  techResultsForDisplay.map((t: any) => (
    <TouchableOpacity
      key={t.id}
      style={styles.row}
      onPress={async () => {
        if (pickerTargetIndex == null) return;
        const label = String(t.label ?? "");
        setTechniques((prev) =>
          prev.map((entry, idx) =>
            idx === pickerTargetIndex
              ? { ...entry, techniqueId: t.id, technique: label }
              : entry
          )
        );
        await pushRecent(t.id);
        setTechPickerOpen(false);
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.rowTitle}>{String(t.label ?? "Technique")}</Text>
          <Text style={styles.helperText}>
            {techSortMode === "AZ"
              ? techniqueToLabel(t)
              : `${t.path?.level1Label} > ${t.path?.level2Label}${t.path?.level3Label ? ` > ${t.path.level3Label}` : ""}`}
          </Text>
        </View>

        <TouchableOpacity
          onPress={async () => toggleFavorite(t.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={{ color: favoriteTechIds.includes(t.id) ? UI.textPrimary : UI.textSecondary, fontSize: 18 }}>
            ★
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  ))
)}
</ScrollView>
</View>
  </SafeAreaView>
</Modal>
        <Text style={styles.label}>Training Sequence</Text>
<Text style={styles.helperText}>
Format: start position (grips) → transition → outcome (pass, sweep, submit)
</Text>
<TextInput
  value={notes}
  scrollEnabled={false}
  onChangeText={setNotes}
  placeholder="Ex: Closed guard (sleeve+collar) → hip bump → mount → armbar"
  placeholderTextColor="#6f6f86"
  style={[styles.input, styles.textarea]}
  multiline
  textAlignVertical="top"
/>
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Attachments</Text>

      <View style={styles.attachmentButtonsRow}>
        <TouchableOpacity style={styles.attachmentButton} onPress={pickImage}>
          <Text style={styles.attachmentButtonText}>📷 Add Image</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.attachmentButton} onPress={pickVideo}>
          <Text style={styles.attachmentButtonText}>🎥 Add Video</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.attachmentButton} onPress={onAddYoutube}>
          <Text
            style={styles.attachmentButtonText}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            🔗 YouTube {youtubeUrl?.trim() ? "✓" : ""}
          </Text>
        </TouchableOpacity>
      </View>
    </View>

    {imageUri ? (
      <View style={styles.attachmentPreview}>
        <Image
          source={{ uri: imageUri }}
          style={styles.previewImg}
          resizeMode="cover"
        />
        <TouchableOpacity
          style={styles.headerDeleteBtn}
          onPress={() => setImageUri(null)}
        >
          <Text style={styles.headerDeleteText}>Remove Image</Text>
        </TouchableOpacity>
      </View>
    ) : null}

    {videoUri ? (
      <View style={styles.attachmentPreview}>
        <Text style={styles.sectionTitle}>Video Preview</Text>
        <Video
          key={videoKey}
          ref={videoRef}
          source={{ uri: videoUri }}
          style={styles.previewImg}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
          onPlaybackStatusUpdate={(status) => {
            if (!status || typeof status !== "object") return;
            // @ts-ignore
            if (status.didJustFinish) setVideoKey((k) => k + 1);
          }}
        />
      <View style={styles.attachmentButtonsRow}>
          <TouchableOpacity
            style={styles.attachmentButton}
            onPress={replayVideo}
          >
            <Text style={styles.attachmentButtonText}>↻ Replay</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.attachmentButton}
            onPress={() => setVideoUri(null)}
          >
            <Text style={styles.attachmentDangerText}>Remove Video</Text>
          </TouchableOpacity>
        </View>
        
        {youtubeUrl?.trim() ? (
          <View style={styles.attachmentCard}>
            <View style={styles.attachmentTitleRow}>
              <Text style={styles.attachmentTitle}>YouTube</Text>
              <TouchableOpacity
                onPress={() => setYoutubeUrl("")}
                style={styles.attachmentRemoveBtn}
              >
                <Text style={styles.attachmentDangerText}>Remove</Text>
              </TouchableOpacity>
            </View>

            <Text
              style={styles.attachmentMeta}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {youtubeUrl}
            </Text>
          </View>
        ) : null}

       
      </View>
    ) : null}
{/* ---------- Actions ---------- */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Actions</Text>

  <View style={styles.actionsRow}>
    <TouchableOpacity onPress={onCancelSession} style={styles.secondaryBtn}>
      <Text style={styles.secondaryBtnText}>Cancel Session</Text>
    </TouchableOpacity>

    <TouchableOpacity
      onPress={onSave}
      disabled={!canSave}
      style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
    >
      <Text style={[styles.primaryBtnText, !canSave && styles.primaryBtnTextDisabled]}>
        Save Session
      </Text>
    </TouchableOpacity>
  </View>
</View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

// Build 7 light visual system (matches training tab + profile)
const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  bgCardActive: "#edf2ff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  accent: "#1d4ed8",
  danger: "#dc2626",
};

const styles = StyleSheet.create({
  // --------------------------------------------------
// Layout & structural styles
// - page container
// - scroll spacing
// - section wrappers & dividers
// --------------------------------------------------
  container: { flex: 1, backgroundColor: UI.screenBg },
  modalContainer: {
  flex: 1,
  backgroundColor: UI.screenBg,
  paddingTop: 12, // <-- key: forces space even if inset fails
},
  scroll: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 24, fontWeight: "700", color: UI.textPrimary },
  headerTextBlock: {
  flexDirection: "column",
},
  section: {
  marginTop: 12,
},
motto: {
  color: UI.textSecondary,
  marginTop: 6,
  fontSize: 13,
  fontWeight: "600",
},
helperText: {
  color: UI.textSecondary,
  marginTop: 6,
  marginBottom: 10,
  fontSize: 12,
},
inputValueText: {
  color: UI.accent,
  fontSize: 16,
},

inputPlaceholderText: {
  color: "#6b7280",
},
inputSubValueText: {
  marginTop: 4,
  color: UI.textSecondary,
  fontSize: 12,
},
techRow: {
  flexDirection: "row",
  alignItems: "stretch",
  gap: 10,
},
techField: {
  flex: 1,
},
clearBtn: {
  paddingHorizontal: 12,
  paddingVertical: 10,
  justifyContent: "center",
  borderRadius: 12,
  borderWidth: 1,
  borderColor: UI.border,
  backgroundColor: "transparent",
},

clearBtnText: {
  fontSize: 13,
  fontWeight: "500",
  color: UI.textSecondary,
},
specificTrainingInput: {
  borderColor: UI.border,
  backgroundColor: UI.bgCard,
  paddingVertical: 10, // slightly tighter than input padding: 12
},
divider: {
  height: 1,
  backgroundColor: UI.border,
  marginBottom: 12,
},
sectionTitle: {
  color: UI.textPrimary,
  marginTop: 12,
  marginBottom: 6,
  fontWeight: "600",
},
  // Attachments
  attachmentButtonsRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 6,
},

  attachmentCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.bgCard,
    gap: 8,
  },

  attachmentTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  attachmentTitle: {
    color: UI.textPrimary,
    fontWeight: "700",
  },

  attachmentMeta: {
    color: UI.textSecondary,
    fontSize: 12,
  },

  attachmentRemoveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.bgCard,
    alignSelf: "flex-start",
  },

  attachmentRemoveText: {
    color: UI.danger,
    fontWeight: "800",
  },
  headerRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
  paddingTop: 6,
},

headerActions: {
  flexDirection: "row",
  gap: 10,
  alignItems: "center",
},
// Actions / CTA
actionsRow: {
  flexDirection: "row",
  gap: 10,
  marginTop: 8,
},

secondaryBtn: {
  flex: 1,
  paddingVertical: 12,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: UI.border,
  backgroundColor: UI.bgCard,
  alignItems: "center",
  justifyContent: "center",
},

secondaryBtnText: {
  color: UI.textPrimary,
  fontWeight: "800",
  fontSize: 16,
},

attachmentButton: {
  flexGrow: 1,
  flexBasis: "48%",
  paddingVertical: 10,
  paddingHorizontal: 14,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: UI.border,
  backgroundColor: UI.bgCard,
  alignItems: "center",
  justifyContent: "center",
},

attachmentButtonText: {
  color: UI.textPrimary,
  fontWeight: "800",
  fontSize: 13,
},
attachmentDangerText: {
  color: UI.danger,
  fontWeight: "800",
  fontSize: 13,
},
attachmentPreview: {
  marginTop: 10,
  gap: 8,
},
primaryBtn: {
  flex: 1,
  paddingVertical: 12,
  borderRadius: 12,
  backgroundColor: UI.accent,
  borderWidth: 1,
  borderColor: UI.accent,
  alignItems: "center",
  justifyContent: "center",
},

primaryBtnDisabled: {
  opacity: 0.45,
},

primaryBtnText: {
  color: "#ffffff",
  fontWeight: "800",
  fontSize: 16,
},

primaryBtnTextDisabled: {
  opacity: 0.7,
},

dangerBtn: {
  paddingVertical: 12,
  paddingHorizontal: 14,
  borderRadius: 12,
  backgroundColor: UI.bgCard,
  borderWidth: 1,
  borderColor: UI.border,
  alignItems: "center",
  justifyContent: "center",
},

dangerBtnText: {
  color: UI.danger,
  fontWeight: "800",
  fontSize: 16,
},
headerDeleteBtn: {
  minHeight: 36,
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: UI.border,
  backgroundColor: UI.bgCard,
  justifyContent: "center",
},

headerDeleteText: {
  color: UI.danger,
  fontWeight: "800",
},

headerSaveBtn: {
  minHeight: 36,
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 10,
  backgroundColor: UI.accent,
  borderWidth: 1,
  borderColor: UI.accent,
  justifyContent: "center",
},
headerSaveBtnDisabled: {
  opacity: 0.45,
},
headerSaveTextDisabled: {
  opacity: 0.7,
},
headerSaveText: {
  color: "#ffffff",
  fontWeight: "800",
},
  subtle: { color: UI.textSecondary, marginTop: 6, lineHeight: 18 },
  label: { color: UI.textPrimary, marginTop: 12, marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: UI.bgCard,
    borderRadius: 10,
    padding: 12,
    color: UI.textPrimary,
    borderWidth: 1,
    borderColor: UI.border,
  },
  textarea: { minHeight: 140 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.bgCard,
  },
  pillActive: { borderColor: UI.accent, backgroundColor: UI.bgCardActive },
  pillText: { color: UI.textPrimary, fontSize: 12 },
  pillTextActive: { color: UI.textPrimary, fontWeight: "700" },
  pillSelected: { borderColor: UI.accent, backgroundColor: UI.bgCardActive },
  pillTextSelected: { color: UI.textPrimary, fontWeight: "700" },
  rowTitle: { flex: 1 },
  row: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: 12,
  paddingHorizontal: 12,
  borderRadius: 12,
  marginTop: 12,
  backgroundColor: UI.bgCard,
  borderWidth: 1,
  borderColor: UI.border,
},
  rowItem: { flex: 1 },
  card: {
    marginTop: 12,
    backgroundColor: UI.bgCard,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: UI.border,
  } ,
  cardTitle: { color: UI.textPrimary, fontWeight: "700", marginBottom: 8 },
  previewImg: { width: "100%", height: 220, borderRadius: 12 },
});
