import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import {
  getCoachLinks,
  setCoachLinks,
} from "../../../../src/storage/coachShareStore";
import { clearCachedWeeklyForLinkToken } from "../../../../src/storage/coachWeeklySyncCacheStore";
import type { CoachLink } from "../../../../src/types/coachShare";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  danger: "#b91c1c",
};

export default function CoachManageScreen() {
  const [links, setLinksState] = useState<CoachLink[]>([]);

  const load = useCallback(async () => {
    const l = await getCoachLinks();
    setLinksState(l.filter((x) => x.status === "active"));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const syncLinks = links.filter((l) => l.weeklySync);

  const revokeLink = useCallback(
    (link: CoachLink) => {
      Alert.alert(
        "Remove this coach link?",
        "This phone will stop loading the shared weekly note for this invite. It does not delete data on your coach’s device.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              const all = await getCoachLinks();
              const next = all.map((l) =>
                l.id === link.id
                  ? {
                      ...l,
                      status: "revoked" as const,
                      updatedAt: new Date().toISOString(),
                      revokedAt: new Date().toISOString(),
                    }
                  : l,
              );
              await setCoachLinks(next);
              if (link.weeklySync?.linkToken) {
                await clearCachedWeeklyForLinkToken(link.weeklySync.linkToken);
              }
              await load();
            },
          },
        ],
      );
    },
    [load],
  );

  return (
    <>
      <Stack.Screen options={{ title: "Coach link & sharing" }} />
      <View style={{ flex: 1, padding: 16, backgroundColor: UI.screenBg }}>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6, color: UI.textPrimary }}>
          Coach link on this phone
        </Text>
        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20, marginBottom: 16 }}>
          Each active invite controls the family weekly note on This week together. Removing it here stops sync on
          this device only — nothing is deleted on your coach’s phone. One parent phone usually needs one invite;
          channels are family-level, not per-kid.
        </Text>

        <Pressable
          onPress={() => router.push("/profile/coaches")}
          style={{
            marginBottom: 16,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ fontSize: 14, color: UI.textPrimary }}>Back to This week together</Text>
        </Pressable>

        {syncLinks.length === 0 ? (
          <View
            style={{
              padding: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
            }}
          >
            <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 21 }}>
              No weekly note links saved here yet. Use Connect with your coach on This week together and
              paste the invite code your coach shared.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {syncLinks.length > 1 ? (
              <View
                style={{
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#c4b5fd",
                  backgroundColor: "#f5f3ff",
                }}
              >
                <Text style={{ fontSize: 13, color: UI.textPrimary, lineHeight: 19, fontWeight: "600" }}>
                  You have {syncLinks.length} weekly channels on this phone
                </Text>
                <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 18, marginTop: 6 }}>
                  Usually you only need one. Extra rows mean this device subscribed more than once — remove
                  any you do not use so it is obvious which channel is active.
                </Text>
              </View>
            ) : null}
            {syncLinks.map((link, idx) => (
              <View
                key={link.id}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: UI.bgCard,
                  gap: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    letterSpacing: 0.6,
                    color: UI.textSecondary,
                    fontWeight: "700",
                  }}
                >
                  WEEKLY FAMILY NOTE · CHANNEL {idx + 1} OF {syncLinks.length}
                </Text>
                <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 19 }}>
                  Same coach-level weekly sync for the whole family view — not a per-kid link. Code ends with{" "}
                  <Text style={{ fontWeight: "800", color: UI.textPrimary }}>
                    …{link.weeklySync!.linkToken.slice(-8)}
                  </Text>
                  .
                </Text>
                <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 18 }} selectable>
                  {link.weeklySync!.linkToken}
                </Text>
                {!link.weeklySync!.writerSecret ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/profile/coaches/parent-athletes",
                        params: { linkId: link.id },
                      })
                    }
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: "#93c5fd",
                      backgroundColor: "#eff6ff",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#1d4ed8" }}>
                      Add athletes for this invite
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => revokeLink(link)}
                  style={{
                    marginTop: 4,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: UI.danger,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: UI.danger }}>
                    Remove link from this phone
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
    </>
  );
}
