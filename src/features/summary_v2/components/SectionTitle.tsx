import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  title: string;
};

export default function SectionTitle({ title }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  text: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});
