import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { getCoachSyncApiBaseUrl, isCoachSyncConfigured } from "../../../../src/config/coachSync";
import {
  CoachWeeklySyncApiError,
  coachSyncFetchSession,
} from "../../../../src/services/coachWeeklySyncApi";
import {
  getCoachLinks,
  getCoachesById,
  getOrCreateLocalParentProfileId,
  setCoachLinks,
  setCoachesById,
} from "../../../../src/storage/coachShareStore";
import { setCachedWeeklyForLinkToken } from "../../../../src/storage/coachWeeklySyncCacheStore";
import type { CoachIdentity, CoachLink } from "../../../../src/types/coachShare";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  bgHero: "#fffbf5",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  primaryFill: "#1d4ed8",
  primaryFillPressed: "#1e40af",
  danger: "#b91c1c",
};
const CARD_RADIUS = 16;
const SECTION_LABEL = {
  fontSize: 11,
  letterSpacing: 1.2,
  color: "#6b7280",
  fontWeight: "600" as const,
};

function normalizeInviteToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

export default function CoachJoinScreen() {
  const [ready, setReady] = useState(false);
  const [isLinked, setIsLinked] = useState(false);
  const [tokenDraft, setTokenDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const syncConfigured = isCoachSyncConfigured();

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

  const onConnect = useCallback(async () => {
    setFormError(null);
    const token = normalizeInviteToken(tokenDraft);
    if (!token) {
      setFormError("Paste the invite code your coach shared.");
      return;
    }
    if (!syncConfigured) {
      setFormError("This app build is not configured for coach sync yet.");
      return;
    }

    setBusy(true);
    try {
      const session = await coachSyncFetchSession(token);
      const parentProfileId = await getOrCreateLocalParentProfileId();
      const nowIso = new Date().toISOString();

      const coach: CoachIdentity = {
        id: session.coach.id,
        displayName: session.coach.displayName,
        academyName: session.coach.academyName,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const existingCoaches = await getCoachesById();
      const priorCoach = existingCoaches[coach.id];
      if (priorCoach) {
        coach.createdAt = priorCoach.createdAt;
      }

      const newLink: CoachLink = {
        id: `link_sync_${Date.now()}`,
        coachId: coach.id,
        parentProfileId,
        scope: "household",
        status: "active",
        canReceiveCompletionReceipts: false,
        createdAt: nowIso,
        updatedAt: nowIso,
        weeklySync: {
          apiBaseUrl: getCoachSyncApiBaseUrl()!,
          linkToken: token,
        },
      };

      const existingLinks = await getCoachLinks();
      const withoutDup = existingLinks.filter(
        (l) =>
          !(
            l.weeklySync &&
            l.weeklySync.linkToken === token &&
            l.status === "active"
          ),
      );

      await setCoachesById({ ...existingCoaches, [coach.id]: coach });
      await setCoachLinks([...withoutDup, newLink]);
      await setCachedWeeklyForLinkToken(token, session.weekly, nowIso);

      router.replace("/profile/coaches");
    } catch (e) {
      const msg =
        e instanceof CoachWeeklySyncApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not connect.";
      setFormError(msg);
    } finally {
      setBusy(false);
    }
  }, [syncConfigured, tokenDraft]);

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
          Paste the invite code from your coach. This links this phone to their weekly family note
          — competition and practice stay on this device unless we add more sync later.
        </Text>

        {!ready ? (
          <Text style={{ marginTop: 4, fontSize: 15, color: UI.textSecondary }}>
            Loading…
          </Text>
        ) : (
          <>
            {!syncConfigured ? (
              <View
                style={{
                  padding: 16,
                  borderRadius: CARD_RADIUS,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: "#fef3c7",
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 14, color: "#92400e", lineHeight: 21, fontWeight: "700" }}>
                  Coach sync URL missing
                </Text>
                <Text style={{ marginTop: 8, fontSize: 14, color: UI.textSecondary, lineHeight: 21 }}>
                  Set EXPO_PUBLIC_COACH_SYNC_BASE_URL to your deployed worker URL, rebuild the app, then
                  return here. Without it, linking cannot reach the shared weekly message.
                </Text>
              </View>
            ) : null}

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
                  backgroundColor: isLinked ? "#dcfce7" : "#dbeafe",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: isLinked ? "#166534" : "#1e40af",
                  }}
                >
                  {isLinked ? "This phone has an active link" : "Invite code"}
                </Text>
              </View>

              <Text style={[SECTION_LABEL, { marginBottom: 8, color: "#78716c" }]}>
                {isLinked ? "ADD ANOTHER OR GO BACK" : "PASTE INVITE"}
              </Text>

              {isLinked ? (
                <Text style={{ fontSize: 15, color: UI.textSecondary, lineHeight: 23 }}>
                  You can add another academy link below, or return to This week together.
                </Text>
              ) : (
                <Text style={{ fontSize: 15, color: UI.textSecondary, lineHeight: 23, marginBottom: 12 }}>
                  Only the weekly title and family-facing text your coach publishes are shared — not their
                  private check-in notes.
                </Text>
              )}

              <TextInput
                value={tokenDraft}
                onChangeText={(t) => {
                  setFormError(null);
                  setTokenDraft(t);
                }}
                placeholder="Invite code from your coach"
                placeholderTextColor={UI.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy && syncConfigured}
                style={{
                  marginTop: 8,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: UI.bgCard,
                  color: UI.textPrimary,
                  fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
                }}
              />

              {formError ? (
                <Text style={{ marginTop: 10, fontSize: 14, color: UI.danger, lineHeight: 20 }}>
                  {formError}
                </Text>
              ) : null}

              <Pressable
                disabled={busy || !syncConfigured}
                onPress={() => void onConnect()}
                style={({ pressed }) => ({
                  marginTop: 16,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  borderRadius: CARD_RADIUS,
                  backgroundColor: pressed ? UI.primaryFillPressed : UI.primaryFill,
                  alignSelf: "stretch",
                  alignItems: "center",
                  opacity: busy || !syncConfigured ? 0.55 : 1,
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 10,
                })}
              >
                {busy ? <ActivityIndicator color="#ffffff" /> : null}
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                  {busy ? "Connecting…" : "Connect this phone"}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => router.push("/profile/coaches")}
              style={({ pressed }) => ({
                marginTop: 18,
                paddingVertical: 14,
                paddingHorizontal: 20,
                borderRadius: CARD_RADIUS,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: pressed ? "#e5e7eb" : UI.bgCard,
                alignSelf: "stretch",
                alignItems: "center",
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: UI.textPrimary }}>
                Back to this week together
              </Text>
            </Pressable>
          </>
        )}
      </KeyboardAwareScrollView>
    </>
  );
}
