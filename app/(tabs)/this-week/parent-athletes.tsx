import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useFocusEffect } from "@react-navigation/native";

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
import {
  getActiveAthleteId,
  getAthletes,
  setActiveAthleteId,
  type ParentAthlete,
} from "../../../src/storage/athleteStore";
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
import { StorageKeys } from "../../../src/storage/storageKeys";
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

/**
 * Identity-merge bind: rewrite a `ParentAthlete` row's id (parent-side truth) to the server-issued
 * `sharedAthleteId` so `linkedKidIdForParentAthlete(kidsById, activeAthleteId)` resolves the projected
 * `Kid` for downstream This Week / activeKidId hydration. ParentAthlete remains parent-side truth (we
 * preserve name/household/etc.); only the id is reissued to align with the coach/share projection layer.
 * If the active athlete pointed at the old id, it is moved to the new id.
 */
async function rewriteParentAthleteIdToSharedAthleteId(
  parentAthleteOldId: string,
  newSharedAthleteId: string,
): Promise<{ rewrote: boolean; wasActive: boolean }> {
  const oldId = parentAthleteOldId.trim();
  const newId = newSharedAthleteId.trim();
  if (!oldId || !newId || oldId === newId) {
    return { rewrote: false, wasActive: false };
  }
  const all = await getAthletes();
  const target = all.find((a) => a.id === oldId);
  if (!target) {
    return { rewrote: false, wasActive: false };
  }
  const next = all
    .filter((a) => a.id !== oldId && a.id !== newId)
    .concat({ ...target, id: newId });
  await AsyncStorage.setItem(StorageKeys.parentAthletes, JSON.stringify(next));
  const active = await getActiveAthleteId();
  const wasActive = (active ?? "").trim() === oldId;
  if (wasActive) {
    await setActiveAthleteId(newId);
  }
  return { rewrote: true, wasActive };
}

/** After POST /athletes: GET session, confirm roster includes the new id, persist verified snapshot to cache. */
async function verifyRemoteRosterAfterAthletePost(
  linkToken: string,
  apiBaseUrl: string | undefined | null,
  createdAthleteId: string,
): Promise<SyncedSharedAthlete[]> {
  const session = await coachSyncFetchSession(linkToken, apiBaseUrl ?? undefined);
  const expected = createdAthleteId.trim();
  const onRoster = session.athletes.some(
    (a) => (typeof a.id === "string" ? a.id.trim() : "") === expected,
  );
  if (!onRoster) {
    if (__DEV__) {
      console.error("[mm:identity-backbone] PARTIAL_LINK_POST_VERIFICATION_FAILED", {
        expectedAthleteId: expected,
        remoteAthleteIds: session.athletes.map((a) => a.id),
        tokenTail: inviteLinkTokenTail(normalizeInviteLinkToken(linkToken)),
      });
    }
    throw new CoachWeeklySyncApiError(
      "Could not confirm the athlete on the coach session. Try again in a moment.",
      502,
    );
  }
  const nowIso = new Date().toISOString();
  await setCachedWeeklyForLinkToken(
    linkToken,
    session.weekly,
    nowIso,
    session.weeklyByAthleteId ?? {},
    session.athletes,
    session,
    normalizeInviteLinkToken(linkToken),
  );
  return session.athletes;
}

export default function ParentLinkedAthletesScreen() {
  const { linkId } = useLocalSearchParams<{ linkId?: string }>();
  const id = linkId ? String(linkId) : "";

  const [ready, setReady] = useState(false);
  const [link, setLink] = useState<CoachLink | null>(null);
  const [sessionAthletes, setSessionAthletes] = useState<SyncedSharedAthlete[]>([]);
  const [kidsById, setKidsByIdState] = useState<KidsById>({});
  /** Domain A — parent-side identity truth (lives in `parentAthletes`, e.g. Luca). */
  const [parentAthletes, setParentAthletes] = useState<ParentAthlete[]>([]);
  const [linkingKidId, setLinkingKidId] = useState<string | null>(null);
  const [linkingParentAthleteId, setLinkingParentAthleteId] = useState<string | null>(null);
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
      const [localKids, localParentAthletes] = await Promise.all([
        getKidsById(),
        getAthletes(),
      ]);
      setKidsByIdState(localKids);
      setParentAthletes(localParentAthletes);
      if (__DEV__) {
        console.log("[mm:identity-merge] refresh:sources_loaded", {
          kidCount: Object.keys(localKids).length,
          parentAthleteCount: localParentAthletes.length,
          tokenTail: inviteLinkTokenTail(ws.linkToken),
        });
      }
      if (syncOk && ws.parentWriterSecret) {
        const session = await coachSyncFetchSession(ws.linkToken, ws.apiBaseUrl);
        setSessionAthletes(session.athletes);
        setSessionAthletesAuthoritative(true);
        const nowIso = new Date().toISOString();
        await setCachedWeeklyForLinkToken(
          ws.linkToken,
          session.weekly,
          nowIso,
          session.weeklyByAthleteId ?? {},
          session.athletes,
          session,
          normalizeInviteLinkToken(ws.linkToken),
        );
        if (__DEV__) {
          const remoteIds = new Set(
            session.athletes.map((a) => (typeof a.id === "string" ? a.id.trim() : "")).filter(Boolean),
          );
          const tn = normalizeInviteLinkToken(ws.linkToken);
          for (const k of Object.values(localKids)) {
            const kt = normalizeInviteLinkToken(k.sharedFromInviteTokenNorm ?? "");
            if (kt !== tn) continue;
            const aid = (k.sharedAthleteId ?? "").trim();
            if (aid && !remoteIds.has(aid)) {
              console.warn("[mm:identity-backbone] PARTIAL_LINK_session_GET_missing_local_linked_athlete", {
                kidId: k.id,
                localSharedAthleteId: aid,
                tokenTail: inviteLinkTokenTail(tn),
                remoteAthleteCount: session.athletes.length,
              });
            }
          }
        }
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
   * Local child profiles selectable for linkage (Domain A — device roster), not suppressed by roster GET.
   * After an authoritative session fetch, omit only kids already on this invite coherently (same invite
   * token norm + roster id) so linking does not create a duplicate session athlete row.
   */
  const relinkCandidateKids = useMemo(() => {
    return Object.values(kidsById)
      .filter((k) => {
        const sid = (k.sharedAthleteId ?? "").trim();
        if (!sid) return true;
        // Selection must show locals with linkage unknown or stale until GET completes; hiding them here
        // left `sharedAthleteId`-set profiles invisible whenever roster never became authoritative.
        if (!sessionAthletesAuthoritative) return true;
        const onSession = sessionAthleteIds.has(sid);
        const tokenMatchesCurrentInvite =
          Boolean(currentInviteTokenNorm) &&
          normalizeInviteLinkToken(k.sharedFromInviteTokenNorm ?? "") === currentInviteTokenNorm;
        if (onSession && tokenMatchesCurrentInvite) return false;
        return true;
      })
      .sort((a, b) => {
        const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        if (byName !== 0) return byName;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [currentInviteTokenNorm, kidsById, sessionAthleteIds, sessionAthletesAuthoritative]);

  /** Session athletes that match a local child profile on this invite — eligible for Remove from coach. */
  const removableAthleteRows = useMemo(() => {
    if (!sessionAthletesAuthoritative || !currentInviteTokenNorm) return [];
    const rows: { athlete: SyncedSharedAthlete; kid: Kid }[] = [];
    for (const a of sessionAthletes) {
      const aid = (typeof a.id === "string" ? a.id : "").trim();
      if (!aid) continue;
      const kid = Object.values(kidsById).find((k) => (k.sharedAthleteId ?? "").trim() === aid);
      if (kid) rows.push({ athlete: a, kid });
    }
    return rows;
  }, [currentInviteTokenNorm, kidsById, sessionAthletes, sessionAthletesAuthoritative]);

  /**
   * Parent-side identity rows (Domain A — `parentAthletes`) that still need a coach/share `Kid`
   * projection on this invite. Hidden when:
   *  - the parent athlete id is already a `sharedAthleteId` on any `Kid` (already projected), OR
   *  - a `Kid` candidate with the same trimmed/lowercased name is already rendered (visual dedupe), OR
   *  - the parent athlete id matches a session roster id (the bind already exists upstream).
   */
  const parentAthleteCandidates = useMemo(() => {
    const projectedAthleteIds = new Set<string>();
    for (const k of Object.values(kidsById)) {
      const sid = (k.sharedAthleteId ?? "").trim();
      if (sid) projectedAthleteIds.add(sid);
    }
    const candidateKidNames = new Set(
      relinkCandidateKids.map((k) => k.name.trim().toLowerCase()).filter(Boolean),
    );
    const suppressed: {
      id: string;
      name: string;
      reason: "projected_kid" | "name_dup" | "on_session";
    }[] = [];
    const kept = parentAthletes.filter((pa) => {
      const pid = pa.id.trim();
      const pname = pa.name.trim().toLowerCase();
      if (!pid || !pname) return false;
      if (projectedAthleteIds.has(pid)) {
        suppressed.push({ id: pid, name: pa.name, reason: "projected_kid" });
        return false;
      }
      if (sessionAthleteIds.has(pid)) {
        suppressed.push({ id: pid, name: pa.name, reason: "on_session" });
        return false;
      }
      if (candidateKidNames.has(pname)) {
        suppressed.push({ id: pid, name: pa.name, reason: "name_dup" });
        return false;
      }
      return true;
    });
    const sorted = [...kept].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    if (__DEV__) {
      console.log("[mm:identity-merge] candidates_computed", {
        kidCount: Object.keys(kidsById).length,
        parentAthleteCount: parentAthletes.length,
        kidCandidates: relinkCandidateKids.length,
        parentAthleteCandidates: sorted.length,
        suppressed,
        sessionAuthoritative: sessionAthletesAuthoritative,
      });
    }
    return sorted;
  }, [
    kidsById,
    parentAthletes,
    relinkCandidateKids,
    sessionAthleteIds,
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

        const verifiedAthletes = await verifyRemoteRosterAfterAthletePost(
          link.weeklySync.linkToken,
          link.weeklySync.apiBaseUrl,
          athlete.id,
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
            verifiedRemoteRosterCount: verifiedAthletes.length,
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
        setSessionAthletes(verifiedAthletes);
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

  /**
   * Bind a `ParentAthlete` (Domain A — parent-side identity truth) to this invite:
   * 1. POST /athletes so the server issues a `sharedAthleteId`.
   * 2. Verify the roster GET contains that id (Fresh Invite Truth backbone — unchanged).
   * 3. Create the `Kid` projection row carrying `sharedAthleteId = athlete.id` and the invite token.
   * 4. Reissue the `ParentAthlete.id` to that `sharedAthleteId` so `linkedKidIdForParentAthlete`
   *    can resolve the projection, and downstream This Week / `activeKidId` hydration converges.
   *    The row is preserved (name, household, etc.); only the id field aligns to the share plane.
   */
  const onLinkExistingParentAthlete = useCallback(
    async (pa: ParentAthlete) => {
      const name = pa.name.trim();
      if (!name || !link?.weeklySync?.linkToken || !link.weeklySync.parentWriterSecret) {
        return;
      }
      setLinkingParentAthleteId(pa.id);
      setError(null);
      try {
        const { athlete } = await coachSyncCreateSessionAthlete(
          link.weeklySync.linkToken,
          link.weeklySync.parentWriterSecret,
          { name },
          link.weeklySync.apiBaseUrl,
        );

        const verifiedAthletes = await verifyRemoteRosterAfterAthletePost(
          link.weeklySync.linkToken,
          link.weeklySync.apiBaseUrl,
          athlete.id,
        );

        const nowIso = new Date().toISOString();
        const localKidId = `kid_${Date.now()}`;
        const tokenNorm = normalizeInviteLinkToken(link.weeklySync.linkToken);
        const existing = await getKidsById();
        const createdKid: Kid = {
          id: localKidId,
          name: athlete.name,
          sharedAthleteId: athlete.id,
          sharedFromInviteTokenNorm: tokenNorm,
          isParentManagedChildProfile: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        const nextKids: KidsById = { ...existing, [localKidId]: createdKid };
        await setKidsById(nextKids);

        const bind = await rewriteParentAthleteIdToSharedAthleteId(pa.id, athlete.id);

        const refreshedParentAthletes = await getAthletes();

        if (__DEV__) {
          console.log("[mm:identity-merge] parent_athlete_bind_complete", {
            parentAthleteOldId: pa.id,
            parentAthleteName: pa.name,
            linkedAthleteId: athlete.id,
            kidLocalId: localKidId,
            tokenTail: inviteLinkTokenTail(link.weeklySync.linkToken),
            rewroteParentAthleteId: bind.rewrote,
            switchedActiveAthleteId: bind.wasActive,
            verifiedRemoteRosterCount: verifiedAthletes.length,
            resultingLinkedKidId: localKidId,
          });
        }

        setKidsByIdState(nextKids);
        setParentAthletes(refreshedParentAthletes);
        setSessionAthletes(verifiedAthletes);
      } catch (e) {
        const msg =
          e instanceof CoachWeeklySyncApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Could not link athlete.";
        setError(msg);
      } finally {
        setLinkingParentAthleteId(null);
      }
    },
    [link],
  );

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
          Link a child profile that already exists on this phone (from Summary). New household athletes are added
          under Summary first so identity and weekly sync stay aligned.
        </Text>

        {!ready ? (
          <ActivityIndicator color={UI.primaryFill} />
        ) : !link ? (
          <Text style={{ color: UI.textSecondary }}>This link is no longer available.</Text>
        ) : (
          <>
            {relinkCandidateKids.length > 0 || parentAthleteCandidates.length > 0 ? (
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
                    linkingParentAthleteId !== null ||
                    unlinkingKidId !== null ||
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
                {parentAthleteCandidates.map((pa) => {
                  const household = (pa.household ?? "").trim();
                  const isLinking = linkingParentAthleteId === pa.id;
                  const disableRow =
                    isLinking ||
                    linkingKidId !== null ||
                    unlinkingKidId !== null ||
                    !link.weeklySync?.parentWriterSecret ||
                    !pa.name.trim();
                  return (
                    <Pressable
                      key={`pa:${pa.id}`}
                      disabled={disableRow}
                      onPress={() => void onLinkExistingParentAthlete(pa)}
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
                            {pa.name}
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
                        isUnlinking ||
                        linkingKidId !== null ||
                        linkingParentAthleteId !== null ||
                        !link.weeklySync?.parentWriterSecret;
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
            ) : sessionAthletesAuthoritative ? (
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
                <Text style={{ fontSize: 15, color: UI.textSecondary, lineHeight: 22 }}>
                  No athletes are on this coach session yet. Add the athlete under Summary on this phone, then
                  link them from the lists above.
                </Text>
              </View>
            ) : null}

            {relinkCandidateKids.length === 0 && parentAthleteCandidates.length === 0 ? (
            <View
              style={{
                marginBottom: 8,
                padding: 14,
                borderRadius: CARD_RADIUS,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgCard,
                gap: 10,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: UI.textSecondary }}>NEW ATHLETE</Text>
              <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
                Household athletes are created in Summary. After saving, come back here to attach them to this
                invite.
              </Text>
              <Pressable
                disabled={linkingKidId !== null || linkingParentAthleteId !== null || unlinkingKidId !== null}
                onPress={() => router.push("/summary/add-athlete")}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  borderRadius: CARD_RADIUS,
                  backgroundColor: pressed ? UI.primaryFillPressed : UI.primaryFill,
                  alignItems: "center",
                  opacity:
                    linkingKidId !== null || linkingParentAthleteId !== null || unlinkingKidId !== null
                      ? 0.55
                      : 1,
                })}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>Open Summary — Add athlete</Text>
              </Pressable>
            </View>
            ) : null}

            {error ? (
              <Text style={{ fontSize: 14, color: UI.danger, marginBottom: 12 }}>{error}</Text>
            ) : null}

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
