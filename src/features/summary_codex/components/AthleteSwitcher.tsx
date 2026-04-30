import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Athlete = {
  id: string;
  name: string;
  belt: string;
};

type AthleteSwitcherProps = {
  athletes: Athlete[];
  activeAthleteId: string;
  onSelectAthlete?: (athleteId: string) => void;
};

export default function AthleteSwitcher({ athletes, activeAthleteId, onSelectAthlete }: AthleteSwitcherProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {athletes.map((athlete) => {
        const active = athlete.id === activeAthleteId;

        return (
          <Pressable
            key={athlete.id}
            onPress={() => onSelectAthlete?.(athlete.id)}
            style={[styles.chip, active && styles.activeChip]}
          >
            <View style={[styles.avatar, active && styles.activeAvatar]} />

            <View style={styles.copy}>
              <Text style={[styles.name, active && styles.activeName]}>{athlete.name}</Text>
              <Text style={[styles.belt, active && styles.activeBelt]}>{athlete.belt}</Text>
            </View>

            {active ? (
              <View style={styles.check}>
                <Text style={styles.checkText}>✓</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingBottom: 2,
  },
  chip: {
    alignItems: "center",
    backgroundColor: "#12161C",
    borderColor: "#243244",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 46,
    minWidth: 98,
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: "relative",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  activeChip: {
    backgroundColor: "#0E1724",
    borderColor: "#2F8CFF",
    shadowColor: "#2563EB",
    shadowOpacity: 0.26,
    shadowRadius: 14,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#1F2937",
    borderColor: "#374151",
    borderRadius: 15,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    marginRight: 9,
    width: 30,
  },
  activeAvatar: {
    backgroundColor: "#142B4A",
    borderColor: "#60A5FA",
  },
  copy: {
    flexShrink: 1,
    paddingRight: 7,
  },
  name: {
    color: "#B7C1CE",
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 14,
  },
  activeName: {
    color: "#F9FAFB",
  },
  belt: {
    color: "#7B8493",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
    marginTop: 1,
  },
  activeBelt: {
    color: "#60A5FA",
  },
  check: {
    alignItems: "center",
    backgroundColor: "#2563EB",
    borderRadius: 7,
    height: 14,
    justifyContent: "center",
    position: "absolute",
    right: 6,
    top: 6,
    width: 14,
  },
  checkText: {
    color: "#F9FAFB",
    fontSize: 9,
    fontWeight: "900",
    lineHeight: 12,
  },
});
