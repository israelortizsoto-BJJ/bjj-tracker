import { StyleSheet, Text, View } from "react-native";

type ProfileItem = {
  label: string;
  value: string;
};

type ProfileCardProps = {
  items: ProfileItem[];
};

export default function ProfileCard({ items }: ProfileCardProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.kicker}>Foundation</Text>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.beltPreview}>
          <View style={styles.belt}>
            <View style={styles.rankBar}>
              <View style={styles.stripe} />
              <View style={styles.stripe} />
            </View>
          </View>
        </View>

        {items.map((item, index) => (
          <View key={item.label} style={[styles.row, index === items.length - 1 && styles.lastRow]}>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Text style={styles.rowValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 22,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  kicker: {
    color: "#34D399",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  title: {
    color: "#F9FAFB",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 2,
  },
  card: {
    backgroundColor: "#12161C",
    borderColor: "#1F2937",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  beltPreview: {
    padding: 16,
    paddingBottom: 10,
  },
  belt: {
    backgroundColor: "#1D4ED8",
    borderColor: "#60A5FA",
    borderRadius: 18,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    overflow: "hidden",
  },
  rankBar: {
    alignItems: "center",
    backgroundColor: "#0B0D10",
    flexDirection: "row",
    gap: 9,
    height: 52,
    paddingHorizontal: 20,
    width: 112,
  },
  stripe: {
    backgroundColor: "#F9FAFB",
    borderRadius: 4,
    height: 32,
    width: 8,
  },
  row: {
    alignItems: "center",
    borderBottomColor: "#1F2937",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 53,
    paddingHorizontal: 16,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    color: "#D1D5DB",
    fontSize: 15,
    fontWeight: "700",
  },
  rowValue: {
    color: "#F9FAFB",
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "800",
    marginLeft: 18,
    textAlign: "right",
  },
});
