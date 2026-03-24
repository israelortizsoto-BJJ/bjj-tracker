import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getCoachSyncApiBaseUrl, isCoachSyncConfigured } from "../../../../src/config/coachSync";
import {
  CoachWeeklySyncApiError,
  coachSyncCreateSession,
  coachSyncFetchSession,
} from "../../../../src/services/coachWeeklySyncApi";
import {
  getCoachLinks,
  getCoachesById,
  getOrCreateLocalParentProfileId,
  setCoachLinks,
  setCoachesById,
} from "../../../../src/storage/coachShareStore";
import {
  deleteKidPilot,
  getKidsById,
  mergeRemoteSharedAthletesIntoKids,
  normalizeKidHouseholdLabel,
  setKidsById,
} from "../../../../src/storage/coachKidStore";
import type { CoachIdentity, CoachLink } from "../../../../src/types/coachShare";
import type { Kid, KidsById } from "../../../../src/types/coachKid";
import type { SyncedSharedAthlete } from "../../../../src/types/coachWeeklySync";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  deleteBg: "#dc2626",
  deleteText: "#ffffff",
};

const CARD_RADIUS = 16;

/** Internal map key for kids with no household label (displayed as "No household"). */
const UNGROUPED_HOUSEHOLD_KEY = "__ungrouped__";

function householdSectionKey(kid: Kid): string {
  const t = normalizeKidHouseholdLabel(kid.householdLabel ?? "");
  return t ? t : UNGROUPED_HOUSEHOLD_KEY;
}

function householdSectionTitle(sectionKey: string): string {
  return sectionKey === UNGROUPED_HOUSEHOLD_KEY ? "No household" : sectionKey;
}

function buildHouseholdSections(kids: Kid[]): { sectionKey: string; title: string; kids: Kid[] }[] {
  const map = new Map<string, Kid[]>();
  for (const kid of kids) {
    const key = householdSectionKey(kid);
    const arr = map.get(key) ?? [];
    arr.push(kid);
    map.set(key, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const keys = Array.from(map.keys()).sort((a, b) => {
    if (a === UNGROUPED_HOUSEHOLD_KEY && b !== UNGROUPED_HOUSEHOLD_KEY) return 1;
    if (b === UNGROUPED_HOUSEHOLD_KEY && a !== UNGROUPED_HOUSEHOLD_KEY) return -1;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
  return keys.map((sectionKey) => ({
    sectionKey,
    title: householdSectionTitle(sectionKey),
    kids: map.get(sectionKey) ?? [],
  }));
}

export default function KidsRosterScreen() {
  const [ready, setReady] = useState(false);
  const [kidsById, setKidsByIdState] = useState<KidsById>({});
  const [kidName, setKidName] = useState("");
  const [householdLabelDraft, setHouseholdLabelDraft] = useState("");
  const [savingKid, setSavingKid] = useState(false);
  const [writerLinks, setWriterLinks] = useState<CoachLink[]>([]);
  const [coachNameDraft, setCoachNameDraft] = useState("");
  const [academyDraft, setAcademyDraft] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [moreInvitesExpanded, setMoreInvitesExpanded] = useState(false);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const syncConfigured = isCoachSyncConfigured();

  const loadKids = useCallback(async () => {
    setReady(false);
    try {
      const links = await getCoachLinks();
      const writers = links.filter((l) => l.status === "active" && l.weeklySync?.writerSecret);
      setWriterLinks(writers);

      const merged: SyncedSharedAthlete[] = [];
      if (syncConfigured) {
        for (const l of writers) {
          const ws = l.weeklySync!;
          try {
            const session = await coachSyncFetchSession(ws.linkToken, ws.apiBaseUrl);
            merged.push(...session.athletes);
          } catch {
            // Best-effort: keep local roster if sync is unreachable.
          }
        }
      }
      if (merged.length > 0) {
        await mergeRemoteSharedAthletesIntoKids(merged);
      }

      const kids = await getKidsById();
      setKidsByIdState(kids);
    } finally {
      setReady(true);
    }
  }, [syncConfigured]);

  useFocusEffect(
    useCallback(() => {
      void loadKids();
    }, [loadKids]),
  );

  const { kids, householdSections } = useMemo(() => {
    const sorted = Object.values(kidsById).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return { kids: sorted, householdSections: buildHouseholdSections(sorted) };
  }, [kidsById]);

  /** Newest invite first — shown as the primary row; older codes live under “More invites”. */
  const sortedWriterLinks = useMemo(
    () =>
      [...writerLinks].sort((a, b) => {
        const c = b.createdAt.localeCompare(a.createdAt);
        if (c !== 0) return c;
        return b.updatedAt.localeCompare(a.updatedAt);
      }),
    [writerLinks],
  );
  const primaryWriterLink = sortedWriterLinks[0];
  const extraWriterLinks = sortedWriterLinks.slice(1);

  const onConfirmDeleteKid = useCallback(
    async (kid: Kid) => {
      const ok = await deleteKidPilot(kid.id);
      if (ok) {
        setKidsByIdState((prev) => {
          const { [kid.id]: _r, ...rest } = prev;
          return rest;
        });
      }
    },
    [],
  );

  const requestDeleteKid = useCallback(
    (kid: Kid) => {
      Alert.alert(
        "Delete kid?",
        `Remove ${kid.name} from the pilot roster? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => void onConfirmDeleteKid(kid),
          },
        ],
      );
    },
    [onConfirmDeleteKid],
  );

  const requestArchiveWriterLink = useCallback(
    (link: CoachLink) => {
      const tail = (link.weeklySync?.linkToken ?? "").trim();
      const preview = tail.length > 12 ? `${tail.slice(0, 6)}…${tail.slice(-4)}` : tail || "this invite";
      Alert.alert(
        "Archive invite?",
        `Remove ${preview} from this device? Parents who already joined keep their link until they disconnect. You can create a new invite anytime.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Archive",
            style: "destructive",
            onPress: async () => {
              const nowIso = new Date().toISOString();
              const all = await getCoachLinks();
              const next = all.map((l) =>
                l.id === link.id
                  ? { ...l, status: "revoked" as const, revokedAt: nowIso, updatedAt: nowIso }
                  : l,
              );
              await setCoachLinks(next);
              setMoreInvitesExpanded(false);
              await loadKids();
            },
          },
        ],
      );
    },
    [loadKids],
  );

  const onCreateFamilyInvite = useCallback(async () => {
    const display = coachNameDraft.trim() || "Coach";
    if (!syncConfigured) {
      Alert.alert(
        "Sync not configured",
        "Set EXPO_PUBLIC_COACH_SYNC_BASE_URL to your deployed worker URL and rebuild before creating invites.",
      );
      return;
    }
    setCreatingInvite(true);
    try {
      const res = await coachSyncCreateSession({
        coachDisplayName: display,
        academyName: academyDraft.trim() ? academyDraft.trim().slice(0, 160) : undefined,
      });
      const nowIso = new Date().toISOString();
      const parentProfileId = await getOrCreateLocalParentProfileId();
      const baseUrl = getCoachSyncApiBaseUrl()!;

      const coach: CoachIdentity = {
        id: res.coachId,
        displayName: display,
        academyName: academyDraft.trim() ? academyDraft.trim().slice(0, 160) : undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const newLink: CoachLink = {
        id: `link_sync_writer_${Date.now()}`,
        coachId: res.coachId,
        parentProfileId,
        scope: "household",
        status: "active",
        canReceiveCompletionReceipts: false,
        createdAt: nowIso,
        updatedAt: nowIso,
        weeklySync: {
          apiBaseUrl: baseUrl,
          linkToken: res.linkToken,
          writerSecret: res.writerSecret,
        },
      };

      const existingCoaches = await getCoachesById();
      const existingLinks = await getCoachLinks();
      await setCoachesById({ ...existingCoaches, [coach.id]: coach });
      await setCoachLinks([...existingLinks, newLink]);
      await loadKids();
      Alert.alert(
        "Invite ready",
        "Share this code with a parent device (Connect with your coach on their weekly screen). It links them to this coach’s published weekly family note — one channel per invite, not per athlete. Keep this coach phone safe — it holds the publish key.",
      );
    } catch (e) {
      const msg =
        e instanceof CoachWeeklySyncApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not create invite.";
      Alert.alert("Could not create invite", msg);
    } finally {
      setCreatingInvite(false);
    }
  }, [academyDraft, coachNameDraft, loadKids, syncConfigured]);

  const onAddKid = useCallback(async () => {
    const trimmed = kidName.trim();
    if (!trimmed) {
      Alert.alert("Kid name required", "Add a kid name to create this pilot roster entry.");
      return;
    }

    setSavingKid(true);
    try {
      const nowIso = new Date().toISOString();
      const id = `kid_${Date.now()}`;

      const existing = await getKidsById();
      const labelNorm = normalizeKidHouseholdLabel(householdLabelDraft);
      const created: Kid = {
        id,
        name: trimmed,
        ...(labelNorm ? { householdLabel: labelNorm } : {}),
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const next: KidsById = { ...existing, [id]: created };
      await setKidsById(next);
      setKidsByIdState(next);
      setKidName("");
      setHouseholdLabelDraft("");

      router.replace(`/profile/coaches/kid/${id}`);
    } finally {
      setSavingKid(false);
    }
  }, [kidName, householdLabelDraft]);

  return (
    <>
      <Stack.Screen options={{ title: "Kids (Pilot)" }} />
      <View style={{ flex: 1, backgroundColor: UI.screenBg }}>
        <KeyboardAwareScrollView
          enableOnAndroid
          enableAutomaticScroll
          enableResetScrollToCoords={false}
          keyboardOpeningTime={120}
          viewIsInsideTabBar
          extraHeight={headerHeight}
          extraScrollHeight={Math.max(32, insets.bottom + 16)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          style={{ flex: 1, backgroundColor: UI.screenBg }}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: Math.max(24, insets.bottom + 20),
          }}
        >
        <Pressable
          onPress={() => router.replace("/profile")}
          style={({ pressed }) => ({
            marginBottom: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
            alignSelf: "flex-start",
          })}
        >
          <Text style={{ fontSize: 14, color: UI.textPrimary }}>Back to Profile</Text>
        </Pressable>

        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6, color: UI.textPrimary }}>
          Kids (Pilot)
        </Text>
        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
          Internal pilot roster. Choose a kid to set weekly focus and view kid history.
        </Text>

        <View style={{ height: 14 }} />

        {syncConfigured ? (
          <View
            style={{
              padding: 16,
              borderRadius: CARD_RADIUS,
              borderWidth: 1,
              borderColor: "#93c5fd",
              backgroundColor: "#eff6ff",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "800", color: "#1e3a8a" }}>
              FAMILY WEEKLY NOTE (SYNC)
            </Text>
            <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 19 }}>
              Create a coach-level invite for a parent phone. It syncs one shared weekly family note channel
              (title + family-facing text your coach publishes) — not tied to a specific kid yet, and not
              check-in notes or video links.
            </Text>
            <TextInput
              value={coachNameDraft}
              onChangeText={setCoachNameDraft}
              placeholder="Your name as families see it"
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="words"
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgCard,
                color: UI.textPrimary,
              }}
            />
            <TextInput
              value={academyDraft}
              onChangeText={setAcademyDraft}
              placeholder="Academy name (optional)"
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="words"
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgCard,
                color: UI.textPrimary,
              }}
            />
            <Pressable
              disabled={creatingInvite}
              onPress={() => void onCreateFamilyInvite()}
              style={({ pressed }) => ({
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: pressed ? "#1e40af" : "#1d4ed8",
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 10,
                opacity: creatingInvite ? 0.65 : 1,
              })}
            >
              {creatingInvite ? <ActivityIndicator color="#ffffff" /> : null}
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#ffffff" }}>
                {creatingInvite ? "Creating…" : "Create family invite"}
              </Text>
            </Pressable>

            {sortedWriterLinks.length > 0 && primaryWriterLink ? (
              <View style={{ gap: 12, marginTop: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#1e3a8a" }}>Active invites</Text>
                <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 18 }}>
                  Each code is its own weekly note channel. Most academies only need one live invite; create
                  another if a second parent phone should subscribe separately.
                </Text>

                <View
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#93c5fd",
                    backgroundColor: UI.bgCard,
                  }}
                >
                  <Text style={{ fontSize: 11, color: UI.textSecondary, marginBottom: 6 }}>
                    Current invite · parent pastes this code
                  </Text>
                  <Text
                    selectable
                    style={{
                      fontSize: 13,
                      color: UI.textPrimary,
                      fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
                    }}
                  >
                    {primaryWriterLink.weeklySync!.linkToken}
                  </Text>
                  <Pressable
                    onPress={() => requestArchiveWriterLink(primaryWriterLink)}
                    style={({ pressed }) => ({
                      marginTop: 10,
                      alignSelf: "flex-start",
                      paddingVertical: 6,
                      paddingHorizontal: 2,
                      opacity: pressed ? 0.65 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#b45309" }}>Archive invite</Text>
                  </Pressable>
                </View>

                {extraWriterLinks.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    <Pressable
                      onPress={() => setMoreInvitesExpanded((v) => !v)}
                      style={({ pressed }) => ({
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: UI.border,
                        backgroundColor: pressed ? "#f9fafb" : UI.bgCard,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      })}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "800", color: UI.textPrimary }}>
                        More invites ({extraWriterLinks.length})
                      </Text>
                      <Text style={{ fontSize: 12, color: UI.textSecondary, fontWeight: "700" }}>
                        {moreInvitesExpanded ? "Hide" : "Show"}
                      </Text>
                    </Pressable>

                    {moreInvitesExpanded ? (
                      <View style={{ gap: 10 }}>
                        {extraWriterLinks.map((l, idx) => (
                          <View
                            key={l.id}
                            style={{
                              padding: 12,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: UI.border,
                              backgroundColor: UI.bgCard,
                            }}
                          >
                            <Text style={{ fontSize: 11, color: UI.textSecondary, marginBottom: 6 }}>
                              Older invite {idx + 1} of {extraWriterLinks.length}
                            </Text>
                            <Text
                              selectable
                              style={{
                                fontSize: 13,
                                color: UI.textPrimary,
                                fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
                              }}
                            >
                              {l.weeklySync!.linkToken}
                            </Text>
                            <Pressable
                              onPress={() => requestArchiveWriterLink(l)}
                              style={({ pressed }) => ({
                                marginTop: 10,
                                alignSelf: "flex-start",
                                paddingVertical: 6,
                                paddingHorizontal: 2,
                                opacity: pressed ? 0.65 : 1,
                              })}
                            >
                              <Text style={{ fontSize: 12, fontWeight: "700", color: "#b45309" }}>
                                Archive invite
                              </Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          <View
            style={{
              padding: 14,
              borderRadius: CARD_RADIUS,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: "#fef3c7",
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 13, color: "#92400e", lineHeight: 19 }}>
              Weekly family sync URL is not set on this build. Add EXPO_PUBLIC_COACH_SYNC_BASE_URL and
              redeploy the worker (see coach-sync-worker/) to enable invites.
            </Text>
          </View>
        )}

        <View style={{ height: 4 }} />

        {!ready ? (
          <Text style={{ fontSize: 14, color: UI.textSecondary }}>Loading kids…</Text>
        ) : kids.length === 0 ? (
          <View
            style={{
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
              gap: 6,
            }}
          >
            <Text style={{ color: UI.textPrimary, fontWeight: "700" }}>No kids yet</Text>
            <Text style={{ color: UI.textSecondary, fontSize: 13 }}>
              Add a kid to start tracking weekly focus locally.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 18, marginTop: 10 }}>
            {householdSections.map(({ sectionKey, title, kids: sectionKids }) => (
              <View key={sectionKey} style={{ gap: 10 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color: UI.textPrimary,
                    letterSpacing: 0.2,
                  }}
                >
                  {title}
                </Text>
                <View style={{ gap: 10 }}>
                  {sectionKids.map((kid) => (
                    <Swipeable
                      key={kid.id}
                      overshootRight={false}
                      renderRightActions={() => (
                        <Pressable
                          onPress={() => requestDeleteKid(kid)}
                          style={({ pressed }) => ({
                            justifyContent: "center",
                            backgroundColor: pressed ? "#b91c1c" : UI.deleteBg,
                            borderRadius: 12,
                            marginLeft: 8,
                            paddingHorizontal: 20,
                          })}
                        >
                          <Text
                            style={{
                              color: UI.deleteText,
                              fontWeight: "800",
                              fontSize: 15,
                            }}
                          >
                            Delete
                          </Text>
                        </Pressable>
                      )}
                    >
                      <Pressable
                        onPress={() => router.push(`/profile/coaches/kid/${kid.id}`)}
                        style={({ pressed }) => ({
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: UI.border,
                          backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        })}
                      >
                        <Text style={{ fontSize: 16, color: UI.textPrimary, fontWeight: "700" }}>
                          {kid.name}
                          {kid.sharedAthleteId ? (
                            <Text style={{ fontSize: 12, color: UI.textSecondary, fontWeight: "600" }}>
                              {" "}
                              · linked
                            </Text>
                          ) : null}
                        </Text>
                        <Text style={{ color: UI.textSecondary, fontSize: 18 }}>›</Text>
                      </Pressable>
                    </Swipeable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 18 }} />

        <View
          style={{
            padding: 16,
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
            gap: 12,
          }}
        >
          <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "600", color: UI.textSecondary }}>
            ADD KID (PILOT)
          </Text>
          <TextInput
            value={kidName}
            onChangeText={setKidName}
            placeholder="Kid name"
            placeholderTextColor={UI.textSecondary}
            autoCapitalize="words"
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
              color: UI.textPrimary,
            }}
          />
          <TextInput
            value={householdLabelDraft}
            onChangeText={setHouseholdLabelDraft}
            placeholder="Household (optional)"
            placeholderTextColor={UI.textSecondary}
            autoCapitalize="words"
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
              color: UI.textPrimary,
            }}
          />
          <Pressable
            disabled={savingKid}
            onPress={() => void onAddKid()}
            style={({ pressed }) => ({
              marginTop: 4,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
              opacity: savingKid ? 0.6 : 1,
              alignItems: "center",
            })}
          >
            <Text style={{ fontSize: 15, color: UI.textPrimary, fontWeight: "800" }}>
              Save Kid
            </Text>
          </Pressable>
          <Text style={{ fontSize: 12, color: UI.textSecondary }}>
            Internal pilot (coach-side).
            {syncConfigured
              ? " Weekly note sharing uses the blue Family weekly note card above."
              : " Weekly note sharing is off until the sync URL is configured."}
          </Text>
        </View>
        </KeyboardAwareScrollView>
      </View>
    </>
  );
}
