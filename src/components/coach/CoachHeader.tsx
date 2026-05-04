import { StyleSheet, Text, View } from "react-native";

export default function CoachHeader() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Coach</Text>
      <Text style={styles.subtitle}>Select an athlete to manage their weekly plan.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    color: "#9ca3af",
    fontSize: 15,
    lineHeight: 21,
  },
});
