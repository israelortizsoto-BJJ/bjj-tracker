import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CoachHeader from "../../components/coach/CoachHeader";
import CoachRoster from "./CoachRoster";

export default function CoachScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <CoachHeader />

        <Pressable
          onPress={() => router.push("/coach/kids")}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed ? styles.primaryButtonPressed : null,
          ]}
        >
          <Text style={styles.primaryButtonText}>Add Athlete</Text>
        </Pressable>

        <View style={styles.section}>
          <CoachRoster />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0b0f12",
  },
  screen: {
    flex: 1,
    backgroundColor: "#0b0f12",
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#d4ad4f",
    borderRadius: 10,
    marginTop: 16,
    paddingVertical: 13,
  },
  primaryButtonPressed: {
    opacity: 0.76,
  },
  primaryButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  section: {
    marginTop: 16,
  },
});
