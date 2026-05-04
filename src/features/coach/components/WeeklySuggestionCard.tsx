import { Pressable, StyleSheet, Text, View } from "react-native";

type WeeklySuggestionCardProps = {
  suggestionText: string;
  visible: boolean;
  onUse: () => void;
  onEdit: () => void;
};

export default function WeeklySuggestionCard({
  suggestionText,
  visible,
  onUse,
  onEdit,
}: WeeklySuggestionCardProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Suggested from training</Text>
      <Text style={styles.body}>{suggestionText}</Text>
      <Text style={styles.subtext}>Based on recent training and sparring</Text>
      <View style={styles.actions}>
        <Pressable onPress={onUse} style={styles.button}>
          <Text style={styles.buttonText}>Use this</Text>
        </Pressable>
        <Pressable onPress={onEdit} style={styles.button}>
          <Text style={styles.buttonText}>Edit</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderColor: "#6ee7b7",
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  title: {
    color: "#065f46",
    fontSize: 12,
    fontWeight: "800",
  },
  body: {
    color: "#111827",
    fontSize: 13,
    lineHeight: 18,
  },
  subtext: {
    color: "#4b5563",
    fontSize: 11,
    lineHeight: 15,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  button: {
    borderColor: "#6ee7b7",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  buttonText: {
    color: "#065f46",
    fontSize: 12,
    fontWeight: "800",
  },
});
