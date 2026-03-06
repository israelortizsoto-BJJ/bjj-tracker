import { Stack, router } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";

export default function CoachManageScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Manage Coach Link" }} />
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6 }}>
          Manage Coach Link
        </Text>
        <Text style={{ fontSize: 14, opacity: 0.75, lineHeight: 20 }}>
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
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ fontSize: 14 }}>Back to Coach Share</Text>
        </Pressable>

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
            LINK STATUS
          </Text>
          <Text style={{ fontSize: 15, marginBottom: 6 }}>
            Parent controls this connection.
          </Text>
          <Text style={{ fontSize: 14, opacity: 0.75, lineHeight: 20 }}>
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
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 16 }}>Revoke Coach Link</Text>
        </Pressable>
      </View>
    </>
  );
}
