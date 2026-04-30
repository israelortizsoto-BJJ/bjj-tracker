import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export type AthleteOption = {
  key: string;
  name: string;
  belt: string;
  avatar: string;
};

type Props = {
  athletes: AthleteOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
};

export default function AthleteSwitcher({ athletes, selectedKey, onSelect }: Props) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        decelerationRate="fast"
      >
        {athletes.map((a) => {
          const selected = a.key === selectedKey;
          return (
            <Pressable key={a.key} onPress={() => onSelect(a.key)} style={styles.item}>
              <View style={[styles.avatarWrap, selected && styles.avatarWrapSelected]}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{a.avatar}</Text>
                </View>
                {selected ? <View style={styles.check} /> : null}
              </View>
              <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={1}>
                {a.name}
              </Text>
              <Text style={[styles.belt, selected && styles.beltSelected]} numberOfLines={1}>
                {a.belt}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingRight: 4,
  },
  item: {
    width: 88,
    alignItems: "center",
  },
  avatarWrap: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.3)",
    marginBottom: 10,
  },
  avatarWrapSelected: {
    borderColor: "#3B82F6",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B1221",
  },
  avatarText: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  check: {
    position: "absolute",
    right: 2,
    bottom: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#3B82F6",
    borderWidth: 2,
    borderColor: "#0A1020",
  },
  name: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
    textAlign: "center",
    marginBottom: 2,
  },
  nameSelected: {
    color: "#FFFFFF",
  },
  belt: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  beltSelected: {
    color: "#CBE2FF",
  },
});
