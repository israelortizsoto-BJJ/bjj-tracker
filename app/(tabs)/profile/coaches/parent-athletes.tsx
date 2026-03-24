import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useFocusEffect } from "@react-navigation/native";

import { isCoachSyncConfigured } from "../../../../src/config/coachSync";
import {
  CoachWeeklySyncApiError,
  coachSyncCreateSessionAthlete,
  coachSyncFetchSession,
  coachSyncRedeemParentWriter,
} from "../../../../src/services/coachWeeklySyncApi";
import { getCoachLinks, setCoachLinks } from "../../../../src/storage/coachShareStore";
import {
  attachSharedAthleteToKid,
  getKidsById,
  setKidsById,
} from "../../../../src/storage/coachKidStore";
import { setCachedWeeklyForLinkToken } from "../../../../src/storage/coachWeeklySyncCacheStore";
import type { CoachLink } from "../../../../src/types/coachShare";
import type { Kid, KidsById } from "../../../../src/types/coachKid";
import type { SyncedSharedAthlete } from "../../../../src/types/coachWeeklySync";

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
  const [sessionAthletes, setSessionAthletes] = useState<SyncedSharedAthlete[]>([]);
  const [kidsById, setKidsByIdState] = useState<KidsById>({});
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkingKidId, setLinkingKidId] = useState<string | null>(null);
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
      const found = links.find((l) => l.id === id && l.status === "active");
      const foundSync = found?.weeklySync;
      if (!found || !foundSync?.linkToken || foundSync.writerSecret) {
        setLink(null);
        return;
      }

      let working = found;

      if (!foundSync.parentWriterSecret && syncOk) {
        try {
          const { parentWriterSecret } = await coachSyncRedeemParentWriter(
            foundSync.linkToken,
            foundSync.apiBaseUrl,
          );
          const nextLinks = patchLinkParentSecret(links, working.id, parentWriterSecret);
          await setCoachLinks(nextLinks);
          working = nextLinks.find((l) => l.id === id)!;
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
      if (!ws) {
        setLink(null);
        return;
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

  /**
   * Profiles that can be tied to this invite without creating a duplicate roster row:
   * - never linked, or
   * - linked id is not on this session anymore (reconnect / server removed athlete) when the session
   *   fetch succeeded — local `sharedAthleteId` can be stale if the parent unlinked on the server but
   *   storage was not cleared, or they removed the phone link before “Remove from coach”.
   * Omit kids already present on this session for this invite.
   */
  const relinkCandidateKids = useMemo(() => {
    return Object.values(kidsById)
      .filter((k) => {
        const sid = (k.sharedAthleteId ?? "").trim();
        if (!sid) return true;
        if (!sessionAthletesAuthoritative) return false;
        return !sessionAthleteIds.has(sid);
      })
      .sort((a, b) => {
        const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        if (byName !== 0) return byName;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [kidsById, sessionAthletesAuthoritative, sessionAthleteIds]);

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

        const updated = await attachSharedAthleteToKid(kid.id, athlete);
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
      const existing = await getKidsById();
      const created: Kid = {
        id: localId,
        name: athlete.name,
        sharedAthleteId: athlete.id,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
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

  if (!id) {
    return (
      <>
        <Stack.Screen options={{ title: "Athletes" }} />
        <View style={{ flex: 1, backgroundColor: UI.screenBg, padding: 20 }}>
          <Text style={{ color: UI.danger }}>Missing link.</Text>
          <Pressable onPress={() => router.replace("/profile/coaches")} style={{ marginTop: 16 }}>
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
          Link athletes to this invite
        </Text>
        <Text style={{ fontSize: 15, color: UI.textSecondary, lineHeight: 22, marginBottom: 16 }}>
          If you shared this invite before, link the same child profile first — that keeps one roster row for
          your coach. Add someone new only when you truly need another athlete on this channel.
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
                  Primary: link an athlete you already set up on this phone (same profile for your coach — no
                  duplicate). Use this after reconnecting or if they no longer appear under “On this invite”.
                </Text>
                {relinkCandidateKids.map((k) => {
                  const household = (k.householdLabel ?? "").trim();
                  const isLinking = linkingKidId === k.id;
                  const disableRow =
                    isLinking ||
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
                <Text style={{ marginTop: 8, fontSize: 12, color: UI.textSecondary, lineHeight: 17 }}>
                  To stop sharing someone with your coach later, open This week together → Competition →
                  Remove from coach.
                </Text>
              </View>
            ) : null}

            <Text style={{ fontSize: 12, fontWeight: "700", color: UI.textSecondary, marginBottom: 8 }}>
              ADD NEW ATHLETE
            </Text>
            <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 18, marginBottom: 12 }}>
              Secondary: use only when this child is not already in your roster above.
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
              editable={!busy && linkingKidId === null && Boolean(link.weeklySync?.parentWriterSecret)}
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
              onPress={() => router.replace("/profile/coaches")}
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
