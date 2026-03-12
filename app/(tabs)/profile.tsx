import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  ScrollView,
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

function isValidYMDDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const dt = new Date(year, month - 1, day);

  return (
    dt.getFullYear() === year &&
    dt.getMonth() === month - 1 &&
    dt.getDate() === day
  );
}

function formatYMDForDisplay(value: string) {
  if (!isValidYMDDate(value)) return "";
  const [year, month, day] = value.split("-").map(Number);
  const dt = new Date(year, month - 1, day);
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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

const UI = {
  screenBg: "#020617",
  bgCard: "#111827",
  border: "#1f2937",
  textPrimary: "#f9fafb",
  textSecondary: "#cbd5e1",
  pillActiveBorder: "#475569",
};
const CARD_RADIUS = 16;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.screenBg },
  scroll: { padding: 22, paddingBottom: 44 },
  h1: { fontSize: 24, fontWeight: "700", color: UI.textPrimary },
  subtle: { color: UI.textSecondary, marginTop: 6, lineHeight: 20 },
  label: { color: UI.textPrimary, marginTop: 20, marginBottom: 8, fontWeight: "600", fontSize: 15 },
  input: {
    backgroundColor: UI.bgCard,
    borderRadius: 14,
    padding: 14,
    color: UI.textPrimary,
    borderWidth: 1,
    borderColor: UI.border,
    fontSize: 15,
  },
  pillRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    paddingRight: 4,
  },
  pill: {
    color: UI.textSecondary,
    backgroundColor: UI.bgCard,
    borderWidth: 1,
    borderColor: UI.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 15,
  },
  pillActive: { borderColor: UI.pillActiveBorder, backgroundColor: "#111827", color: UI.textPrimary },
});

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

    const normalizedPromotionDate = lastPromotionDate.trim();

    if (normalizedPromotionDate && !isValidYMDDate(normalizedPromotionDate)) {
      Alert.alert("Last Promotion Date must use YYYY-MM-DD");
      return;
    }

    await saveProfile({
      belt,
      stripes,
      academy,
      professor,
      lastPromotionDate: normalizedPromotionDate,
      weight,
    });
    Alert.alert(
      "Saved",
      "Your profile has been updated.",
      [
        {
          text: "OK",
          onPress: () => router.replace("/training"),
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
  contentContainerStyle={styles.scroll}
  keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag"
  enableOnAndroid
  extraScrollHeight={80}
>
      {/* Onboarding */}
      <View style={{ marginTop: 8, marginBottom: 24, alignItems: "center" }}>
        <Text style={{ fontSize: 24, fontWeight: "700", letterSpacing: 0.8, color: UI.textPrimary }}>
          Train.
        </Text>
        <Text style={{ fontSize: 24, fontWeight: "700", letterSpacing: 0.8, color: UI.textPrimary }}>
          Reflect.
        </Text>
        <Text style={{ fontSize: 24, fontWeight: "700", letterSpacing: 0.8, color: UI.textPrimary }}>
          Improve.
        </Text>

        <View style={{ height: 14 }} />

        <Text style={{ fontSize: 15, color: UI.textSecondary }}>Log your sessions.</Text>
        <Text style={{ fontSize: 15, color: UI.textSecondary }}>Notice your patterns.</Text>
        <Text style={{ fontSize: 15, color: UI.textSecondary }}>Build your game over time.</Text>
      </View>

      {/* Belt Rank */}
      <Text style={styles.label}>Belt Rank</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
      >
        {BELTS.map((b) => (
          <Text
            key={b}
            onPress={() => setBelt(b)}
            style={[
              styles.pill,
              belt === b ? styles.pillActive : null,
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
      </ScrollView>

      {/* Last Promotion Date */}
      <Text style={styles.label}>Last Promotion Date</Text>
      <TextInput
        value={lastPromotionDate}
        onChangeText={setLastPromotionDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={UI.textSecondary}
        style={styles.input}
      />
      <Text style={[styles.subtle, { fontSize: 13 }]}>
        Use YYYY-MM-DD for now, for example 2025-09-14.
      </Text>
      {isValidYMDDate(lastPromotionDate.trim()) ? (
        <Text style={[styles.subtle, { fontSize: 13, marginTop: 4 }]}>
          Display: {formatYMDForDisplay(lastPromotionDate.trim())}
        </Text>
      ) : null}
      <Text style={styles.subtle}>Example: 2025-11-03</Text>

      {/* Stripes */}
      <Text style={styles.label}>Stripes (0–4)</Text>
      <TextInput
        value={stripes}
        onChangeText={setStripes}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={UI.textSecondary}
        style={styles.input}
      />

      {/* Weight */}
      <Text style={styles.label}>Weight (lbs)</Text>
      <TextInput
        value={weight}
        onChangeText={(t) => setWeight(t.replace(/[^\d.]/g, ""))}
        keyboardType="decimal-pad"
        placeholder="e.g., 182.5"
        placeholderTextColor={UI.textSecondary}
        style={styles.input}
      />

      {/* Academy */}
      <Text style={styles.label}>Academy</Text>
      <TextInput
        value={academy}
        onChangeText={setAcademy}
        placeholder="Your gym / academy"
        placeholderTextColor={UI.textSecondary}
        style={styles.input}
      />

      {/* Professor */}
      <Text style={styles.label}>Professor / Coach</Text>
      <TextInput
        value={professor}
        onChangeText={setProfessor}
        placeholder="Head coach / professor"
        placeholderTextColor={UI.textSecondary}
        style={styles.input}
      />

      {/* Save */}
      <Pressable
        onPress={onSave}
        style={({ pressed }) => ({
          marginTop: 20,
          paddingVertical: 14,
          paddingHorizontal: 18,
          borderRadius: CARD_RADIUS,
          borderWidth: 1,
          borderColor: UI.border,
          backgroundColor: pressed ? "#111827" : UI.bgCard,
        })}
      >
        <Text style={{ color: UI.textPrimary, fontSize: 16, fontWeight: "700" }}>Save Profile</Text>
      </Pressable>
      <Text style={[styles.subtle, { marginTop: 10, fontSize: 13 }]}>
        Changes aren’t saved until you tap Save.
      </Text>
      <View style={{ height: 20 }} />

      {isDev() ? (
        <Pressable
          onPress={() => router.push("/profile/dev-settings")}
          style={({ pressed }) => ({
            marginTop: 8,
            paddingVertical: 14,
            paddingHorizontal: 18,
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: pressed ? "#111827" : UI.bgCard,
          })}
        >
          <Text style={{ fontSize: 16, color: UI.textPrimary, fontWeight: "600" }}>Developer Settings</Text>
          <Text style={{ marginTop: 4, fontSize: 13, color: UI.textSecondary }}>
            Dev-only feature flags
          </Text>
        </Pressable>
      ) : null}

      {isDev() && devFlags.enableCoachShareScaffold ? (
        <Pressable
          onPress={() => router.push("/profile/coaches")}
          style={({ pressed }) => ({
            marginTop: 12,
            paddingVertical: 14,
            paddingHorizontal: 18,
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: pressed ? "#111827" : UI.bgCard,
          })}
        >
          <Text style={{ fontSize: 16, color: UI.textPrimary, fontWeight: "600" }}>
            Coaches & Programs
          </Text>
          <Text style={{ marginTop: 4, fontSize: 13, color: UI.textSecondary }}>
            Coach Share scaffold (dev only)
          </Text>
        </Pressable>
      ) : null}

</KeyboardAwareScrollView>
  </SafeAreaView>
);
}