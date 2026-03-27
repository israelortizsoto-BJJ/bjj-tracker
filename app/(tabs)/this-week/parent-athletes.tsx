import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useFocusEffect } from "@react-navigation/native";

import {
  parentKidCoherentlyLinkedToInviteToken,
  parentStrictWeeklyLinkedCoachLinksForUi,
} from "../../../src/coachShare/coachLinkBinding";
import {
  inviteLinkTokenTail,
  normalizeInviteLinkToken,
} from "../../../src/coachShare/inviteLinkToken";
import { isCoachSyncConfigured } from "../../../src/config/coachSync";
import { resolveLinkedTargetForParentWriter } from "../../../src/family/parentKidCompetitionDelete";
import {
  CoachWeeklySyncApiError,
  coachSyncCreateSessionAthlete,
  coachSyncFetchSession,
  coachSyncRedeemParentWriter,
} from "../../../src/services/coachWeeklySyncApi";
import { getCoachLinks, setCoachLinks } from "../../../src/storage/coachShareStore";
import {
  attachSharedAthleteToKid,
  clearFamilyCompetitionSelectedKidId,
  getFamilyCompetitionSelectedKidId,
  getKidsById,
  setKidsById,
  unlinkParentAthleteFromCoachSession,
} from "../../../src/storage/coachKidStore";
import { setCachedWeeklyForLinkToken } from "../../../src/storage/coachWeeklySyncCacheStore";
import type { CoachLink } from "../../../src/types/coachShare";
import type { Kid, KidsById } from "../../../src/types/coachKid";
import type { SyncedSharedAthlete } from "../../../src/types/coachWeeklySync";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  primaryFill: "#1d4ed8",
  primaryFillPressed: "#1e40af",
  danger: "#b91c1c",
};
const CARD_RADIUS = 16;

function patchLinkParentSecret(links: CoachLink[], linkId: string, secret: string): CoachLink[] {
  const nowIso = new Date().toISOString();
  return links.map((l) =>
    l.id === linkId && l.weeklySync
      ? {
          ...l,
          updatedAt: nowIso,
          weeklySync: { ...l.weeklySync, parentWriterSecret: secret },
        }
      : l,
  );
}

export default function ParentLinkedAthletesScreen() {
  const { linkId } = useLocalSearchParams<{ linkId?: string }>();
  const id = linkId ? String(linkId) : "";

  const [ready, setReady] = useState(false);
  const [link, setLink] = useState<CoachLink | null>(null);
  const [allActiveCoachLinks, setAllActiveCoachLinks] = useState<CoachLink[]>([]);
  const [sessionAthletes, setSessionAthletes] = useState<SyncedSharedAthlete[]>([]);
  const [kidsById, setKidsByIdState] = useState<KidsById>({});
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkingKidId, setLinkingKidId] = useState<string | null>(null);
  const [unlinkingKidId, setUnlinkingKidId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** After a successful `coachSyncFetchSession` this visit; enables stale `sharedAthleteId` relink. */
  const [sessionAthletesAuthoritative, setSessionAthletesAuthoritative] = useState(false);
  const syncOk = isCoachSyncConfigured();

  const refresh = useCallback(async () => {
    setError(null);
    setReady(false);
    setSessionAthletes([]);
    setSessionAthletesAuthoritative(false);
    try {
      const links = await getCoachLinks();
      setAllActiveCoachLinks(parentStrictWeeklyLinkedCoachLinksForUi(links));
      const found = links.find((l) => l.id === id && l.status === "active");
      const foundSync = found?.weeklySync;
      if (!found || !foundSync?.linkToken) {
        setLink(null);
        return;
      }

      let working = found;

      if (!foundSync.parentWriterSecret?.trim() && syncOk) {
        try {
          const { parentWriterSecret } = await coachSyncRedeemParentWriter(
            foundSync.linkToken,
            foundSync.apiBaseUrl,
          );
          const nextLinks = patchLinkParentSecret(links, working.id, parentWriterSecret);
          await setCoachLinks(nextLinks);
          const updated = nextLinks.find((l) => l.id === id);
          if (!updated?.weeklySync?.parentWriterSecret?.trim()) {
            setError("Could not update link.");
            setLink(null);
            return;
          }
          working = updated;
        } catch (e) {
          const msg =
            e instanceof CoachWeeklySyncApiError
              ? e.message
              : e instanceof Error
                ? e.message
                : "Could not enable athlete sharing.";
          setError(msg);
          setLink(found);
          return;
        }
      }

      const ws = working.weeklySync;
      if (!ws?.parentWriterSecret?.trim()) {
        setLink(null);
        return;
      }

      if (__DEV__) {
        console.log("[bjj-sync-debug] parent-athletes refresh loaded link", {
          linkId: working.id,
          linkTokenTail: inviteLinkTokenTail(ws.linkToken ?? ""),
          hasWriterSecret: Boolean(ws.writerSecret?.trim()),
          hasParentWriterSecret: Boolean(ws.parentWriterSecret?.trim()),
          apiBaseUrl: (ws.apiBaseUrl ?? "").trim() ? "set" : "empty",
        });
      }

      setLink(working);
      const localKids = await getKidsById();
      setKidsByIdState(localKids);
      if (syncOk && ws.parentWriterSecret) {
        const session = await coachSyncFetchSession(ws.linkToken, ws.apiBaseUrl);
        setSessionAthletes(session.athletes);
        setSessionAthletesAuthoritative(true);
        const nowIso = new Date().toISOString();
        await setCachedWeeklyForLinkToken(ws.linkToken, session.weekly, nowIso);
      }
    } catch (e) {
      const msg =
        e instanceof CoachWeeklySyncApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not load.";
      setError(msg);
    } finally {
      setReady(true);
    }
  }, [id, syncOk]);

  const sessionAthleteIds = useMemo(
    () => new Set(sessionAthletes.map((a) => (typeof a.id === "string" ? a.id.trim() : "")).filter(Boolean)),
    [sessionAthletes],
  );

  const currentInviteTokenNorm = useMemo(
    () => normalizeInviteLinkToken(link?.weeklySync?.linkToken ?? ""),
    [link?.weeklySync?.linkToken],
  );

  /**
   * Profiles that can be tied to this invite without creating a duplicate roster row:
   * - never linked, or
   * - linked id is not on this session anymore (reconnect / server removed athlete) when the session
   *   fetch succeeded — local `sharedAthleteId` can be stale if the parent unlinked on the server but
   *   storage was not cleared, or they removed the phone link before “Remove from coach”.
   * Omit kids already on this session **and** coherently bound to this invite on this phone (active link
   * + parent writer secret + matching token norm).
   */
  const relinkCandidateKids = useMemo(() => {
    return Object.values(kidsById)
      .filter((k) => {
        const sid = (k.sharedAthleteId ?? "").trim();
        if (!sid) return true;
        if (!sessionAthletesAuthoritative) return false;
        const onSession = sessionAthleteIds.has(sid);
        const coherent =
          Boolean(currentInviteTokenNorm) &&
          parentKidCoherentlyLinkedToInviteToken(k, currentInviteTokenNorm, allActiveCoachLinks);
        if (onSession && coherent) return false;
        return true;
      })
      .sort((a, b) => {
        const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        if (byName !== 0) return byName;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [
    allActiveCoachLinks,
    currentInviteTokenNorm,
    kidsById,
    sessionAthleteIds,
    sessionAthletesAuthoritative,
  ]);

  /** Session athletes that match a local child profile on this invite — eligible for Remove from coach. */
  const removableAthleteRows = useMemo(() => {
    if (!sessionAthletesAuthoritative || !currentInviteTokenNorm) return [];
    const rows: { athlete: SyncedSharedAthlete; kid: Kid }[] = [];
    for (const a of sessionAthletes) {
      const aid = (typeof a.id === "string" ? a.id : "").trim();
      if (!aid) continue;
      const kid = Object.values(kidsById).find((k) => {
        if ((k.sharedAthleteId ?? "").trim() !== aid) return false;
        return parentKidCoherentlyLinkedToInviteToken(k, currentInviteTokenNorm, allActiveCoachLinks);
      });
      if (kid) rows.push({ athlete: a, kid });
    }
    return rows;
  }, [
    allActiveCoachLinks,
    currentInviteTokenNorm,
    kidsById,
    sessionAthletes,
    sessionAthletesAuthoritative,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      void refresh();
    }, [id, refresh]),
  );

  const onRelinkExistingKid = useCallback(
    async (kid: Kid) => {
      const name = kid.name.trim();
      if (!name || !link?.weeklySync?.linkToken || !link.weeklySync.parentWriterSecret) {
        return;
      }
      setLinkingKidId(kid.id);
      setError(null);
      try {
        const { athlete } = await coachSyncCreateSessionAthlete(
          link.weeklySync.linkToken,
          link.weeklySync.parentWriterSecret,
          { name },
          link.weeklySync.apiBaseUrl,
        );

        if (__DEV__) {
          const tokenNorm = normalizeInviteLinkToken(link.weeklySync.linkToken);
          console.log("[bjj-sync-debug] parent-athletes relink existing kid", {
            kidLocalId: kid.id,
            kidName: name,
            linkedAthleteId: athlete.id,
            tokenNorm,
            tokenTail: inviteLinkTokenTail(tokenNorm),
            linkId: link.id,
          });
        }

        const updated = await attachSharedAthleteToKid(
          kid.id,
          athlete,
          normalizeInviteLinkToken(link.weeklySync.linkToken),
        );
        if (!updated) {
          setError("Could not update that child profile.");
          return;
        }

        setKidsByIdState((prev) => ({ ...prev, [kid.id]: updated }));
        setSessionAthletes((prev) => [...prev, athlete]);
      } catch (e) {
        const msg =
          e instanceof CoachWeeklySyncApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Could not link athlete.";
        setError(msg);
      } finally {
        setLinkingKidId(null);
      }
    },
    [link],
  );

  const onAddAthlete = useCallback(async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || !link?.weeklySync?.linkToken || !link.weeklySync.parentWriterSecret) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { athlete } = await coachSyncCreateSessionAthlete(
        link.weeklySync.linkToken,
        link.weeklySync.parentWriterSecret,
        { name: trimmed },
        link.weeklySync.apiBaseUrl,
      );

      const nowIso = new Date().toISOString();
      const localId = `kid_${Date.now()}`;
      const tokenNorm = normalizeInviteLinkToken(link.weeklySync.linkToken);
      const existing = await getKidsById();
      const created: Kid = {
        id: localId,
        name: athlete.name,
        sharedAthleteId: athlete.id,
        sharedFromInviteTokenNorm: tokenNorm,
        isParentManagedChildProfile: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      if (__DEV__) {
        console.log("[bjj-sync-debug] parent-athletes add new kid", {
          kidLocalId: localId,
          linkedAthleteId: athlete.id,
          tokenNorm,
          tokenTail: inviteLinkTokenTail(tokenNorm),
          linkId: link.id,
          hasWriterSecret: Boolean(link.weeklySync?.writerSecret?.trim()),
        });
      }

      const nextKids: KidsById = { ...existing, [localId]: created };
      await setKidsById(nextKids);

      setKidsByIdState(nextKids);
      setNameDraft("");
      setSessionAthletes((prev) => [...prev, athlete]);
    } catch (e) {
      const msg =
        e instanceof CoachWeeklySyncApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not add athlete.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [link, nameDraft]);

  const requestRemoveAthleteFromCoach = useCallback(
    (kid: Kid, displayName: string) => {
      if (!syncOk) {
        Alert.alert(
          "Sync unavailable",
          "Coach sync is not configured in this build, so this action cannot reach the server.",
        );
        return;
      }
      Alert.alert(
        `Remove “${displayName}” from this coach?`,
        "Your coach will no longer see this athlete on their roster or shared competitions. This phone keeps the profile; synced competitions become local entries you can edit or delete.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove from coach",
            style: "destructive",
            onPress: () => {
              void (async () => {
                setUnlinkingKidId(kid.id);
                setError(null);
                try {
                  const sid = kid.sharedAthleteId?.trim();
                  if (!sid) {
                    Alert.alert("Not linked", "This athlete is not on a coach session from this phone.");
                    return;
                  }
                  const target = await resolveLinkedTargetForParentWriter(sid, undefined, undefined, {
                    requireAthleteOnSessionRoster: true,
                  });
                  if (!target) {
                    Alert.alert(
                      "Could not reach coach session",
                      "This phone could not open the invite that lists this athlete. Confirm this channel shows Linked, then try again or ask your coach for help.",
                    );
                    return;
                  }
                  await unlinkParentAthleteFromCoachSession({
                    kidId: kid.id,
                    linkToken: target.linkToken,
                    parentWriterSecret: target.parentWriterSecret,
                    apiBaseUrl: target.apiBaseUrl,
                  });
                  const selected = await getFamilyCompetitionSelectedKidId();
                  if (selected === kid.id) {
                    await clearFamilyCompetitionSelectedKidId();
                  }
                  await refresh();
                } catch (e) {
                  const msg =
                    e instanceof CoachWeeklySyncApiError
                      ? e.message
                      : e instanceof Error
                        ? e.message
                        : "Something went wrong.";
                  Alert.alert("Could not remove", msg);
                } finally {
                  setUnlinkingKidId(null);
                }
              })();
            },
          },
        ],
      );
    },
    [refresh, syncOk],
  );

  if (!id) {
    return (
      <>
        <Stack.Screen options={{ title: "Athletes" }} />
        <View style={{ flex: 1, backgroundColor: UI.screenBg, padding: 20 }}>
          <Text style={{ color: UI.danger }}>Missing link.</Text>
          <Pressable onPress={() => router.replace("/this-week")} style={{ marginTop: 16 }}>
            <Text style={{ color: UI.primaryFill, fontWeight: "700" }}>Back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Link athletes" }} />
      <KeyboardAwareScrollView
        enableOnAndroid
        extraScrollHeight={80}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: UI.screenBg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: "700",
            color: UI.textPrimary,
            marginBottom: 8,
          }}
        >
          Who’s on this invite?
        </Text>
        <Text style={{ fontSize: 15, color: UI.textSecondary, lineHeight: 22, marginBottom: 16 }}>
          Pick an existing child below, or add a new athlete if they are not on this phone yet. Reuse the same
          profile when you reconnect so your coach sees one roster row per child.
        </Text>

        {!ready ? (
          <ActivityIndicator color={UI.primaryFill} />
        ) : !link ? (
          <Text style={{ color: UI.textSecondary }}>This link is no longer available.</Text>
        ) : (
          <>
            {relinkCandidateKids.length > 0 ? (
              <View style={{ marginBottom: 20, gap: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: UI.textSecondary }}>
                  EXISTING CHILD PROFILES
                </Text>
                <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 18 }}>
                  Children already on this phone — tap to attach to this invite (after a reconnect, or if they
                  dropped off the list below).
                </Text>
                {relinkCandidateKids.map((k) => {
                  const household = (k.householdLabel ?? "").trim();
                  const isLinking = linkingKidId === k.id;
                  const disableRow =
                    isLinking ||
                    unlinkingKidId !== null ||
                    busy ||
                    !link.weeklySync?.parentWriterSecret ||
                    !k.name.trim();
                  return (
                    <Pressable
                      key={k.id}
                      disabled={disableRow}
                      onPress={() => void onRelinkExistingKid(k)}
                      style={({ pressed }) => ({
                        paddingVertical: 14,
                        paddingHorizontal: 14,
                        borderRadius: CARD_RADIUS,
                        borderWidth: 1,
                        borderColor: UI.border,
                        backgroundColor: pressed ? "#f9fafb" : UI.bgCard,
                        opacity: disableRow ? 0.55 : 1,
                      })}
                    >
                      {isLinking ? (
                        <ActivityIndicator color={UI.primaryFill} />
                      ) : (
                        <>
                          <Text style={{ fontSize: 16, fontWeight: "600", color: UI.textPrimary }}>
                            {k.name}
                          </Text>
                          {household ? (
                            <Text style={{ fontSize: 13, color: UI.textSecondary, marginTop: 4 }}>
                              {household}
                            </Text>
                          ) : null}
                          <Text style={{ fontSize: 12, color: UI.primaryFill, marginTop: 8, fontWeight: "700" }}>
                            Link to this invite
                          </Text>
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {sessionAthletes.length > 0 ? (
              <View
                style={{
                  marginBottom: 16,
                  padding: 14,
                  borderRadius: CARD_RADIUS,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: UI.bgCard,
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: UI.textSecondary }}>
                  ON THIS INVITE
                </Text>
                {sessionAthletes.map((a) => (
                  <Text key={a.id} style={{ fontSize: 16, fontWeight: "600", color: UI.textPrimary }}>
                    {a.name}
                  </Text>
                ))}
                {removableAthleteRows.length > 0 ? (
                  <View style={{ marginTop: 10, gap: 8 }}>
                    <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 17 }}>
                      Remove from coach when they should leave this roster. The profile stays on this phone;
                      shared competitions become normal entries here.
                    </Text>
                    {removableAthleteRows.map(({ athlete, kid }) => {
                      const name = (athlete.name ?? kid.name ?? "").trim() || "Athlete";
                      const isUnlinking = unlinkingKidId === kid.id;
                      const disableRemove =
                        isUnlinking || busy || linkingKidId !== null || !link.weeklySync?.parentWriterSecret;
                      return (
                        <Pressable
                          key={kid.id}
                          disabled={disableRemove}
                          onPress={() => requestRemoveAthleteFromCoach(kid, name)}
                          style={({ pressed }) => ({
                            paddingVertical: 12,
                            paddingHorizontal: 14,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: UI.danger,
                            backgroundColor: pressed ? "#fef2f2" : UI.bgCard,
                            opacity: disableRemove ? 0.55 : 1,
                          })}
                        >
                          <Text style={{ fontSize: 14, fontWeight: "700", color: UI.danger }}>
                            {isUnlinking ? "Removing…" : `Remove “${name}” from coach`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}

            <Text style={{ fontSize: 12, fontWeight: "700", color: UI.textSecondary, marginBottom: 8 }}>
              ADD NEW ATHLETE
            </Text>
            <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 18, marginBottom: 12 }}>
              Only if they are not listed above — this creates a new child profile on this phone.
            </Text>

            <TextInput
              value={nameDraft}
              onChangeText={(t) => {
                setError(null);
                setNameDraft(t);
              }}
              placeholder="Athlete name"
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="words"
              editable={
                !busy &&
                linkingKidId === null &&
                unlinkingKidId === null &&
                Boolean(link.weeklySync?.parentWriterSecret)
              }
              style={{
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgCard,
                color: UI.textPrimary,
                marginBottom: 12,
              }}
            />

            {error ? (
              <Text style={{ fontSize: 14, color: UI.danger, marginBottom: 12 }}>{error}</Text>
            ) : null}

            <Pressable
              disabled={
                busy ||
                linkingKidId !== null ||
                unlinkingKidId !== null ||
                !link.weeklySync?.parentWriterSecret ||
                !nameDraft.trim()
              }
              onPress={() => void onAddAthlete()}
              style={({ pressed }) => ({
                paddingVertical: 14,
                borderRadius: CARD_RADIUS,
                backgroundColor: pressed ? UI.primaryFillPressed : UI.primaryFill,
                alignItems: "center",
                opacity:
                  busy ||
                  linkingKidId !== null ||
                  unlinkingKidId !== null ||
                  !link.weeklySync?.parentWriterSecret ||
                  !nameDraft.trim()
                    ? 0.55
                    : 1,
              })}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>Add new athlete</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.replace("/this-week")}
              style={({ pressed }) => ({
                marginTop: 18,
                paddingVertical: 14,
                alignItems: "center",
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: UI.textPrimary }}>
                Continue to This week together
              </Text>
            </Pressable>
          </>
        )}
      </KeyboardAwareScrollView>
    </>
  );
}
