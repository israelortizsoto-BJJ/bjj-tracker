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
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  chip: {
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  activeChip: {
    backgroundColor: "#c7f36b",
    borderColor: "#c7f36b",
  },
  inactiveChip: {
    backgroundColor: "#111827",
    borderColor: "#1f2937",
  },
  pressedChip: {
    opacity: 0.82,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "800",
  },
  activeChipText: {
    color: "#111827",
  },
  inactiveChipText: {
    color: "#ffffff",
  },
  emptyText: {
    color: "#9ca3af",
    fontSize: 14,
  },
});
