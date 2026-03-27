import { Stack, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LearnHome() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Learn" }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <Text style={styles.title}>Learn</Text>
          <Text style={styles.subtitle}>
            Fundamentals and gear basics — quick references for families and beginners.
          </Text>

          <Text style={styles.sectionLabel}>CHOOSE A TOPIC</Text>

          <Pressable
            onPress={() => router.push("/learn/fundamentals")}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <Text style={styles.cardTitle}>Fundamentals</Text>
            <Text style={styles.cardBody}>
              A simple map of core positions, escapes, and movements for kids and beginners.
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/learn/gear")}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <Text style={styles.cardTitle}>Gear & hygiene</Text>
            <Text style={styles.cardBody}>
              Gi, no-gi, washing, and hygiene — kid-and-parent friendly for close-contact training.
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32, paddingBottom: 44 },
  inner: { flex: 1 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: 0.5, color: "#020617" },
  subtitle: { marginTop: 8, marginBottom: 24, fontSize: 14, lineHeight: 20, color: "#4b5563" },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1.1,
    color: "#6b7280",
    fontWeight: "600",
    marginBottom: 12,
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
  cardPressed: { backgroundColor: "#edf2ff" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  cardBody: { marginTop: 6, fontSize: 14, color: "#4b5563", lineHeight: 20 },
});
