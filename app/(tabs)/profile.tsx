import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  Alert,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { StorageKeys } from "../../src/storage/storageKeys";

import { isDev } from "../../src/config/runtime";
import { loadDevFlags } from "../../src/config/devFlagsStore";
import { DEFAULT_DEV_FLAGS } from "../../src/config/flags";

const DEFAULT_PROFILE: Profile = {
  belt: "White",
  stripes: "0",
  academy: "",
  professor: "",
  lastPromotionDate: "",
};

type Profile = {
  belt: string;
  stripes: string; // keep as string for easy input
  academy: string;
  professor: string;
  lastPromotionDate: string; // YYYY-MM-DD, optional for now but may be useful for future insights
  weight?: string;            // keep as string for easy input
};

const BELTS = ["White", "Blue", "Purple", "Brown", "Black"];
const beltAccent = (b: string) => {
  switch (b) {
    case "White":
      return "#E5E7EB"; // soft white/gray
    case "Blue":
      return "#3B82F6";
    case "Purple":
      return "#A855F7";
    case "Brown":
      return "#A16207";
    case "Black":
      return "#EF4444"; // red ring for black belt (per your request)
    default:
      return "#6c7cff";
  }
};

async function loadProfile(): Promise<Profile> {
  const raw = await AsyncStorage.getItem(StorageKeys.profile);
  if (!raw) return DEFAULT_PROFILE;

  try {
    const parsed = JSON.parse(raw);
    return {
      belt: parsed?.belt ?? DEFAULT_PROFILE.belt,
      stripes: String(parsed?.stripes ?? DEFAULT_PROFILE.stripes),
      academy: parsed?.academy ?? DEFAULT_PROFILE.academy,
      professor: parsed?.professor ?? DEFAULT_PROFILE.professor,
      lastPromotionDate: String(parsed?.lastPromotionDate ?? DEFAULT_PROFILE.lastPromotionDate),
      weight: String(parsed?.weight ?? ""),
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

async function saveProfile(p: Profile) {
  await AsyncStorage.setItem(StorageKeys.profile, JSON.stringify(p));
}

export default function ProfileScreen() {
  const [devFlags, setDevFlags] = useState(DEFAULT_DEV_FLAGS);

  useEffect(() => {
    (async () => {
      if (!isDev()) return;
      const flags = await loadDevFlags();
      setDevFlags(flags);
    })();
  }, []);

  const [loading, setLoading] = useState(true);
  const [belt, setBelt] = useState("White");
  const [stripes, setStripes] = useState("0");
  const [academy, setAcademy] = useState("");
  const [professor, setProfessor] = useState("");
  const [lastPromotionDate, setLastPromotionDate] = useState("");
  const [weight, setWeight] = useState("");

  useEffect(() => {
    (async () => {
      const p = await loadProfile();
      setBelt(p.belt);
      setStripes(p.stripes);
      setWeight(p.weight ?? "");
      setAcademy(p.academy);
      setProfessor(p.professor);
      setLastPromotionDate(p.lastPromotionDate);
      setLoading(false);
    })();
  }, []);

  async function onSave() {
    const sNum = Number(stripes);
    if (Number.isNaN(sNum) || sNum < 0 || sNum > 4) {
      Alert.alert("Stripes must be 0–4");
      return;
    }

    await saveProfile({ belt, stripes, academy, professor, lastPromotionDate, weight });
    Alert.alert("Saved", "Your profile has been updated.");
  }

  if (loading) {
    return (
      <SafeAreaView style={(StyleSheet.create({
        container: { flex: 1, backgroundColor: "#0b0b0f" },
        scroll: { padding: 16, paddingBottom: 40 },
        h1: { fontSize: 24, fontWeight: "700", color: "white" },
        subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
        label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
        input: {
          backgroundColor: "#161621",
          borderRadius: 10,
          padding: 12,
          color: "white",
          borderWidth: 1,
          borderColor: "#2a2a3a",
        },
        pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
        pill: {
          color: "#cfcfe6",
          backgroundColor: "#161621",
          borderWidth: 2, // <-- was 1
          borderColor: "#2a2a3a",
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 999,
          overflow: "hidden",
        },
        pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
      })).container}>
        <Text style={(StyleSheet.create({
          container: { flex: 1, backgroundColor: "#0b0b0f" },
          scroll: { padding: 16, paddingBottom: 40 },
          h1: { fontSize: 24, fontWeight: "700", color: "white" },
          subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
          label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
          input: {
            backgroundColor: "#161621",
            borderRadius: 10,
            padding: 12,
            color: "white",
            borderWidth: 1,
            borderColor: "#2a2a3a",
          },
          pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
          pill: {
            color: "#cfcfe6",
            backgroundColor: "#161621",
            borderWidth: 2, // <-- was 1
            borderColor: "#2a2a3a",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            overflow: "hidden",
          },
          pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
        })).subtle}>Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
  <SafeAreaView style={(StyleSheet.create({  
    container: { flex: 1, backgroundColor: "#0b0b0f" },
      scroll: { padding: 16, paddingBottom: 40 },
      h1: { fontSize: 24, fontWeight: "700", color: "white" },
      subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
      label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
      input: {
        backgroundColor: "#161621",
        borderRadius: 10,
        padding: 12,
        color: "white",
        borderWidth: 1,
        borderColor: "#2a2a3a",
      },
      pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
      pill: {
        color: "#cfcfe6",
        backgroundColor: "#161621",
        borderWidth: 2, // <-- was 1
        borderColor: "#2a2a3a",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        overflow: "hidden",
      },
      pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
    })).container}> 
    <KeyboardAwareScrollView
  contentContainerStyle={(StyleSheet.create({
          container: { flex: 1, backgroundColor: "#0b0b0f" },
          scroll: { padding: 16, paddingBottom: 40 },
          h1: { fontSize: 24, fontWeight: "700", color: "white" },
          subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
          label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
          input: {
            backgroundColor: "#161621",
            borderRadius: 10,
            padding: 12,
            color: "white",
            borderWidth: 1,
            borderColor: "#2a2a3a",
          },
          pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
          pill: {
            color: "#cfcfe6",
            backgroundColor: "#161621",
            borderWidth: 2, // <-- was 1
            borderColor: "#2a2a3a",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            overflow: "hidden",
          },
          pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
        })).scroll}
  keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag"
  enableOnAndroid
  extraScrollHeight={80}
>
      {/* Onboarding */}
      <View style={{ marginTop: 18, marginBottom: 20, alignItems: "center" }}>
        <Text style={{ fontSize: 28, fontWeight: "800", letterSpacing: 1, color: "white" }}>
          TRAIN.
        </Text>
        <Text style={{ fontSize: 28, fontWeight: "800", letterSpacing: 1, color: "white" }}>
          REFLECT.
        </Text>
        <Text style={{ fontSize: 28, fontWeight: "800", letterSpacing: 1, color: "white" }}>
          IMPROVE.
        </Text>

        <View style={{ height: 12 }} />

        <Text style={{ fontSize: 14, opacity: 0.75, color: "white" }}>Log your sessions.</Text>
        <Text style={{ fontSize: 14, opacity: 0.75, color: "white" }}>Notice your patterns.</Text>
        <Text style={{ fontSize: 14, opacity: 0.75, color: "white" }}>Build your game over time.</Text>
      </View>

      <View style={{ height: 12 }} />

      {/* Belt Rank */}
      <Text style={(StyleSheet.create({
          container: { flex: 1, backgroundColor: "#0b0b0f" },
          scroll: { padding: 16, paddingBottom: 40 },
          h1: { fontSize: 24, fontWeight: "700", color: "white" },
          subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
          label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
          input: {
            backgroundColor: "#161621",
            borderRadius: 10,
            padding: 12,
            color: "white",
            borderWidth: 1,
            borderColor: "#2a2a3a",
          },
          pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
          pill: {
            color: "#cfcfe6",
            backgroundColor: "#161621",
            borderWidth: 2, // <-- was 1
            borderColor: "#2a2a3a",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            overflow: "hidden",
          },
          pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
        })).label}>Belt Rank</Text>
      <View style={(StyleSheet.create({
          container: { flex: 1, backgroundColor: "#0b0b0f" },
          scroll: { padding: 16, paddingBottom: 40 },
          h1: { fontSize: 24, fontWeight: "700", color: "white" },
          subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
          label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
          input: {
            backgroundColor: "#161621",
            borderRadius: 10,
            padding: 12,
            color: "white",
            borderWidth: 1,
            borderColor: "#2a2a3a",
          },
          pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
          pill: {
            color: "#cfcfe6",
            backgroundColor: "#161621",
            borderWidth: 2, // <-- was 1
            borderColor: "#2a2a3a",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            overflow: "hidden",
          },
          pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
        })).pillRow}>
        {BELTS.map((b) => (
          <Text
            key={b}
            onPress={() => setBelt(b)}
            style={[
              (StyleSheet.create({
                container: { flex: 1, backgroundColor: "#0b0b0f" },
                scroll: { padding: 16, paddingBottom: 40 },
                h1: { fontSize: 24, fontWeight: "700", color: "white" },
                subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
                label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
                input: {
                  backgroundColor: "#161621",
                  borderRadius: 10,
                  padding: 12,
                  color: "white",
                  borderWidth: 1,
                  borderColor: "#2a2a3a",
                },
                pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
                pill: {
                  color: "#cfcfe6",
                  backgroundColor: "#161621",
                  borderWidth: 2, // <-- was 1
                  borderColor: "#2a2a3a",
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  overflow: "hidden",
                },
                pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
              })).pill,
              belt === b ? (StyleSheet.create({
                container: { flex: 1, backgroundColor: "#0b0b0f" },
                scroll: { padding: 16, paddingBottom: 40 },
                h1: { fontSize: 24, fontWeight: "700", color: "white" },
                subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
                label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
                input: {
                  backgroundColor: "#161621",
                  borderRadius: 10,
                  padding: 12,
                  color: "white",
                  borderWidth: 1,
                  borderColor: "#2a2a3a",
                },
                pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
                pill: {
                  color: "#cfcfe6",
                  backgroundColor: "#161621",
                  borderWidth: 2, // <-- was 1
                  borderColor: "#2a2a3a",
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  overflow: "hidden",
                },
                pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
              })).pillActive : null,
              belt === b ? { borderColor: beltAccent(b) } : null,
              belt === b
                ? {
                    shadowColor: beltAccent(b),
                    shadowOpacity: 0.55,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 6,
                  }
                : null,
            ]}
          >
            {b}
          </Text>
        ))}
      </View>

      {/* Last Promotion Date */}
      <Text style={(StyleSheet.create({
          container: { flex: 1, backgroundColor: "#0b0b0f" },
          scroll: { padding: 16, paddingBottom: 40 },
          h1: { fontSize: 24, fontWeight: "700", color: "white" },
          subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
          label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
          input: {
            backgroundColor: "#161621",
            borderRadius: 10,
            padding: 12,
            color: "white",
            borderWidth: 1,
            borderColor: "#2a2a3a",
          },
          pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
          pill: {
            color: "#cfcfe6",
            backgroundColor: "#161621",
            borderWidth: 2, // <-- was 1
            borderColor: "#2a2a3a",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            overflow: "hidden",
          },
          pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
        })).label}>Last Promotion Date</Text>
      <TextInput
        value={lastPromotionDate}
        onChangeText={setLastPromotionDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#6f6f86"
        style={(StyleSheet.create({
          container: { flex: 1, backgroundColor: "#0b0b0f" },
          scroll: { padding: 16, paddingBottom: 40 },
          h1: { fontSize: 24, fontWeight: "700", color: "white" },
          subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
          label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
          input: {
            backgroundColor: "#161621",
            borderRadius: 10,
            padding: 12,
            color: "white",
            borderWidth: 1,
            borderColor: "#2a2a3a",
          },
          pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
          pill: {
            color: "#cfcfe6",
            backgroundColor: "#161621",
            borderWidth: 2, // <-- was 1
            borderColor: "#2a2a3a",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            overflow: "hidden",
          },
          pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
        })).input}
      />
      <Text style={(StyleSheet.create({
          container: { flex: 1, backgroundColor: "#0b0b0f" },
          scroll: { padding: 16, paddingBottom: 40 },
          h1: { fontSize: 24, fontWeight: "700", color: "white" },
          subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
          label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
          input: {
            backgroundColor: "#161621",
            borderRadius: 10,
            padding: 12,
            color: "white",
            borderWidth: 1,
            borderColor: "#2a2a3a",
          },
          pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
          pill: {
            color: "#cfcfe6",
            backgroundColor: "#161621",
            borderWidth: 2, // <-- was 1
            borderColor: "#2a2a3a",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            overflow: "hidden",
          },
          pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
        })).subtle}>Example: 2025-11-03</Text>

      {/* Stripes */}
      <Text style={(StyleSheet.create({
          container: { flex: 1, backgroundColor: "#0b0b0f" },
          scroll: { padding: 16, paddingBottom: 40 },
          h1: { fontSize: 24, fontWeight: "700", color: "white" },
          subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
          label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
          input: {
            backgroundColor: "#161621",
            borderRadius: 10,
            padding: 12,
            color: "white",
            borderWidth: 1,
            borderColor: "#2a2a3a",
          },
          pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
          pill: {
            color: "#cfcfe6",
            backgroundColor: "#161621",
            borderWidth: 2, // <-- was 1
            borderColor: "#2a2a3a",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            overflow: "hidden",
          },
          pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
        })).label}>Stripes (0–4)</Text>
      <TextInput
        value={stripes}
        onChangeText={setStripes}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor="#6f6f86"
        style={(StyleSheet.create({
          container: { flex: 1, backgroundColor: "#0b0b0f" },
          scroll: { padding: 16, paddingBottom: 40 },
          h1: { fontSize: 24, fontWeight: "700", color: "white" },
          subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
          label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
          input: {
            backgroundColor: "#161621",
            borderRadius: 10,
            padding: 12,
            color: "white",
            borderWidth: 1,
            borderColor: "#2a2a3a",
          },
          pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
          pill: {
            color: "#cfcfe6",
            backgroundColor: "#161621",
            borderWidth: 2, // <-- was 1
            borderColor: "#2a2a3a",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            overflow: "hidden",
          },
          pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
        })).input}
      />

      {/* Weight */}
      <Text style={(StyleSheet.create({
          container: { flex: 1, backgroundColor: "#0b0b0f" },
          scroll: { padding: 16, paddingBottom: 40 },
          h1: { fontSize: 24, fontWeight: "700", color: "white" },
          subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
          label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
          input: {
            backgroundColor: "#161621",
            borderRadius: 10,
            padding: 12,
            color: "white",
            borderWidth: 1,
            borderColor: "#2a2a3a",
          },
          pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
          pill: {
            color: "#cfcfe6",
            backgroundColor: "#161621",
            borderWidth: 2, // <-- was 1
            borderColor: "#2a2a3a",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            overflow: "hidden",
          },
          pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
        })).label}>Weight (lbs)</Text>
      <TextInput
        value={weight}
        onChangeText={(t) => setWeight(t.replace(/[^\d.]/g, ""))}
        keyboardType="decimal-pad"
        placeholder="e.g., 182.5"
        placeholderTextColor="#6f6f86"
        style={(StyleSheet.create({
          container: { flex: 1, backgroundColor: "#0b0b0f" },
          scroll: { padding: 16, paddingBottom: 40 },
          h1: { fontSize: 24, fontWeight: "700", color: "white" },
          subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
          label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
          input: {
            backgroundColor: "#161621",
            borderRadius: 10,
            padding: 12,
            color: "white",
            borderWidth: 1,
            borderColor: "#2a2a3a",
          },
          pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
          pill: {
            color: "#cfcfe6",
            backgroundColor: "#161621",
            borderWidth: 2, // <-- was 1
            borderColor: "#2a2a3a",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            overflow: "hidden",
          },
          pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
        })).input}
      />

      {/* Academy */}
      <Text style={(StyleSheet.create({
          container: { flex: 1, backgroundColor: "#0b0b0f" },
          scroll: { padding: 16, paddingBottom: 40 },
          h1: { fontSize: 24, fontWeight: "700", color: "white" },
          subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
          label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
          input: {
            backgroundColor: "#161621",
            borderRadius: 10,
            padding: 12,
            color: "white",
            borderWidth: 1,
            borderColor: "#2a2a3a",
          },
          pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
          pill: {
            color: "#cfcfe6",
            backgroundColor: "#161621",
            borderWidth: 2, // <-- was 1
            borderColor: "#2a2a3a",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            overflow: "hidden",
          },
          pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
        })).label}>Academy</Text>
      <TextInput
        value={academy}
        onChangeText={setAcademy}
        placeholder="Your gym / academy"
        placeholderTextColor="#6f6f86"
        style={(StyleSheet.create({
          container: { flex: 1, backgroundColor: "#0b0b0f" },
          scroll: { padding: 16, paddingBottom: 40 },
          h1: { fontSize: 24, fontWeight: "700", color: "white" },
          subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
          label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
          input: {
            backgroundColor: "#161621",
            borderRadius: 10,
            padding: 12,
            color: "white",
            borderWidth: 1,
            borderColor: "#2a2a3a",
          },
          pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
          pill: {
            color: "#cfcfe6",
            backgroundColor: "#161621",
            borderWidth: 2, // <-- was 1
            borderColor: "#2a2a3a",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            overflow: "hidden",
          },
          pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
        })).input}
      />

      {/* Professor */}
      <Text style={(StyleSheet.create({
          container: { flex: 1, backgroundColor: "#0b0b0f" },
          scroll: { padding: 16, paddingBottom: 40 },
          h1: { fontSize: 24, fontWeight: "700", color: "white" },
          subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
          label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
          input: {
            backgroundColor: "#161621",
            borderRadius: 10,
            padding: 12,
            color: "white",
            borderWidth: 1,
            borderColor: "#2a2a3a",
          },
          pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
          pill: {
            color: "#cfcfe6",
            backgroundColor: "#161621",
            borderWidth: 2, // <-- was 1
            borderColor: "#2a2a3a",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            overflow: "hidden",
          },
          pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
        })).label}>Professor / Coach</Text>
      <TextInput
        value={professor}
        onChangeText={setProfessor}
        placeholder="Head coach / professor"
        placeholderTextColor="#6f6f86"
        style={(StyleSheet.create({
          container: { flex: 1, backgroundColor: "#0b0b0f" },
          scroll: { padding: 16, paddingBottom: 40 },
          h1: { fontSize: 24, fontWeight: "700", color: "white" },
          subtle: { color: "#b9b9c4", marginTop: 6, lineHeight: 18 },
          label: { color: "white", marginTop: 14, marginBottom: 6, fontWeight: "600" },
          input: {
            backgroundColor: "#161621",
            borderRadius: 10,
            padding: 12,
            color: "white",
            borderWidth: 1,
            borderColor: "#2a2a3a",
          },
          pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
          pill: {
            color: "#cfcfe6",
            backgroundColor: "#161621",
            borderWidth: 2, // <-- was 1
            borderColor: "#2a2a3a",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            overflow: "hidden",
          },
          pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
        })).input}
      />

      {/* Save */}
      <Text style={{ color: "#9aa0a6", fontSize: 12, marginBottom: 6 }}>
        Changes aren’t saved until you tap Save.
      </Text>

      <Button title="Save Profile" onPress={onSave} />
      <View style={{ height: 16 }} />
    
      {isDev() ? (
        <Pressable
          onPress={() => router.push("/profile/dev-settings")}
          style={{
            marginTop: 16,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
            backgroundColor: "#111111",
            borderColor: "#111111",
            }}
        >
          <Text style={{ fontSize: 16, color: "#ffffff" }}>Developer Settings</Text>
          <Text style={{ marginTop: 4, fontSize: 12, opacity: 0.8, color: "#ffffff" }}>
            Dev-only feature flags
          </Text>
        </Pressable>
      ) : null}

      {isDev() && devFlags.enableCoachShareScaffold ? (
        <Pressable
          onPress={() => router.push("/profile/coaches")}
          style={{
            marginTop: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
          }}
        >
          <Text style={{ fontSize: 16 }}>Coaches & Programs</Text>
          <Text style={{ marginTop: 4, fontSize: 12, opacity: 0.65 }}>
            Coach Share scaffold (dev only)
          </Text>
        </Pressable>
      ) : null}

</KeyboardAwareScrollView>
  </SafeAreaView>
);
}