import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { ResizeMode, Video } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { Session } from "../../types";

import { buildTechniqueIndex } from "../../fundamentals/index";
import { FUNDAMENTALS_TAXONOMY } from "../../fundamentals/taxonomy";

// Fundamentals: build static search index once (do NOT move inside component)
const TECH_INDEX = buildTechniqueIndex(FUNDAMENTALS_TAXONOMY);

function techniqueToLabel(t: any): string {
  if (!t) return "";

  // If path is already a string, use it
  if (typeof t.path === "string") return t.path;

  // If path is an object like { level1Label, level2Label }
  if (t.path && typeof t.path === "object") {
    const parts = [t.path.level1Label, t.path.level2Label].filter(Boolean);
    return parts.join(" > ") || "Selected technique";
  }

  return "Selected technique";
}
// Block 2: Level 1 "Systems" from taxonomy (Option A)
// We store the *level1Id* in `system`, not the label.

const TAX_L1 = (
  (FUNDAMENTALS_TAXONOMY as any).level1 ??
  (FUNDAMENTALS_TAXONOMY as any).level1s ??
  (FUNDAMENTALS_TAXONOMY as any).levels?.[0] ??
  []
) as Array<{ id: string; label: string }>;

const SYSTEMS_L1 = [
  { id: "ALL", label: "All" },
  ...TAX_L1.map((l1) => ({ id: l1.id, label: l1.label })),
];
const STORAGE_KEY = "bjj.sessions.v1";

const MEDIA_DIR =
  FileSystem.documentDirectory ? `${FileSystem.documentDirectory}media/` : null;

async function ensureMediaDir() {
  if (!MEDIA_DIR) return null;

  const info = await FileSystem.getInfoAsync(MEDIA_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
  }
  return MEDIA_DIR;
}

async function persistMedia(uri: string, kind: "image" | "video") {
  const dir = await ensureMediaDir();
  if (!dir) return uri; // fallback: use original if no doc dir

  const ext =
    uri.split(".").pop()?.split("?")[0] ||
    (kind === "image" ? "jpg" : "mp4");

  const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  const dest = `${dir}${filename}`;

  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

function todayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

async function saveSessions(sessions: Session[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

// State Variables Block1 //
export default function TrainingSessionEditor() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const prefillDate = String(params.date || "");
  const sessionId = String(params.id || "");
  const isNew = useMemo(() => sessionId === "new", [sessionId]);
  const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const [draftId, setDraftId] = useState(makeId());

  const [loading, setLoading] = useState(true);
  const [system, setSystem] = useState<string>("ALL");
  const [position, setPosition] = useState("");
  const [grips, setGrips] = useState("");
  const [finish, setFinish] = useState("");
  
// MVP taxonomy picker (new)
  const [gear, setGear] = useState<"gi" | "nogi">("gi");
  const [techniqueId, setTechniqueId] = useState("");
  const [techPickerOpen, setTechPickerOpen] = useState(false);
  const [techQuery, setTechQuery] = useState("");

// Legacy (keep for old sessions while we transition)
  const [technique, setTechnique] = useState("");
  const [drill, setDrill] = useState("");
  const [notes, setNotes] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [date, setDate] = useState(prefillDate || todayYMD());
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [imageAssetId, setImageAssetId] = useState<string | null>(null);
  const [videoAssetId, setVideoAssetId] = useState<string | null>(null);
  const videoRef = useRef<Video>(null);
  const [videoKey, setVideoKey] = useState(0);
  const canSave = useMemo(() => {
  return (
  position.trim().length > 0 ||
  grips.trim().length > 0 ||
  finish.trim().length > 0 ||
  techniqueId.trim().length > 0 || // new picker
  technique.trim().length > 0 ||   // legacy
    drill.trim().length > 0 ||
    notes.trim().length > 0 ||
    youtubeUrl.trim().length > 0 ||
    !!imageUri ||
    !!videoUri
  );
}, [position, grips, finish, technique, drill, notes, youtubeUrl, imageUri, videoUri]);

async function replayVideo() {
  try {
    if (!videoRef.current) return;
    await videoRef.current.setPositionAsync(0);
    await videoRef.current.playAsync();
  } catch {}
}
// UseState Block 2 //
  useFocusEffect(
  React.useCallback(() => {
    if (!isNew) return;

    setDraftId(makeId());
    setDate(prefillDate || todayYMD());

   setSystem("ALL");

// New structured learning fields
setPosition("");
setGrips("");
setFinish("");

// Legacy fields (keep during transition)
setTechnique("");

setDrill("");
setNotes("");
setYoutubeUrl("");
setImageUri(null);
setVideoUri(null);
  }, [isNew, prefillDate])
);
// Block 4: useEffect to load session if editing existing, or set defaults if new
  useEffect(() => {
    (async () => {
      const sessions = await loadSessions();

      if (isNew) {
        setLoading(false);
        return;
      }

      const found = sessions.find((s) => s.id === sessionId);
      if (!found) {
        Alert.alert("Not found", "That session no longer exists.");
        router.replace("/training");
        return;
      }

  

      setSystem(found.system || "ALL");

      setTechniqueId(found.techniqueId || "");
      setGear(found.gear || "gi");
      setTechnique(found.technique || ""); // legacy label still supported
      setDrill(found.drill || "");
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
  }, [isNew, router, sessionId]);

  // Block 5: Derived data (technique search results)
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
    async function ensureMediaPermissions() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow Photos access to attach media.");
      return false;
    }
    return true;
  }
async function pickImage() {
  if (!(await ensureMediaPermissions())) return;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });

  if (!result.canceled && result.assets?.[0]?.uri) {
  const asset = result.assets[0];
  const persisted = await persistMedia(asset.uri, "image");

  setImageUri(persisted);
  setImageAssetId(asset.assetId ?? null);
}
}

async function pickVideo() {
  if (!(await ensureMediaPermissions())) return;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
  });

  if (!result.canceled && result.assets?.[0]?.uri) {
  const asset = result.assets[0];
  const persisted = await persistMedia(asset.uri, "video");

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

  const finalDate = isNew
  ? (paramDate || date || todayYMD())
  : (existingSession?.date || date || todayYMD());

    const payload: Session = {
  id: realId,
  createdAt: isNew ? now : existingSession?.createdAt || now,
  date: finalDate,

  gear,
  system,

  techniqueId,        // ✅ NEW (structured picker)
  technique,          // legacy label (keep for now)

  drill,
  notes,
  youtubeUrl,

  imageUri,
  videoUri,
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
        router.replace(`/training?date=${encodeURIComponent(finalDate)}`),
    },
  ]
);
return; // prevents any router.replace below from firing immediately
  }

  async function onDelete() {
    if (isNew) return router.replace("/training");

    Alert.alert("Delete session?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const sessions = await loadSessions();
          await saveSessions(sessions.filter((s) => s.id !== sessionId));
          router.replace(`/training?date=${encodeURIComponent(prefillDate || date || todayYMD())}`);
        },
      },
    ]);
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
      <ScrollView contentContainerStyle={styles.scroll}>
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

<View style={styles.section}>
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
       <Text
        style={[
          styles.pillText,
          system === s.id ? styles.pillTextActive : null,
        ]}
      >
        {s.label}
</Text>
      </TouchableOpacity>
    ))}
  </View>
</View>
        <Text style={styles.label}>Technique of the Day</Text>

{/* Technique picker field (shows selected label + path) */}
{(() => {
  const selected = techniqueId
    ? TECH_INDEX.find((t: any) => t.id === techniqueId)
    : null;

  return (
    <TouchableOpacity style={styles.input} onPress={() => setTechPickerOpen(true)}>
      <Text
        style={[
          styles.inputValueText,
          !selected ? styles.inputPlaceholderText : null,
        ]}
      >
        {selected ? String(selected.label ?? "Technique") : "Pick a technique..."}
      </Text>

      {!!selected && (
        <Text style={styles.inputSubValueText}>{techniqueToLabel(selected)}</Text>
      )}
    </TouchableOpacity>
  );
})()}

<Modal visible={techPickerOpen} animationType="slide">
  <SafeAreaView style={styles.container}>
    <View style={styles.headerRow}>
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

    <View style={{ flex: 1, marginTop: 12 }}>
  <Text style={{ color: "#fff", marginBottom: 8 }}>
    Results: {techResults.length}
  </Text>

  <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
    {techResults.map((t: any) => (
      <TouchableOpacity
        key={t.id}
        style={styles.row}
        onPress={() => {
          setTechniqueId(t.id);
          setTechnique(techniqueToLabel(t)); // legacy sync for now
          setTechPickerOpen(false);
        }}
      >
        <Text style={[styles.rowTitle, { color: "#fff" }]}>
          {String(t.label ?? "Technique")}
        </Text>
        <Text style={[styles.helperText, { color: "rgba(255,255,255,0.65)" }]}>
          {techniqueToLabel(t)}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
</View>
  </SafeAreaView>
</Modal>
        <Text style={styles.helperText}>
        Format: position → grips → finish (ex: De La Riva • sleeve+pants • sweep)
        </Text>
        <Text style={styles.label}>Specific Training</Text>
        <TextInput
          value={drill}
          onChangeText={setDrill}
          placeholder="What drill did you repeat?"
          placeholderTextColor="#6f6f86"
          style={[styles.input, styles.specificTrainingInput]}
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Key details, cues, questions…"
          placeholderTextColor="#6f6f86"
          style={[styles.input, styles.textarea]}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>YouTube Link</Text>
        <TextInput
          value={youtubeUrl}
          onChangeText={setYoutubeUrl}
          placeholder="https://youtube.com/…"
          placeholderTextColor="#6f6f86"
          style={styles.input}
          autoCapitalize="none"
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
  </View>

  {!!imageUri && (
    <View style={styles.attachmentPreview}>
      <Image source={{ uri: imageUri }} style={styles.previewImg} resizeMode="cover" />
<TouchableOpacity style={styles.headerDeleteBtn} onPress={() => setImageUri(null)}>
  <Text style={styles.headerDeleteText}>Remove Image</Text>
</TouchableOpacity>
    </View>
  )}

  {!!videoUri && (
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
  <TouchableOpacity style={styles.attachmentButton} onPress={replayVideo}>
    <Text style={styles.attachmentButtonText}>↻ Replay</Text>
  </TouchableOpacity>

  <TouchableOpacity
  style={styles.attachmentButton}
  onPress={() => setVideoUri(null)}
>
  <Text style={styles.attachmentDangerText}>Remove Video</Text>
</TouchableOpacity>
</View>
    </View>
  )}
</View>
{/* ---------- Actions ---------- */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Actions</Text>

  <View style={styles.actionsRow}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // --------------------------------------------------
// Layout & structural styles
// - page container
// - scroll spacing
// - section wrappers & dividers
// --------------------------------------------------
  container: { flex: 1, backgroundColor: "#0b0b0f" },
  scroll: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 24, fontWeight: "700", color: "white" },
  headerTextBlock: {
  flexDirection: "column",
},
  section: {
  marginTop: 12,
},
motto: {
  color: "#b9b9c4",
  marginTop: 6,
  fontSize: 13,
  fontWeight: "600",
},
helperText: {
  color: "#b9b9c4",
  marginTop: 6,
  marginBottom: 10,
  fontSize: 12,
},
inputValueText: {
  color: "#9bb1ff", // soft blue accent
  fontSize: 16,
},

inputPlaceholderText: {
  color: "#6f6f86",
},
inputSubValueText: {
  marginTop: 4,
  color: "rgba(255,255,255,0.65)",
  fontSize: 12,
},
specificTrainingInput: {
  borderColor: "#3b3f55",
  backgroundColor: "#0f0f16",
  paddingVertical: 10, // slightly tighter than input padding: 12
},
divider: {
  height: 1,
  backgroundColor: "#2a2a3a",
  marginBottom: 12,
},
sectionTitle: {
  color: "white",
  marginTop: 12,
  marginBottom: 6,
  fontWeight: "600",
},
  // Attachments
  attachmentButtonsRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 6,
  },

  attachmentCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a3a",
    backgroundColor: "#161621",
    gap: 8,
  },

  attachmentTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  attachmentTitle: {
    color: "white",
    fontWeight: "700",
  },

  attachmentMeta: {
    color: "#b9b9c4",
    fontSize: 12,
  },

  attachmentRemoveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a3a",
    backgroundColor: "#161621",
    alignSelf: "flex-start",
  },

  attachmentRemoveText: {
    color: "#ff6b6b",
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

attachmentButton: {
  paddingVertical: 10,
  paddingHorizontal: 14,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: "#2a2a3a",
  backgroundColor: "#161621",
},

attachmentButtonText: {
  color: "#cfcfe6",
  fontWeight: "800",
  fontSize: 13,
},
attachmentDangerText: {
  color: "#ff6b6b",
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
  backgroundColor: "#1b1c2a",
  borderWidth: 1,
  borderColor: "#2a2a3a",
  alignItems: "center",
  justifyContent: "center",
},

primaryBtnDisabled: {
  opacity: 0.45,
},

primaryBtnText: {
  color: "white",
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
  backgroundColor: "#161621",
  borderWidth: 1,
  borderColor: "#2a2a3a",
  alignItems: "center",
  justifyContent: "center",
},

dangerBtnText: {
  color: "#ff6b6b",
  fontWeight: "800",
  fontSize: 16,
},
headerDeleteBtn: {
  minHeight: 36,
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#2a2a3a",
  backgroundColor: "#161621",
  justifyContent: "center",
},

headerDeleteText: {
  color: "#ff6b6b",
  fontWeight: "800",
},

headerSaveBtn: {
  minHeight: 36,
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 10,
  backgroundColor: "#1b1c2a",
  borderWidth: 1,
  borderColor: "#2a2a3a",
  justifyContent: "center",
},
headerSaveBtnDisabled: {
  opacity: 0.45,
},
headerSaveTextDisabled: {
  opacity: 0.7,
},
headerSaveText: {
  color: "white",
  fontWeight: "800",
},
  subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
  label: { color: "white", marginTop: 12, marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: "#161621",
    borderRadius: 10,
    padding: 12,
    color: "white",
    borderWidth: 1,
    borderColor: "#2a2a3a",
  },
  textarea: { minHeight: 140 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2a2a3a",
    backgroundColor: "#161621",
  },
  pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a" },
  pillText: { color: "#cfcfe6", fontSize: 12 },
  pillTextActive: { color: "white", fontWeight: "700" },
  pillSelected: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a" },
  pillTextSelected: { color: "white", fontWeight: "700" },
  rowTitle: { flex: 1 },
  row: { flexDirection: "row", gap: 10, marginTop: 12 },
  rowItem: { flex: 1 },
  card: {
    marginTop: 12,
    backgroundColor: "#12121b",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2a2a3a",
  } ,
  cardTitle: { color: "white", fontWeight: "700", marginBottom: 8 },
  previewImg: { width: "100%", height: 220, borderRadius: 12 },
});
