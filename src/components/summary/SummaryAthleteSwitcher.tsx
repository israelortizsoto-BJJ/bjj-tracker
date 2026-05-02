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

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

export default function SummaryAthleteSwitcher({
  athletes,
  activeAthleteId,
  onChange,
}: SummaryAthleteSwitcherProps) {
  const activeAthlete =
    athletes.find((athlete) => athlete.id === activeAthleteId) ?? athletes[0];
  const athleteName = activeAthlete?.name ?? "Athlete";
  const content = (
    <>
      <View style={styles.left}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(athleteName)}</Text>
        </View>
        <Text style={styles.name}>{athleteName}</Text>
      </View>
      <Text style={styles.indicator}>›</Text>
    </>
  );

  if (athletes.length <= 1) {
    return <View style={styles.container}>{content}</View>;
  }

  return (
    <Pressable
      style={styles.container}
      onPress={() => {
        const currentIndex = athletes.findIndex(
          (athlete) => athlete.id === activeAthleteId,
        );
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % athletes.length : 0;
        const nextAthlete = athletes[nextIndex];
        if (nextAthlete) onChange?.(nextAthlete.id);
      }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0b0f12",
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#1f2937",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#20252b",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  name: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  indicator: {
    color: "#9ca3af",
    fontSize: 20,
    fontWeight: "700",
  },
});
