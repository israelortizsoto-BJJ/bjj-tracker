import { Stack, router } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
};

export default function CoachManageScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Manage Coach Link" }} />
      <View style={{ flex: 1, padding: 16, backgroundColor: UI.screenBg }}>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6, color: UI.textPrimary }}>
          Manage Coach Link
        </Text>
        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
          Parent-controlled link management for Coach Share. Later this screen
          can review active coach access and allow revoke actions.
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
            LINK STATUS
          </Text>
          <Text style={{ fontSize: 15, marginBottom: 6, color: UI.textPrimary }}>
            Parent controls this connection.
          </Text>
          <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
            Future revoke behavior should stop new assignments and stop sharing
            completion receipts with the coach.
          </Text>
        </View>

        <Pressable
          onPress={() =>
            Alert.alert(
              "Manage stub only",
              "Revoke and link-management actions come next.",
            )
          }
          style={{
            marginTop: 16,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 16, color: UI.textPrimary }}>Revoke Coach Link</Text>
        </Pressable>
      </View>
    </>
  );
}
