import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const PROFILE_KEY = "bjj_profile_v1";

type Profile = {
  belt: string;
  stripes: string; // keep as string for easy input
  academy: string;
  professor: string;
};

const BELTS = ["White", "Blue", "Purple", "Brown", "Black"];

async function loadProfile(): Promise<Profile> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) {
    return { belt: "White", stripes: "0", academy: "", professor: "" };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      belt: parsed?.belt ?? "White",
      stripes: String(parsed?.stripes ?? "0"),
      academy: parsed?.academy ?? "",
      professor: parsed?.professor ?? "",
    };
  } catch {
    return { belt: "White", stripes: "0", academy: "", professor: "" };
  }
}

async function saveProfile(p: Profile) {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [belt, setBelt] = useState("White");
  const [stripes, setStripes] = useState("0");
  const [academy, setAcademy] = useState("");
  const [professor, setProfessor] = useState("");

  useEffect(() => {
    (async () => {
      const p = await loadProfile();
      setBelt(p.belt);
      setStripes(p.stripes);
      setAcademy(p.academy);
      setProfessor(p.professor);
      setLoading(false);
    })();
  }, []);

  async function onSave() {
    const sNum = Number(stripes);
    if (Number.isNaN(sNum) || sNum < 0 || sNum > 4) {
      Alert.alert("Stripes must be 0–4");
      return;
    }

    await saveProfile({ belt, stripes: String(sNum), academy, professor });
    Alert.alert("Saved", "Your profile has been updated.");
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
        <Text style={styles.h1}>Profile</Text>
        <Text style={styles.subtle}>
          Keep this updated as you progress.
        </Text>

        <Text style={styles.label}>Belt Rank</Text>
        <View style={styles.pillRow}>
          {BELTS.map((b) => (
            <Text
              key={b}
              onPress={() => setBelt(b)}
              style={[styles.pill, belt === b ? styles.pillActive : null]}
            >
              {b}
            </Text>
          ))}
        </View>

        <Text style={styles.label}>Stripes (0–4)</Text>
        <TextInput
          value={stripes}
          onChangeText={setStripes}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor="#6f6f86"
          style={styles.input}
        />

        <Text style={styles.label}>Academy</Text>
        <TextInput
          value={academy}
          onChangeText={setAcademy}
          placeholder="Your gym / academy"
          placeholderTextColor="#6f6f86"
          style={styles.input}
        />

        <Text style={styles.label}>Professor / Coach</Text>
        <TextInput
          value={professor}
          onChangeText={setProfessor}
          placeholder="Head coach / professor"
          placeholderTextColor="#6f6f86"
          style={styles.input}
        />

        <View style={{ height: 16 }} />
        <Button title="Save Profile" onPress={onSave} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    borderWidth: 1,
    borderColor: "#2a2a3a",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    overflow: "hidden",
  },
  pillActive: { borderColor: "#6c7cff", backgroundColor: "#1b1c2a", color: "white" },
});