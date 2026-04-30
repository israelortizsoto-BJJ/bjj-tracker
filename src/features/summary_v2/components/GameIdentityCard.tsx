import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function GameIdentityCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>GAME IDENTITY</Text>
      <Text style={styles.body}>Pressure first. Finish fast.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
    padding: 12,
    marginBottom: 24,
    backgroundColor: "#0f172a",
  },
  title: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  body: {
    color: "#E2E8F0",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },
});
