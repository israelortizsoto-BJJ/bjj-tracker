import { View, Text, StyleSheet } from "react-native";
import Icon from "src/components/Icon";

export default function MetricTile({ label, value, icon }: any) {
  return (
    <View style={styles.tile}>
      <Icon name={icon} size={20} />
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: "48%",
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  value: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 10,
  },
  label: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 4,
  },
});
