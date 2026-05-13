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

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function SummaryAthleteSwitcher({
  athletes,
  activeAthleteId,
  onChange,
}: SummaryAthleteSwitcherProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Active athlete</Text>
      <View style={styles.chipRow}>
        {athletes.length === 0 ? (
          <Text style={styles.emptyText}>No athlete yet</Text>
        ) : (
          athletes.map((athlete) => {
            const isActive = athlete.id === activeAthleteId;
            const initials = initialsFromName(athlete.name);

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
                <View style={[styles.initialsMark, isActive ? styles.initialsMarkActive : null]}>
                  <Text
                    style={[styles.initialsText, isActive ? styles.initialsTextActive : null]}
                    numberOfLines={1}
                  >
                    {initials}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.chipText,
                    isActive ? styles.activeChipText : styles.inactiveChipText,
                  ]}
                  numberOfLines={1}
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
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
  },
  initialsMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(236, 241, 245, 0.12)",
    backgroundColor: "#20242a",
  },
  initialsMarkActive: {
    borderColor: "rgba(214, 255, 63, 0.7)",
    backgroundColor: "#20242a",
  },
  initialsText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#a9b0b8",
  },
  initialsTextActive: {
    color: "#d6ff3f",
  },
  activeChip: {
    backgroundColor: "#181b1f",
    borderColor: "rgba(214, 255, 63, 0.75)",
    borderWidth: 1,
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
    flexShrink: 1,
  },
  activeChipText: {
    color: "#f2f4f6",
  },
  inactiveChipText: {
    color: "#a9b0b8",
  },
  emptyText: {
    color: "#a9b0b8",
    fontSize: 14,
  },
});
