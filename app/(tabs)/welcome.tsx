import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Button, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StorageKeys } from "../../src/storage/storageKeys";


type Profile = {
  belt: string;
  stripes: string;
  academy: string;
  professor: string;
};

export default function Welcome() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(StorageKeys.profile);
      if (raw) {
        try {
          const p = JSON.parse(raw) as Profile;
          const isComplete =
            !!p?.belt && p?.stripes !== undefined && !!p?.academy && !!p?.professor;

          if (isComplete) {
            router.replace("/training");
            return;
          }
        } catch {
          // ignore and show welcome
        }
      }
      setChecking(false);
    })();
  }, [router]);

  if (checking) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.subtle}>Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>BJJ Tracker</Text>
        <Text style={styles.subtitle}>
          Track your progress — technique, drills, notes, and media — with a simple
          weekly system.
        </Text>

        <View style={{ height: 18 }} />

        <Button title="Set up my profile" onPress={() => router.push("/profile")} />
        <View style={{ height: 10 }} />
        <Button title="Go to Training Log" onPress={() => router.replace("/training")} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0b0f" },
  inner: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "800", color: "white" },
  subtitle: { marginTop: 10, color: "#b9b9c4", lineHeight: 20 },
  subtle: { color: "#b9b9c4", padding: 20 },
});