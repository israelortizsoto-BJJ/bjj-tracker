import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { isDev } from "../../src/config/runtime";
import { useDevFlags } from "../../src/config/useDevFlags";
import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StorageKeys } from "../../src/storage/storageKeys";
import { getDeviceRole } from "../../src/storage/deviceRoleStore";
import { safeReplace } from "../../src/navigation/safeNavigate";
import MatMindLogo from "../../assets/images/matmind-logo.png";


type Profile = {
  belt: string;
  stripes: string;
  academy: string;
  professor: string;
};

export default function Welcome() {
  const router = useRouter();
  const params = useLocalSearchParams<{ force?: string }>();
  const { flags } = useDevFlags();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const forceBypass =
        isDev() &&
        typeof params.force === "string" &&
        ["1", "true", "yes"].includes(params.force.toLowerCase());

      if (forceBypass) {
        if (!cancelled) {
          setChecking(false);
        }
        return;
      }

      let shouldRedirectAfterProfileComplete = false;

      try {
        const raw = await AsyncStorage.getItem(StorageKeys.profile);
        if (raw) {
          try {
            const p = JSON.parse(raw) as Profile;
            const isComplete =
              !!p?.belt && p?.stripes !== undefined && !!p?.academy && !!p?.professor;

            if (isComplete) {
              shouldRedirectAfterProfileComplete = true;
            }
          } catch {
            // ignore parse errors and fall through to showing Welcome
          }
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }

        if (!cancelled && shouldRedirectAfterProfileComplete) {
          const role = await getDeviceRole();
          if (role === "parent" || role === "coach") {
            queueMicrotask(() => {
              safeReplace(router, "/this-week");
            });
          } else {
            queueMicrotask(() => {
              safeReplace(router, "/training");
            });
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, params.force]);

  if (checking) {
    return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.subtle}>Loading…</Text>
      </View>
    </SafeAreaView>
  );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          {/* Hero / brand area */}
          <View style={styles.heroRow}>
            <View style={styles.logoWrapper}>
              <Image
                source={MatMindLogo}
                style={styles.logo}
                resizeMode="contain"
                accessible
                accessibilityRole="image"
                accessibilityLabel="MatMind logo"
              />
            </View>
            <View style={styles.heroTextCol}>
              <Text style={styles.appName}>MatMind</Text>
              <Text style={styles.taglinePrimary}>Your jiu-jitsu training journal.</Text>
              <Text style={styles.taglineSecondary}>
                Capture sessions, notice patterns, and build your game over time.
              </Text>
            </View>
          </View>

          {/* Next paths */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>WHERE TO START</Text>
          </View>

          {/* Profile / belt journey */}
          <Pressable
            onPress={() => router.push("/profile")}
            style={({ pressed }) => [
              styles.card,
              styles.cardPrimary,
              pressed && styles.cardPressed,
            ]}
          >
            <Text style={styles.cardTitle}>Profile & Belt Journey</Text>
            <Text style={styles.cardBody}>
              Save your belt, stripes, academy, and coach so MatMind can reflect your jiu-jitsu path.
            </Text>
          </Pressable>

          {/* Training (primary) */}
          <Pressable
            onPress={() => router.replace("/training")}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
          >
            <Text style={styles.cardTitle}>Training Log</Text>
            <Text style={styles.cardBody}>
              Go straight to your calendar to log training sessions and see your week at a glance.
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/learn")}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <Text style={styles.cardTitle}>Learn</Text>
            <Text style={styles.cardBody}>
              Fundamentals map and gear basics — quick references alongside your training log.
            </Text>
          </Pressable>

          {/* Dev shortcuts (unchanged behavior) */}
          {isDev() && flags.enableHiddenTabs ? (
            <View style={styles.devShortcuts}>
              <Text style={styles.devLabel}>DEV SHORTCUTS</Text>
              <Pressable
                onPress={() => router.push("/health")}
                style={({ pressed }) => [
                  styles.devButton,
                  pressed && styles.devButtonPressed,
                ]}
              >
                <Text style={styles.devButtonText}>Open Health (hidden)</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/learn/gear")}
                style={({ pressed }) => [
                  styles.devButton,
                  pressed && styles.devButtonPressed,
                ]}
              >
                <Text style={styles.devButtonText}>Open Gear (learn stack)</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/learn/fundamentals")}
                style={({ pressed }) => [
                  styles.devButton,
                  pressed && styles.devButtonPressed,
                ]}
              >
                <Text style={styles.devButtonText}>Open Fundamentals (learn stack)</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "center",
  },
  subtle: {
    color: "#cbd5e1",
    fontSize: 14,
  },
  heroRow: {
    flexDirection: "row",
    gap: 22,
    alignItems: "center",
    marginBottom: 38,
  },
  logoWrapper: {
    width: 72,
    height: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    overflow: "hidden",
  },
  logo: {
    width: "84%",
    height: "84%",
  },
  heroTextCol: {
    flex: 1,
  },
  appName: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "#020617",
  },
  taglinePrimary: {
    marginTop: 6,
    fontSize: 16,
    color: "#111827",
  },
  taglineSecondary: {
    marginTop: 4,
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1.1,
    color: "#6b7280",
    fontWeight: "600",
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  cardPrimary: {
    borderColor: "#1d4ed8",
  },
  cardPressed: {
    backgroundColor: "#edf2ff",
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  cardBody: {
    marginTop: 6,
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
  },
  comingSoonLabel: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#94a3b8",
  },
  devShortcuts: {
    marginTop: 28,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 16,
    gap: 8,
  },
  devLabel: {
    color: "#6b7280",
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: "600",
  },
  devButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  devButtonPressed: {
    backgroundColor: "#e5e7eb",
  },
  devButtonText: {
    color: "#4b5563",
    fontSize: 13,
    fontWeight: "500",
  },
});