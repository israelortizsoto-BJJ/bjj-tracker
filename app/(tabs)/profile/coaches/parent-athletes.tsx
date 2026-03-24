import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
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
import { getKidsById, setKidsById } from "../../../../src/storage/coachKidStore";
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
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncOk = isCoachSyncConfigured();

  const refresh = useCallback(async () => {
    setError(null);
    setReady(false);
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
      if (syncOk && ws.parentWriterSecret) {
        const session = await coachSyncFetchSession(ws.linkToken, ws.apiBaseUrl);
        setSessionAthletes(session.athletes);
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

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      void refresh();
    }, [id, refresh]),
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
      <Stack.Screen options={{ title: "Add athletes" }} />
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
          Name your athlete(s)
        </Text>
        <Text style={{ fontSize: 15, color: UI.textSecondary, lineHeight: 22, marginBottom: 16 }}>
          Your coach can see these names on their pilot roster for this invite. You can add more later from
          This week together.
        </Text>

        {!ready ? (
          <ActivityIndicator color={UI.primaryFill} />
        ) : !link ? (
          <Text style={{ color: UI.textSecondary }}>This link is no longer available.</Text>
        ) : (
          <>
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
              </View>
            ) : null}

            <TextInput
              value={nameDraft}
              onChangeText={(t) => {
                setError(null);
                setNameDraft(t);
              }}
              placeholder="Athlete name"
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="words"
              editable={!busy && Boolean(link.weeklySync?.parentWriterSecret)}
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
              disabled={busy || !link.weeklySync?.parentWriterSecret || !nameDraft.trim()}
              onPress={() => void onAddAthlete()}
              style={({ pressed }) => ({
                paddingVertical: 14,
                borderRadius: CARD_RADIUS,
                backgroundColor: pressed ? UI.primaryFillPressed : UI.primaryFill,
                alignItems: "center",
                opacity:
                  busy || !link.weeklySync?.parentWriterSecret || !nameDraft.trim() ? 0.55 : 1,
              })}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>Add athlete</Text>
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
