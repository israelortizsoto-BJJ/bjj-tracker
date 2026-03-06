import { Stack } from "expo-router";
import { Text, View } from "react-native";

export default function CoachJoinScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Join Coach / Program" }} />
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6 }}>
          Join Coach / Program
        </Text>
        <Text style={{ fontSize: 14, opacity: 0.75, lineHeight: 20 }}>
          Parent-facing intake stub for Coach Share. Later this screen can
          accept an invite code, invite link, or QR-based join flow.
        </Text>

        <View
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              letterSpacing: 0.6,
              opacity: 0.7,
              marginBottom: 8,
            }}
          >
            STUB STATUS
          </Text>
          <Text style={{ fontSize: 15, marginBottom: 6 }}>
            No live join flow yet.
          </Text>
          <Text style={{ fontSize: 14, opacity: 0.75, lineHeight: 20 }}>
            Next step: accept an invite code or coach-issued link without
            creating a child login.
          </Text>
        </View>
      </View>
    </>
  );
}
