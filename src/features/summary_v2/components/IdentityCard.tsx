import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  title: string;
  score: number;
};

export default function IdentityCard({ title, score }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.ringWrap}>
          <View style={styles.ringOuter}>
            <View style={styles.ringInner}>
              <Text style={styles.scoreText}>{score}</Text>
            </View>
          </View>
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={4}>
            {title}
          </Text>
          <Text style={styles.subtitle}>Built from training and competition data</Text>
        </View>
      </View>
    </View>
  );
}

const RING = 106;
const RING_BORDER = 4;

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  ringWrap: {
    width: RING,
    height: RING,
    justifyContent: "center",
    alignItems: "center",
  },
  ringOuter: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: RING_BORDER,
    borderColor: "#7ED957",
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  ringInner: {
    width: RING - RING_BORDER * 2 - 10,
    height: RING - RING_BORDER * 2 - 10,
    borderRadius: (RING - RING_BORDER * 2 - 10) / 2,
    backgroundColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
  },
  scoreText: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "800",
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
});
