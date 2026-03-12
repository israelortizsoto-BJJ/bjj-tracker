import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CATEGORIES = [
  {
    id: "standing_takedowns",
    label: "Standing & Takedowns",
    description: "Start safely on your feet and learn simple ways to bring the match to the ground.",
    examples: ["Grip fighting basics", "Single leg", "Double leg", "Guard pull to seated guard"],
  },
  {
    id: "guard_bottom",
    label: "Guard (Bottom)",
    description: "Use your legs and hips to control space and stay safe when you’re on bottom.",
    examples: ["Closed guard", "Hip bump sweep", "Scissor sweep", "Triangle from guard"],
  },
  {
    id: "top_control_passing",
    label: "Top Control & Passing",
    description: "Stay heavy, balanced, and learn how to pass common guards without losing control.",
    examples: ["Knee cut pass", "Toreando pass", "Body lock pass", "Side control basics"],
  },
  {
    id: "escapes_defense",
    label: "Escapes & Defense",
    description: "Practice safe ways to get out of bad spots and return to strong positions.",
    examples: ["Side control hip escape", "Trap and roll from mount", "Back escapes", "Submission defenses"],
  },
  {
    id: "submissions",
    label: "Submissions",
    description: "Learn classic submissions with a focus on good control, safety, and clean finishes.",
    examples: ["Armbar", "Triangle choke", "Rear naked choke", "Cross collar choke (gi)"],
  },
  {
    id: "movement_drills",
    label: "Movement & Solo Drills",
    description: "Build balance, coordination, and core movements that make everything else easier.",
    examples: ["Shrimping", "Bridging", "Technical stand‑up", "Granby-style rolls"],
  },
] as const;

export default function FundamentalsHome() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Fundamentals</Text>
            <Text style={styles.subtitle}>
              A simple map of core jiu-jitsu positions, escapes, and movements for kids and beginners.
            </Text>
          </View>

          {/* Categories */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>FOUNDATION AREAS</Text>
          </View>

          {CATEGORIES.map((cat) => (
            <View key={cat.id} style={styles.card}>
              <Text style={styles.cardTitle}>{cat.label}</Text>
              <Text style={styles.cardBody}>{cat.description}</Text>

              <View style={styles.examplesBlock}>
                <Text style={styles.examplesLabel}>You might see:</Text>
                {cat.examples.map((ex) => (
                  <Text key={ex} style={styles.exampleItem}>
                    • {ex}
                  </Text>
                ))}
              </View>
            </View>
          ))}

          {/* Honest footer note */}
          <View style={styles.footerNoteWrapper}>
            <Text style={styles.footerNoteTitle}>Honest preview</Text>
            <Text style={styles.footerNoteBody}>
              Deeper step‑by‑step lessons and coach‑authored plans will come later. For now, this tab is a clear
              starting map so families can see how BJJ fundamentals are organized.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "#020617",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#4b5563",
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
  examplesBlock: {
    marginTop: 10,
  },
  examplesLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 4,
  },
  exampleItem: {
    fontSize: 13,
    color: "#4b5563",
    lineHeight: 18,
  },
  footerNoteWrapper: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  footerNoteTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#6b7280",
    marginBottom: 4,
  },
  footerNoteBody: {
    fontSize: 13,
    lineHeight: 19,
    color: "#6b7280",
  },
});

