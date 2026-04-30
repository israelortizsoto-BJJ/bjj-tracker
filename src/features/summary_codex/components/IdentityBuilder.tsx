import { Pressable, StyleSheet, Text, View } from "react-native";

type BuilderGroup = {
  title: string;
  accent: "blue" | "green" | "yellow";
  options: Array<{
    label: string;
    selected?: boolean;
  }>;
};

type IdentityBuilderProps = {
  groups: BuilderGroup[];
  inferredMode: string;
};

const accentColors = {
  blue: "#60A5FA",
  green: "#34D399",
  yellow: "#FACC15",
};

export default function IdentityBuilder({ groups, inferredMode }: IdentityBuilderProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.kicker}>Identity Builder</Text>
        <Text style={styles.title}>Answer. MAT infers.</Text>
      </View>

      <View style={styles.card}>
        {groups.map((group) => (
          <View key={group.title} style={styles.group}>
            <View style={styles.groupHeader}>
              <View style={[styles.groupDot, { backgroundColor: accentColors[group.accent] }]} />
              <Text style={styles.groupTitle}>{group.title}</Text>
            </View>

            <View style={styles.tileWrap}>
              {group.options.map((option) => (
                <Pressable key={option.label} style={[styles.tile, option.selected && styles.selectedTile]}>
                  <Text style={[styles.tileText, option.selected && styles.selectedTileText]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.inferred}>
          <Text style={styles.inferredLabel}>Mode inferred automatically</Text>
          <Text style={styles.inferredMode}>{inferredMode}</Text>
        </View>
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
    color: "#60A5FA",
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
    padding: 16,
  },
  group: {
    marginBottom: 18,
  },
  groupHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  groupDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  groupTitle: {
    color: "#D1D5DB",
    fontSize: 14,
    fontWeight: "800",
  },
  tileWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tile: {
    backgroundColor: "#1F2937",
    borderColor: "#273244",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  selectedTile: {
    backgroundColor: "#1D4ED8",
    borderColor: "#FACC15",
  },
  tileText: {
    color: "#D1D5DB",
    fontSize: 14,
    fontWeight: "800",
  },
  selectedTileText: {
    color: "#FFFFFF",
  },
  inferred: {
    alignItems: "center",
    backgroundColor: "#0B0D10",
    borderColor: "#1F2937",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
  },
  inferredLabel: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "700",
  },
  inferredMode: {
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "900",
    textTransform: "capitalize",
  },
});
