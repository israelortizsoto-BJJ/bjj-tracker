import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  deleteParentKidCompetitionEntry,
  resolveLinkedTargetForParentWriter,
} from "../../../../src/family/parentKidCompetitionDelete";
import {
  CoachWeeklySyncApiError,
  coachSyncCreateSessionCompetition,
  coachSyncUpdateSessionCompetition,
} from "../../../../src/services/coachWeeklySyncApi";
import { getKidsById, todayYMD } from "../../../../src/storage/coachKidStore";
import {
  persistMediaFromCameraRoll,
  requestMediaLibraryPermission,
} from "../../../../src/media/persistCameraRollMedia";
import {
  createKidCompetitionEntry,
  getKidCompetitionEntryById,
  getWorkerCompetitionIdForEntry,
  updateKidCompetitionEntry,
} from "../../../../src/storage/kidCompetitionStore";
import type {
  KidCompetitionEventStatus,
  KidCompetitionFormat,
  KidCompetitionResult,
} from "../../../../src/types/coachKid";
import { getPlacementLabel } from "../../../../src/features/competition/placementLabel";
import { exitToCompeteAfterCompetitionSave } from "../../../../src/features/competition/syncTabAndExit";
import { medalTierFromKidResult } from "../../../../src/types/coachKid";
const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  accent: "#1d4ed8",
  danger: "#dc2626",
};

const RESULTS: KidCompetitionResult[] = [
  "gold",
  "silver",
  "bronze",
  "participated",
  "dnf",
  "other",
];

const EVENT_STATUSES: KidCompetitionEventStatus[] = [
  "upcoming",
  "completed",
  "cancelled",
  "unknown",
];

const FORMATS: KidCompetitionFormat[] = ["gi", "nogi", "both"];

function resultLabel(r: KidCompetitionResult): string {
  if (r === "dnf") return "DNF";
  if (r === "other") return "Other";
  return getPlacementLabel(r);
}

function eventStatusLabel(s: KidCompetitionEventStatus): string {
  switch (s) {
    case "upcoming":
      return "Upcoming";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "unknown":
      return "Unknown";
  }
}

function formatChipLabel(f: KidCompetitionFormat): string {
  switch (f) {
    case "gi":
      return "Gi";
    case "nogi":
      return "No-Gi";
    case "both":
      return "Both";
  }
}

function isValidYMD(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return false;
  const t = new Date(`${s.trim()}T12:00:00`);
  return !Number.isNaN(t.getTime());
}

/** Expo Router may pass a string or string[] for the same key. */
function searchParamOne(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? String(v[0] ?? "") : String(v);
}

function toOpErrorMessage(e: unknown): string {
  if (e instanceof CoachWeeklySyncApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Try again shortly.";
}

export default function FamilyCompetitionEditScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    kidId?: string | string[];
    entryId?: string | string[];
    /** New add opens pass a fresh nonce so each visit resets without wiping drafts on tab refocus. */
    openNonce?: string | string[];
  }>();
  const kidId = searchParamOne(params.kidId);
  const entryId = searchParamOne(params.entryId);
  const openNonce = searchParamOne(params.openNonce);
  const isNew = !entryId;

  const [loading, setLoading] = useState(!isNew);
  const [nameDraft, setNameDraft] = useState("");
  /** New adds start empty (placeholder hints today); avoids carrying the last saved date across tab revisits. */
  const [dateDraft, setDateDraft] = useState("");
  const [resultDraft, setResultDraft] = useState<KidCompetitionResult | undefined>(
    undefined,
  );
  const [eventStatusDraft, setEventStatusDraft] = useState<
    KidCompetitionEventStatus | undefined
  >(undefined);
  const [formatDraft, setFormatDraft] = useState<KidCompetitionFormat | undefined>(
    undefined,
  );
  const [promoterDraft, setPromoterDraft] = useState("");
  const [medalImageDraft, setMedalImageDraft] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  /**
   * New-entry form: reset when `openNonce` changes (each in-app "Add competition" push).
   * Without a nonce, fall back to once-per-kid bootstrap for deep links / older URLs.
   *
   * This screen is a sibling tab route; it often stays mounted when returning to the coaches
   * index, so React state persists. `useLayoutEffect` runs after params update and before
   * paint — `useFocusEffect` alone can run while `useLocalSearchParams` still holds the prior
   * nonce, skipping a reset and leaving date/result stuck.
   */
  const lastProcessedOpenNonceRef = useRef<string | null>(null);
  const familyNewFormBootstrapKidRef = useRef<string | null>(null);

  const loadExisting = useCallback(async () => {
    if (!entryId) return;
    setLoading(true);
    try {
      const found = await getKidCompetitionEntryById(entryId);
      if (!found || found.kidId !== kidId) {
        Alert.alert("Not found", "This competition is missing or belongs to another athlete.");
        exitToCompeteAfterCompetitionSave({
          navigation,
          actorRole: "parent",
          athleteId: kidId,
          competitionId: null,
        });
        return;
      }
      if (__DEV__) {
        console.log("[bjj-sync-debug] family-competition edit loadExisting row", {
          entryId,
          id: found.id,
          kidId: found.kidId,
          tournamentName: found.tournamentName,
          sharedCompetitionId: found.sharedCompetitionId ?? null,
          sharedAthleteId: found.sharedAthleteId ?? null,
          resolvedWorkerCompetitionId:
            getWorkerCompetitionIdForEntry(found) || null,
        });
      }
      setNameDraft(found.tournamentName);
      setDateDraft(found.eventDate);
      setResultDraft(found.result);
      setEventStatusDraft(found.status ?? found.eventStatus);
      setFormatDraft(found.format);
      setPromoterDraft(found.organizationOrPromoter ?? "");
      setMedalImageDraft(found.medalImageUri);
    } finally {
      setLoading(false);
    }
  }, [entryId, kidId, navigation]);

  useEffect(() => {
    if (!kidId) {
      Alert.alert("Missing athlete", "Go back to This week together and try again.");
      exitToCompeteAfterCompetitionSave({
        navigation,
        actorRole: "parent",
        athleteId: "",
        competitionId: null,
      });
    }
  }, [kidId, navigation]);

  useLayoutEffect(() => {
    if (!kidId || !isNew) return;
    const shouldResetFromNonce =
      openNonce.length > 0 && lastProcessedOpenNonceRef.current !== openNonce;
    const shouldResetLegacyNoNonce =
      openNonce.length === 0 && familyNewFormBootstrapKidRef.current !== kidId;
    if (!shouldResetFromNonce && !shouldResetLegacyNoNonce) return;
    if (openNonce.length > 0) {
      lastProcessedOpenNonceRef.current = openNonce;
    } else {
      familyNewFormBootstrapKidRef.current = kidId;
    }
    setNameDraft("");
    setDateDraft("");
    setResultDraft(undefined);
    setEventStatusDraft(undefined);
    setFormatDraft(undefined);
    setPromoterDraft("");
    setMedalImageDraft(undefined);
    setLoading(false);
  }, [kidId, isNew, openNonce]);

  useFocusEffect(
    useCallback(() => {
      if (!kidId) return;
      if (!isNew) {
        lastProcessedOpenNonceRef.current = null;
        familyNewFormBootstrapKidRef.current = null;
        void loadExisting();
      }
    }, [kidId, isNew, loadExisting]),
  );

  const canSave = useMemo(() => {
    return nameDraft.trim().length > 0 && isValidYMD(dateDraft);
  }, [nameDraft, dateDraft]);

  const saveDisabledHint = useMemo(() => {
    if (canSave) return null;
    const missingName = nameDraft.trim().length === 0;
    const badDate = !isValidYMD(dateDraft);
    if (missingName && badDate) {
      return "Add a tournament name and a valid event date (YYYY-MM-DD) to enable Save.";
    }
    if (missingName) return "Add a tournament name to enable Save.";
    return "Use a valid event date (YYYY-MM-DD) to enable Save.";
  }, [canSave, nameDraft, dateDraft]);

  const pickMedalImage = useCallback(() => {
    const runLibrary = async () => {
      const ok = await requestMediaLibraryPermission();
      if (!ok) {
        Alert.alert("Permission needed", "Allow Photos access to attach a medal photo.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
        base64: false,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (uri) {
        const persisted = await persistMediaFromCameraRoll(uri, "image");
        setMedalImageDraft(persisted);
      }
    };
    const runCamera = async () => {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (!cam.granted) {
        Alert.alert("Permission needed", "Allow Camera to take a medal photo.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (uri) {
        const persisted = await persistMediaFromCameraRoll(uri, "image");
        setMedalImageDraft(persisted);
      }
    };
    Alert.alert("Medal photo", "Choose a source", [
      { text: "Cancel", style: "cancel" },
      { text: "Take photo", onPress: () => void runCamera() },
      { text: "Photo library", onPress: () => void runLibrary() },
    ]);
  }, []);

  async function onSave() {
    if (!canSave || !kidId) return;
    const name = nameDraft.trim();
    const eventDate = dateDraft.trim();
    if (!isValidYMD(eventDate)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD.");
      return;
    }

    setSaving(true);
    try {
      let savedCompetitionId: string | null = isNew ? null : entryId;
      const kids = await getKidsById();
      const kid = kids[kidId];
      const linkedAthleteId = kid?.sharedAthleteId?.trim();

      if (isNew) {
        if (linkedAthleteId && kid) {
          const target = await resolveLinkedTargetForParentWriter(
            linkedAthleteId,
            undefined,
            __DEV__ ? { kidLocalId: kidId, kidName: kid.name } : undefined,
          );
          if (!target) {
            Alert.alert(
              "Could not sync",
              "This athlete is linked here, but this phone could not open the coach invite that lists them for writing. Open Coach link & sharing, confirm the channel shows “Linked — competition sync ready”, then tap Athletes on this invite to relink or add them on that code.",
              [
                { text: "Not now", style: "cancel" },
                {
                  text: "Coach link settings",
                  onPress: () => router.push("/this-week/manage"),
                },
              ],
            );
            return;
          }
          try {
            const remote = await coachSyncCreateSessionCompetition(
              target.linkToken,
              target.parentWriterSecret,
              {
                sharedAthleteId: linkedAthleteId,
                tournamentName: name,
                eventDate,
                ...(typeof resultDraft !== "undefined" ? { result: resultDraft } : {}),
                eventStatus: eventStatusDraft,
                organizationOrPromoter: promoterDraft.trim()
                  ? promoterDraft.trim()
                  : undefined,
                format: formatDraft,
              },
              target.apiBaseUrl,
            );
            const createdRow = await createKidCompetitionEntry({
              kidId,
              sharedAthleteId: linkedAthleteId,
              sharedCompetitionId: remote.competition.id,
              tournamentName: name,
              eventDate,
              ...(typeof resultDraft !== "undefined" ? { result: resultDraft } : {}),
              medal: medalTierFromKidResult(resultDraft),
              medalImageUri: medalImageDraft,
              status: eventStatusDraft,
              eventStatus: eventStatusDraft,
              organizationOrPromoter: promoterDraft.trim()
                ? promoterDraft.trim()
                : undefined,
              format: formatDraft,
            });
            savedCompetitionId = createdRow.id;
          } catch (e) {
            Alert.alert("Could not sync", toOpErrorMessage(e) || "Try again shortly.");
            return;
          }
        } else {
          const createdRow = await createKidCompetitionEntry({
            kidId,
            tournamentName: name,
            eventDate,
            ...(typeof resultDraft !== "undefined" ? { result: resultDraft } : {}),
            medal: medalTierFromKidResult(resultDraft),
            medalImageUri: medalImageDraft,
            status: eventStatusDraft,
            eventStatus: eventStatusDraft,
            organizationOrPromoter: promoterDraft.trim()
              ? promoterDraft.trim()
              : undefined,
            format: formatDraft,
          });
          savedCompetitionId = createdRow.id;
        }
      } else {
        const existing = await getKidCompetitionEntryById(entryId);
        const workerCompetitionId = existing
          ? getWorkerCompetitionIdForEntry(existing)
          : "";
        const athleteForRemote = (existing?.sharedAthleteId ?? kid?.sharedAthleteId)?.trim();
        if (athleteForRemote && workerCompetitionId) {
          const target = await resolveLinkedTargetForParentWriter(
            athleteForRemote,
            workerCompetitionId,
          );
          if (!target) {
            Alert.alert(
              "Could not sync",
              "This entry is synced, but this phone could not match it to a writable invite (wrong channel, stale link, or setup not finished). Open Coach link & sharing → Athletes on this invite for the code that ends with the same suffix as your coach shared, then relink this child if needed.",
              [
                { text: "Not now", style: "cancel" },
                {
                  text: "Coach link settings",
                  onPress: () => router.push("/this-week/manage"),
                },
              ],
            );
            return;
          }
          try {
            await coachSyncUpdateSessionCompetition(
              target.linkToken,
              workerCompetitionId,
              target.parentWriterSecret,
              {
                tournamentName: name,
                eventDate,
                result: resultDraft,
                eventStatus: eventStatusDraft,
                organizationOrPromoter: promoterDraft.trim()
                  ? promoterDraft.trim()
                  : undefined,
                format: formatDraft,
              },
              target.apiBaseUrl,
            );
          } catch (e) {
            Alert.alert("Could not sync", toOpErrorMessage(e) || "Try again shortly.");
            return;
          }
        }
        await updateKidCompetitionEntry(entryId, {
          ...(athleteForRemote ? { sharedAthleteId: athleteForRemote } : {}),
          ...(workerCompetitionId ? { sharedCompetitionId: workerCompetitionId } : {}),
          tournamentName: name,
          eventDate,
          result: resultDraft,
          medal: medalTierFromKidResult(resultDraft),
          medalImageUri: medalImageDraft,
          status: eventStatusDraft,
          eventStatus: eventStatusDraft,
          organizationOrPromoter: promoterDraft.trim()
            ? promoterDraft.trim()
            : undefined,
          format: formatDraft,
        });
      }
      exitToCompeteAfterCompetitionSave({
        navigation,
        actorRole: "parent",
        athleteId: kidId,
        competitionId: savedCompetitionId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Could not save", msg || "Try again.");
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    if (isNew) {
      exitToCompeteAfterCompetitionSave({
        navigation,
        actorRole: "parent",
        athleteId: kidId,
        competitionId: null,
      });
      return;
    }
    Alert.alert(
      "Delete this competition?",
      "This removes the event from your calendar on this phone. If your coach added notes or a video to this entry, those will be deleted too. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const outcome = await deleteParentKidCompetitionEntry(
              entryId,
              kidId,
              getKidsById,
            );
            if (!outcome.ok) {
              Alert.alert(outcome.alertTitle, outcome.alertMessage);
              return;
            }
            exitToCompeteAfterCompetitionSave({
              navigation,
              actorRole: "parent",
              athleteId: kidId,
              competitionId: entryId,
            });
          },
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ title: isNew ? "Add competition" : "Edit competition" }}
      />
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
            onPress={() =>
              exitToCompeteAfterCompetitionSave({
                navigation,
                actorRole: "parent",
                athleteId: kidId,
                competitionId: isNew ? null : entryId,
              })
            }
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
            <Text style={{ fontSize: 14, color: UI.textPrimary }}>Back to Compete</Text>
          </Pressable>

          {loading ? (
            <Text style={{ fontSize: 14, color: UI.textSecondary }}>Loading…</Text>
          ) : (
            <>
              <Text
                style={{
                  fontSize: 12,
                  letterSpacing: 0.6,
                  fontWeight: "700",
                  color: UI.textSecondary,
                }}
              >
                TOURNAMENT NAME
              </Text>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="e.g. Spring Open 2026"
                placeholderTextColor={UI.textSecondary}
                style={{
                  marginTop: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: UI.bgCard,
                  padding: 12,
                  color: UI.textPrimary,
                }}
              />

              <Text
                style={{
                  marginTop: 16,
                  fontSize: 12,
                  letterSpacing: 0.6,
                  fontWeight: "700",
                  color: UI.textSecondary,
                }}
              >
                ORGANIZATION / PROMOTER (OPTIONAL)
              </Text>
              <TextInput
                value={promoterDraft}
                onChangeText={setPromoterDraft}
                placeholder="e.g. IBJJF, local academy…"
                placeholderTextColor={UI.textSecondary}
                style={{
                  marginTop: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: UI.bgCard,
                  padding: 12,
                  color: UI.textPrimary,
                }}
              />

              <Text
                style={{
                  marginTop: 16,
                  fontSize: 12,
                  letterSpacing: 0.6,
                  fontWeight: "700",
                  color: UI.textSecondary,
                }}
              >
                FORMAT (OPTIONAL)
              </Text>
              <Text
                style={{ marginTop: 4, fontSize: 11, color: UI.textSecondary, lineHeight: 15 }}
              >
                Tap again to clear.
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {FORMATS.map((f) => {
                  const active = formatDraft === f;
                  return (
                    <Pressable
                      key={f}
                      onPress={() =>
                        setFormatDraft((prev) => (prev === f ? undefined : f))
                      }
                      style={({ pressed }) => ({
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: active ? UI.accent : UI.border,
                        backgroundColor: active ? "#edf2ff" : UI.bgCard,
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: active ? "800" : "600",
                          color: UI.textPrimary,
                        }}
                      >
                        {formatChipLabel(f)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text
                style={{
                  marginTop: 16,
                  fontSize: 12,
                  letterSpacing: 0.6,
                  fontWeight: "700",
                  color: UI.textSecondary,
                }}
              >
                EVENT DATE (YYYY-MM-DD)
              </Text>
              <TextInput
                value={dateDraft}
                onChangeText={setDateDraft}
                placeholder={todayYMD()}
                placeholderTextColor={UI.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  marginTop: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: UI.bgCard,
                  padding: 12,
                  color: UI.textPrimary,
                }}
              />

              <Text
                style={{
                  marginTop: 16,
                  fontSize: 12,
                  letterSpacing: 0.6,
                  fontWeight: "700",
                  color: UI.textSecondary,
                }}
              >
                EVENT STATUS (OPTIONAL)
              </Text>
              <Text
                style={{ marginTop: 4, fontSize: 11, color: UI.textSecondary, lineHeight: 15 }}
              >
                Tap again to clear.
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {EVENT_STATUSES.map((s) => {
                  const active = eventStatusDraft === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() =>
                        setEventStatusDraft((prev) => (prev === s ? undefined : s))
                      }
                      style={({ pressed }) => ({
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: active ? UI.accent : UI.border,
                        backgroundColor: active ? "#edf2ff" : UI.bgCard,
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: active ? "800" : "600",
                          color: UI.textPrimary,
                        }}
                      >
                        {eventStatusLabel(s)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text
                style={{
                  marginTop: 16,
                  fontSize: 12,
                  letterSpacing: 0.6,
                  fontWeight: "700",
                  color: UI.textSecondary,
                }}
              >
                RESULT (OPTIONAL)
              </Text>
              <Text
                style={{ marginTop: 4, fontSize: 11, color: UI.textSecondary, lineHeight: 15 }}
              >
                Tap again to clear.
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {RESULTS.map((r) => {
                  const active = resultDraft === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() =>
                        setResultDraft((prev) => (prev === r ? undefined : r))
                      }
                      style={({ pressed }) => ({
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: active ? UI.accent : UI.border,
                        backgroundColor: active ? "#edf2ff" : UI.bgCard,
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: active ? "800" : "600",
                          color: UI.textPrimary,
                        }}
                      >
                        {resultLabel(r)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text
                style={{
                  marginTop: 16,
                  fontSize: 12,
                  letterSpacing: 0.6,
                  fontWeight: "700",
                  color: UI.textSecondary,
                }}
              >
                MEDAL PHOTO (OPTIONAL)
              </Text>
              <Pressable
                onPress={pickMedalImage}
                style={({ pressed }) => ({
                  marginTop: 8,
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: pressed ? "#eef2ff" : UI.bgCard,
                })}
              >
                <Text style={{ fontSize: 14, color: UI.textPrimary }}>
                  {medalImageDraft ? "Replace medal photo" : "Add medal photo (camera or library)"}
                </Text>
              </Pressable>

              <Pressable
                disabled={!canSave || saving || loading}
                onPress={() => void onSave()}
                style={({ pressed }) => ({
                  marginTop: 24,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: UI.accent,
                  backgroundColor: pressed ? UI.accent : UI.accent,
                  opacity: !canSave || saving || loading ? 0.5 : 1,
                  alignItems: "center",
                })}
              >
                <Text style={{ fontSize: 16, color: "#fff", fontWeight: "800" }}>
                  {saving ? "Saving…" : "Save"}
                </Text>
              </Pressable>

              {saveDisabledHint && !loading && !saving ? (
                <Text
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    color: UI.textSecondary,
                    lineHeight: 17,
                    textAlign: "center",
                  }}
                >
                  {saveDisabledHint}
                </Text>
              ) : null}

              {!isNew ? (
                <Pressable
                  disabled={loading}
                  onPress={onDelete}
                  style={({ pressed }) => ({
                    marginTop: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: UI.border,
                    backgroundColor: pressed ? "#fef2f2" : UI.bgCard,
                    alignItems: "center",
                    opacity: loading ? 0.5 : 1,
                  })}
                >
                  <Text style={{ fontSize: 16, color: UI.danger, fontWeight: "800" }}>
                    Delete
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}

          <Text style={{ marginTop: 16, fontSize: 12, color: UI.textSecondary, opacity: 0.9 }}>
            Saved on this phone. Coach-only details stay when you edit here.
          </Text>
        </KeyboardAwareScrollView>
      </View>
    </>
  );
}
