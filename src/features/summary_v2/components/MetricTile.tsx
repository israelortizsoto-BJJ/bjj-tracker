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
    <View style={styles.tile}>
      <View style={[styles.accentBar, { backgroundColor: ACCENT_COLORS[accent] }]} />
      <View style={styles.body}>
        <View style={styles.iconContainer}>
          <Image source={iconSource} style={styles.icon} resizeMode="contain" />
        </View>
        <Text style={styles.value} numberOfLines={2}>
          {value}
        </Text>
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: "48%",
    backgroundColor: "#0F172A",
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  accentBar: {
    height: 3,
    width: "30%",
    alignSelf: "flex-start",
    opacity: 0.82,
  },
  body: {
    padding: 16,
    gap: 10,
  },
  iconContainer: {
    alignSelf: "flex-start",
    backgroundColor: "#1E293B",
    padding: 6,
    borderRadius: 8,
  },
  icon: {
    width: 20,
    height: 20,
    tintColor: "#fff",
  },
  value: {
    color: "#F8FAFC",
    fontSize: 17,
    fontWeight: "800",
  },
  label: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
});
