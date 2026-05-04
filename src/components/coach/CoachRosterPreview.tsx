import { StyleSheet, Text, View } from "react-native";

export default function CoachRosterPreview() {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Athletes</Text>
      <Text style={styles.title}>Roster (coming next)</Text>
      <View style={styles.placeholderList}>
        <View style={styles.placeholderRow} />
        <View style={styles.placeholderRow} />
        <View style={styles.placeholderRow} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#171b20",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#26303a",
    padding: 16,
  },
  label: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 14,
  },
  placeholderList: {
    gap: 10,
  },
  placeholderRow: {
    height: 42,
    borderRadius: 8,
    backgroundColor: "#20252b",
    borderWidth: 1,
    borderColor: "#28313c",
  },
});
