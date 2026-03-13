import { Stack, router } from "expo-router";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
};

export default function CoachJoinScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Join Coach / Program" }} />
      <View style={{ flex: 1, padding: 16, backgroundColor: UI.screenBg }}>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6, color: UI.textPrimary }}>
          Join Coach / Program
        </Text>
        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
          Enter a coach invite code to link guidance, packs, and assignments to
          your app. Parent-facing flow only. No child login required.
        </Text>

        <Pressable
          onPress={() => router.push("/profile/coaches")}
          style={{
            marginTop: 16,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ fontSize: 14, color: UI.textPrimary }}>Back to Coach Share</Text>
        </Pressable>

        <View
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              letterSpacing: 0.6,
              color: UI.textSecondary,
              marginBottom: 8,
            }}
          >
            INVITE CODE
          </Text>

          <TextInput
            value=""
            editable={false}
            placeholder="Enter code later"
            placeholderTextColor={UI.textSecondary}
            style={{
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
              color: UI.textPrimary,
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
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 16, color: UI.textPrimary }}>Continue</Text>
          </Pressable>
        </View>

        <View
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              letterSpacing: 0.6,
              color: UI.textSecondary,
              marginBottom: 8,
            }}
          >
            STUB STATUS
          </Text>
          <Text style={{ fontSize: 15, marginBottom: 6, color: UI.textPrimary }}>
            No live join flow yet.
          </Text>
          <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
            Later this screen can support invite codes, coach-issued links, and
            QR-based join without creating a child account.
          </Text>
        </View>
      </View>
    </>
  );
}
