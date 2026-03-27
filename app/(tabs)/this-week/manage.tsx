import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  devSnapshotCoachLinkRow,
  parentStrictWeeklyLinkedCoachLinksForUi,
} from "../../../src/coachShare/coachLinkBinding";
import { inviteLinkTokenTail } from "../../../src/coachShare/inviteLinkToken";
import { isCoachSyncConfigured } from "../../../src/config/coachSync";
import { useDeviceRole } from "../../../src/deviceRole/DeviceRoleProvider";
import { coachSyncFetchSession } from "../../../src/services/coachWeeklySyncApi";
import {
  getCoachLinks,
  setCoachLinks,
} from "../../../src/storage/coachShareStore";
import {
  clearLocalCoachSharingBindingsForInviteToken,
  getKidsById,
  unlinkParentAthleteFromCoachSession,
} from "../../../src/storage/coachKidStore";
import { clearCachedWeeklyForLinkToken } from "../../../src/storage/coachWeeklySyncCacheStore";
import type { CoachLink } from "../../../src/types/coachShare";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  danger: "#b91c1c",
  okBg: "#ecfdf5",
  okBorder: "#6ee7b7",
  okText: "#065f46",
  warnBg: "#fffbeb",
  warnBorder: "#fcd34d",
  warnText: "#92400e",
};

export default function CoachManageScreen() {
  const insets = useSafeAreaInsets();
  const { role } = useDeviceRole();
  const [links, setLinksState] = useState<CoachLink[]>([]);

  const load = useCallback(async () => {
    const l = await getCoachLinks();
    const active = l.filter((x) => x.status === "active");
    setLinksState(role === "parent" ? parentStrictWeeklyLinkedCoachLinksForUi(l) : active);
  }, [role]);

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
              if (__DEV__) {
                const beforeLinks = await getCoachLinks();
                const t = link.weeklySync?.linkToken?.trim() ?? "";
                console.log("[mm:autoRelink]", {
                  step: "parent_remove_link",
                  phase: "before",
                  rows: beforeLinks.map(devSnapshotCoachLinkRow),
                  targetLinkId: link.id,
                  targetTokenTail: t ? inviteLinkTokenTail(t) : null,
                });
              }

              const ws = link.weeklySync;
              const secret = ws?.parentWriterSecret?.trim();
              let sessionAthleteIds: Set<string> | null = null;
              let serverCleanupOk = true;

              if (ws && secret && isCoachSyncConfigured()) {
                try {
                  const session = await coachSyncFetchSession(ws.linkToken.trim(), ws.apiBaseUrl);
                  sessionAthleteIds = new Set(
                    session.athletes
                      .map((a) => (typeof a.id === "string" ? a.id.trim() : ""))
                      .filter(Boolean),
                  );
                  if (sessionAthleteIds.size > 0) {
                    const kids = await getKidsById();
                    for (const kid of Object.values(kids)) {
                      const sid = kid.sharedAthleteId?.trim();
                      if (!sid || !sessionAthleteIds.has(sid)) continue;
                      try {
                        await unlinkParentAthleteFromCoachSession({
                          kidId: kid.id,
                          linkToken: ws.linkToken.trim(),
                          parentWriterSecret: secret,
                          apiBaseUrl: ws.apiBaseUrl,
                        });
                      } catch {
                        serverCleanupOk = false;
                      }
                    }
                  }
                } catch {
                  serverCleanupOk = false;
                }
              }

              if (ws?.linkToken) {
                await clearLocalCoachSharingBindingsForInviteToken(ws.linkToken, {
                  sessionAthleteIds,
                });
              }

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
              if (__DEV__) {
                const afterLinks = await getCoachLinks();
                const affected = link.weeklySync?.linkToken?.trim() ?? "";
                const rowAfter = afterLinks.find((x) => x.id === link.id);
                console.log("[mm:autoRelink]", {
                  step: "parent_remove_link",
                  phase: "after",
                  rows: afterLinks.map(devSnapshotCoachLinkRow),
                  targetLinkId: link.id,
                  rowOutcome: rowAfter?.status === "revoked" ? "revoked" : "not_revoked_unexpected",
                  clearedLocalBindingsForTokenTail: affected ? inviteLinkTokenTail(affected) : null,
                });
              }
              if (link.weeklySync?.linkToken) {
                await clearCachedWeeklyForLinkToken(link.weeklySync.linkToken);
              }
              await load();

              if (!isCoachSyncConfigured()) {
                Alert.alert(
                  "Link removed on this phone",
                  "Coach sync is not configured in this build, so this device only cleared local binding. Reconnect with your coach when sync is available.",
                );
              } else if (!serverCleanupOk && ws?.linkToken) {
                const preview =
                  ws.linkToken.length > 8 ? ws.linkToken.slice(-8) : ws.linkToken;
                Alert.alert(
                  "Link removed on this phone",
                  `Local athlete binding for this invite was cleared (code ends …${preview}). If an athlete still appears on your coach’s roster, open This week together → Coach link & sharing → Athletes on this invite to retry, or ask your coach to remove them from the invite.`,
                );
              }
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
      <View style={{ flex: 1, backgroundColor: UI.screenBg }}>
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 16,
            paddingBottom: Math.max(24, insets.bottom + 28),
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6, color: UI.textPrimary }}>
            Coach link on this phone
          </Text>
          <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20, marginBottom: 16 }}>
            Each active invite is one weekly channel for This week together. Removing a row only affects this
            device — nothing is deleted on your coach’s phone. Use one invite per family unless your coach gave
            you more than one code on purpose.
          </Text>

          <Pressable
            onPress={() => router.push("/this-week")}
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
              <Text style={{ fontSize: 15, fontWeight: "700", color: UI.textPrimary, marginBottom: 8 }}>
                No active weekly invite on this phone
              </Text>
              <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 21 }}>
                If you removed every link here, this device is unsubscribed until you connect again. Open This
                week together, use Connect with your coach, and paste the invite code from your coach. To add
                another child on the same invite after reconnecting, open Athletes on this invite from this
                screen once a link appears.
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
                    {syncLinks.length} weekly channels on this phone
                  </Text>
                  <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 18, marginTop: 6 }}>
                    Usually you only need one. Extra rows mean this device subscribed more than once — remove
                    any you do not use so it is obvious which channel is active. Competition sync follows the
                    invite that actually contains each athlete on the server.
                  </Text>
                </View>
              ) : null}
              {syncLinks.map((link, idx) => {
                const ws = link.weeklySync!;
                const isCoachWriterDevice = Boolean(ws.writerSecret?.trim());
                const parentWriterOk = Boolean(ws.parentWriterSecret?.trim());
                return (
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

                    {isCoachWriterDevice ? (
                      <View
                        style={{
                          padding: 10,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: UI.border,
                          backgroundColor: "#f9fafb",
                        }}
                      >
                        <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 19 }}>
                          This row is the coach invite on a coach device (publish key present). Parents add
                          athletes from their own phone after they connect with this code.
                        </Text>
                      </View>
                    ) : parentWriterOk ? (
                      <View
                        style={{
                          padding: 10,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: UI.okBorder,
                          backgroundColor: UI.okBg,
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: "700", color: UI.okText }}>
                          Linked — competition sync ready
                        </Text>
                        <Text style={{ fontSize: 12, color: UI.okText, lineHeight: 17, marginTop: 4, opacity: 0.95 }}>
                          This phone can write shared competitions when the athlete appears on this invite. If
                          save still fails, open Athletes on this invite and relink the child profile.
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={{
                          padding: 10,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: UI.warnBorder,
                          backgroundColor: UI.warnBg,
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: "700", color: UI.warnText }}>
                          Needs setup — finish this invite
                        </Text>
                        <Text
                          style={{ fontSize: 12, color: UI.warnText, lineHeight: 17, marginTop: 4, opacity: 0.95 }}
                        >
                          Tap “Athletes on this invite” below so this phone can redeem writer access and show
                          who is on the channel.
                        </Text>
                      </View>
                    )}

                    <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 19 }}>
                      Invite code (ends with{" "}
                      <Text style={{ fontWeight: "800", color: UI.textPrimary }}>
                        …{ws.linkToken.length > 8 ? ws.linkToken.slice(-8) : ws.linkToken}
                      </Text>
                      ):
                    </Text>
                    <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 18 }} selectable>
                      {ws.linkToken}
                    </Text>

                    {!isCoachWriterDevice ? (
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/this-week/parent-athletes",
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
                          Athletes on this invite
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: UI.textSecondary,
                            marginTop: 4,
                            textAlign: "center",
                            lineHeight: 16,
                          }}
                        >
                          Add another athlete, relink after unlink, or finish setup if you see “Needs setup”.
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
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}
