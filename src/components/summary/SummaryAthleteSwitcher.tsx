import { Pressable, StyleSheet, Text, View } from "react-native";

type Athlete = {
  id: string;
  name: string;
};

type SummaryAthleteSwitcherProps = {
  athletes: Athlete[];
  activeAthleteId: string;
  onChange?: (athleteId: string) => void;
};

export default function SummaryAthleteSwitcher({
  athletes,
  activeAthleteId,
  onChange,
}: SummaryAthleteSwitcherProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Athlete</Text>
      <View style={styles.chipRow}>
        {athletes.length === 0 ? (
          <Text style={styles.emptyText}>No athlete yet</Text>
        ) : (
          athletes.map((athlete) => {
            const isActive = athlete.id === activeAthleteId;

            return (
              <Pressable
                key={athlete.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                onPress={() => onChange?.(athlete.id)}
                style={({ pressed }) => [
                  styles.chip,
                  isActive ? styles.activeChip : styles.inactiveChip,
                  pressed ? styles.pressedChip : null,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    isActive ? styles.activeChipText : styles.inactiveChipText,
                  ]}
                >
                  {athlete.name}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
  },
  label: {
    color: "#a9b0b8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  chip: {
    minHeight: 34,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  activeChip: {
    backgroundColor: "#d6ff3f",
    borderColor: "#d6ff3f",
  },
  inactiveChip: {
    backgroundColor: "#181b1f",
    borderColor: "rgba(236, 241, 245, 0.12)",
  },
  pressedChip: {
    opacity: 0.82,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "800",
  },
  activeChipText: {
    color: "#111315",
  },
  inactiveChipText: {
    color: "#a9b0b8",
  },
  emptyText: {
    color: "#a9b0b8",
    fontSize: 14,
  },
});
