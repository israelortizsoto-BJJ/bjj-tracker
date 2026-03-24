import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useDeviceRole } from "../src/deviceRole/DeviceRoleProvider";
import type { DeviceRole } from "../src/storage/deviceRoleStore";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  primaryFill: "#1d4ed8",
  primaryFillPressed: "#1e40af",
};

export default function RolePickerScreen() {
  const router = useRouter();
  const { setRole } = useDeviceRole();
  const [busy, setBusy] = useState(false);

  async function choose(next: DeviceRole) {
    if (busy) return;
    setBusy(true);
    try {
      await setRole(next);
      router.replace("/welcome");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.inner}>
          <Text style={styles.kicker}>MATMIND PILOT</Text>
          <Text style={styles.title}>How will you use MatMind on this phone?</Text>
          <Text style={styles.subtitle}>
            Pick the pilot lane that matches this device. You can change this later in Profile for
            internal testing — your saved data stays on this phone.
          </Text>

          <Pressable
            disabled={busy}
            onPress={() => void choose("coach")}
            style={({ pressed }) => [
              styles.card,
              styles.cardPrimary,
              (pressed || busy) && styles.cardPressed,
              busy && styles.cardDisabled,
            ]}
          >
            <Text style={styles.cardTitle}>I&apos;m a coach</Text>
            <Text style={styles.cardBody}>
              Roster, family invites, weekly notes for families, and coach pilot tools.
            </Text>
          </Pressable>

          <Pressable
            disabled={busy}
            onPress={() => void choose("parent")}
            style={({ pressed }) => [
              styles.card,
              (pressed || busy) && styles.cardPressed,
              busy && styles.cardDisabled,
            ]}
          >
            <Text style={styles.cardTitle}>I&apos;m a parent</Text>
            <Text style={styles.cardBody}>
              This week with your coach, connect with a link, read together, and family competition.
            </Text>
          </Pressable>

          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color={UI.primaryFill} />
              <Text style={styles.busyLabel}>Saving…</Text>
            </View>
          ) : null}
        </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.screenBg },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    color: UI.textSecondary,
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: UI.textPrimary,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 15,
    color: UI.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.bgCard,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  cardPrimary: {
    borderColor: UI.primaryFill,
  },
  cardPressed: {
    backgroundColor: "#edf2ff",
  },
  cardDisabled: {
    opacity: 0.7,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: UI.textPrimary,
  },
  cardBody: {
    marginTop: 8,
    fontSize: 15,
    color: UI.textSecondary,
    lineHeight: 22,
  },
  busyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  busyLabel: {
    fontSize: 14,
    color: UI.textSecondary,
  },
});
