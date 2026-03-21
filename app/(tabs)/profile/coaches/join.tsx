import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { getCoachLinks } from "../../../../src/storage/coachShareStore";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  bgHero: "#fffbf5",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  primaryFill: "#1d4ed8",
  primaryFillPressed: "#1e40af",
};
const CARD_RADIUS = 16;
const SECTION_LABEL = {
  fontSize: 11,
  letterSpacing: 1.2,
  color: "#6b7280",
  fontWeight: "600" as const,
};

export default function CoachJoinScreen() {
  const [ready, setReady] = useState(false);
  const [isLinked, setIsLinked] = useState(false);

  const refreshLinks = useCallback(async () => {
    setReady(false);
    const links = await getCoachLinks();
    const active = links.filter((link) => link.status === "active");
    setIsLinked(active.length > 0);
    setReady(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshLinks();
    }, [refreshLinks]),
  );

  return (
    <>
      <Stack.Screen options={{ title: "This week" }} />
      <KeyboardAwareScrollView
        enableOnAndroid
        extraScrollHeight={80}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: UI.screenBg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <Text
          style={{
            fontSize: 26,
            fontWeight: "700",
            color: UI.textPrimary,
            marginBottom: 6,
          }}
        >
          Connect with your coach
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: UI.textSecondary,
            lineHeight: 22,
            marginBottom: 18,
          }}
        >
          When it&apos;s ready, you&apos;ll link this phone to your academy so
          class and practice stay in sync—no child login needed.
        </Text>

        {!ready ? (
          <Text style={{ marginTop: 4, fontSize: 15, color: UI.textSecondary }}>
            Loading…
          </Text>
        ) : (
          <>
            <View
              style={{
                padding: 20,
                borderRadius: CARD_RADIUS,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgHero,
              }}
            >
              <View
                style={{
                  alignSelf: "flex-start",
                  marginBottom: 14,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: isLinked ? "#dcfce7" : "#fef3c7",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: isLinked ? "#166534" : "#92400e",
                  }}
                >
                  {isLinked
                    ? "Already linked on this phone"
                    : "Not available in this app version yet"}
                </Text>
              </View>

              <Text style={[SECTION_LABEL, { marginBottom: 8, color: "#78716c" }]}>
                {isLinked ? "YOU'RE SET" : "WHAT TO EXPECT"}
              </Text>

              {isLinked ? (
                <>
                  <Text
                    style={{
                      fontSize: 16,
                      color: UI.textPrimary,
                      lineHeight: 24,
                      fontWeight: "600",
                    }}
                  >
                    This phone already has an active coach link.
                  </Text>
                  <Text
                    style={{
                      marginTop: 10,
                      fontSize: 15,
                      color: UI.textSecondary,
                      lineHeight: 23,
                    }}
                  >
                    Your family&apos;s weekly focus and practice note live on the
                    previous screen—tap below when you&apos;re ready to head back.
                  </Text>
                </>
              ) : (
                <>
                  <Text
                    style={{
                      fontSize: 16,
                      color: UI.textPrimary,
                      lineHeight: 24,
                      fontWeight: "600",
                    }}
                  >
                    We&apos;re not turning on invites or codes in this build.
                  </Text>
                  <Text
                    style={{
                      marginTop: 10,
                      fontSize: 15,
                      color: UI.textSecondary,
                      lineHeight: 23,
                    }}
                  >
                    Soon you&apos;ll be able to paste an invite from your coach or
                    open a link they send you. Until then, anything you see in
                    &quot;This week together&quot; stays on this device only.
                  </Text>
                </>
              )}

              <Pressable
                onPress={() => router.push("/profile/coaches")}
                style={({ pressed }) => ({
                  marginTop: 20,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  borderRadius: CARD_RADIUS,
                  backgroundColor: pressed ? UI.primaryFillPressed : UI.primaryFill,
                  alignSelf: "stretch",
                  alignItems: "center",
                })}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                  Back to this week together
                </Text>
              </Pressable>
            </View>

            <View
              style={{
                marginTop: 18,
                padding: 18,
                borderRadius: CARD_RADIUS,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgCard,
              }}
            >
              <Text style={[SECTION_LABEL, { marginBottom: 10 }]}>
                LATER ON
              </Text>
              <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
                When connecting goes live, you&apos;ll finish linking here in a few
                taps—still parent-led, still without handing a login to your child.
              </Text>
            </View>
          </>
        )}
      </KeyboardAwareScrollView>
    </>
  );
}
