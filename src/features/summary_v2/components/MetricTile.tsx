import type { ImageSourcePropType } from "react-native";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

export type MetricAccent = "green" | "blue" | "yellow";

const ACCENT_COLORS: Record<MetricAccent, string> = {
  green: "#22C55E",
  blue: "#3B82F6",
  yellow: "#FACC15",
};

type Props = {
  iconSource: ImageSourcePropType;
  label: string;
  value: string;
  accent: MetricAccent;
};

export default function MetricTile({ iconSource, label, value, accent }: Props) {
  return (
    <View style={styles.shell}>
      <View style={[styles.glow, { backgroundColor: ACCENT_COLORS[accent] }]} />
      <View style={styles.tile}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { borderColor: ACCENT_COLORS[accent] }]}>
            <Image source={iconSource} style={styles.icon} resizeMode="contain" />
          </View>
          <Text style={styles.label} numberOfLines={2}>
            {label}
          </Text>
        </View>
        <Text style={styles.value} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: "48%",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
  },
  glow: {
    position: "absolute",
    top: -22,
    left: -10,
    right: -10,
    height: 60,
    opacity: 0.18,
  },
  body: {
    padding: 16,
    gap: 8,
  },
  tile: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    minHeight: 118,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 41, 59, 0.65)",
    borderWidth: 1,
    marginRight: 8,
  },
  icon: {
    width: 16,
    height: 16,
    tintColor: "#E2E8F0",
  },
  value: {
    color: "#F1F5F9",
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 25,
    marginTop: 2,
  },
  label: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
    lineHeight: 15,
  },
});
