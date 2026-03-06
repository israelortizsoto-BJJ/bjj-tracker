import { Stack } from "expo-router";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

export default function CoachJoinScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Join Coach / Program" }} />
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6 }}>
          Join Coach / Program
        </Text>
        <Text style={{ fontSize: 14, opacity: 0.75, lineHeight: 20 }}>
          Enter a coach invite code to link guidance, packs, and assignments to
          your app. Parent-facing flow only. No child login required.
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
            INVITE CODE
          </Text>

          <TextInput
            value=""
            editable={false}
            placeholder="Enter code later"
            placeholderTextColor="#8a8a8a"
            style={{
              borderWidth: 1,
              borderRadius: 10,
              paddingVertical: 12,
              paddingHorizontal: 12,
              marginBottom: 12,
            }}
          />

          <Pressable
            onPress={() =>
              Alert.alert(
                "Join stub only",
                "Invite code entry, invite links, and QR join flow come next.",
              )
            }
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 16 }}>Continue</Text>
          </Pressable>
        </View>

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
            Later this screen can support invite codes, coach-issued links, and
            QR-based join without creating a child account.
          </Text>
        </View>
      </View>
    </>
  );
}
