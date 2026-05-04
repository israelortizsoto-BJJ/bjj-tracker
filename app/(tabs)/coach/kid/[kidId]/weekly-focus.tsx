import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Keyboard, Platform, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useFocusEffect } from "@react-navigation/native";

import { normalizeFamilyResourceUrl } from "../../../../../src/coach/familyResourceUrl";
import {
  appendKidWeeklyFocus,
  getKidWeeklyFocusEntryById,
  startOfWeekMondayYMD,
  todayYMD,
  updateKidWeeklyFocusFocusById,
} from "../../../../../src/storage/coachKidStore";
import { TEMPLATE_CONTENT } from "../../../this-week/template-preview";

function isHttpsMissionUrl(raw: string): boolean {
  const n = normalizeFamilyResourceUrl(raw);
  if (!n) return false;
  try {
    return new URL(n).protocol === "https:";
  } catch {
    return false;
  }
}

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
};

const CARD_RADIUS = 16;

type Tab = "templates" | "custom";

export default function KidWeeklyFocusScreen() {
  const params = useLocalSearchParams<{ kidId?: string; entryId?: string }>();
  const kidId = params.kidId ? String(params.kidId) : "";
  const entryId = params.entryId ? String(params.entryId) : "";
  const editEntryId = entryId.trim() || undefined;

  const weekStartYMD = useMemo(() => {
    if (!kidId) return "";
    return startOfWeekMondayYMD(todayYMD());
  }, [kidId]);

  const templateEntries = useMemo(() => {
    return Object.entries(TEMPLATE_CONTENT).map(([templateId, t]) => ({
      templateId,
      title: t.title,
      description: t.description,
      metadata: t.metadata,
      youtubeUrl: t.youtubeUrl,
    }));
  }, []);

  const [ready, setReady] = useState(false);

  const [tab, setTab] = useState<Tab>("templates");

  const keyboardAwareRef = useRef<InstanceType<typeof KeyboardAwareScrollView> | null>(null);
  const bumpScrollToFocusedInput = useCallback(() => {
    const run = () => {
      (keyboardAwareRef.current as { update?: () => void } | null)?.update?.();
    };
    requestAnimationFrame(run);
    setTimeout(run, 120);
    setTimeout(run, 340);
  }, []);

  useEffect(() => {
    if (Platform.OS === "ios") {
      const sub = Keyboard.addListener("keyboardWillChangeFrame", bumpScrollToFocusedInput);
      return () => sub.remove();
    }
    const sub = Keyboard.addListener("keyboardDidShow", bumpScrollToFocusedInput);
    return () => sub.remove();
  }, [bumpScrollToFocusedInput]);

  // Templates selection
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string>("");
  const [missionResourceUrl, setMissionResourceUrl] = useState<string>("");
  const [missionResourceLabel, setMissionResourceLabel] = useState<string>("");
  const [familyResourceUrl, setFamilyResourceUrl] = useState<string>("");
  const [familyResourceLabel, setFamilyResourceLabel] = useState<string>("");
  const [familyCoachRecapNote, setFamilyCoachRecapNote] = useState<string>("");

  // Custom selection
  const [customTitle, setCustomTitle] = useState<string>("");
  const [customNote, setCustomNote] = useState<string>("");
  const [customYoutubeUrl, setCustomYoutubeUrl] = useState<string>("");

  const load = useCallback(async () => {
    if (!kidId || !weekStartYMD) return;
    setReady(false);
    try {
      if (editEntryId) {
        const existing = await getKidWeeklyFocusEntryById(editEntryId);
        if (!existing || existing.kidId !== kidId) {
          Alert.alert("Not found", "This weekly focus entry is missing or belongs to another kid.");
          router.replace(`/coach/kid/${kidId}`);
          return;
        }
        if (existing.focusType === "template" && !TEMPLATE_CONTENT[existing.templateId]) {
          Alert.alert(
            "Unavailable template",
            "This log uses a template that is no longer in the pilot catalog. Add a new weekly focus from the kid screen.",
          );
          router.replace(`/coach/kid/${kidId}`);
          return;
        }
        if (existing.focusType === "template") {
          setTab("templates");
          setSelectedTemplateId(existing.templateId);
          setReferenceUrl(existing.youtubeUrl ?? "");
          setMissionResourceUrl(existing.missionResourceUrl ?? "");
          setMissionResourceLabel(existing.missionResourceLabel ?? "");
          setFamilyResourceUrl(existing.familyResourceUrl ?? "");
          setFamilyResourceLabel(existing.familyResourceLabel ?? "");
          setFamilyCoachRecapNote(existing.familyCoachRecapNote ?? "");
        } else {
          setTab("custom");
          setCustomTitle(existing.title);
          setCustomNote(existing.note ?? "");
          setCustomYoutubeUrl(existing.youtubeUrl ?? "");
          setMissionResourceUrl(existing.missionResourceUrl ?? "");
          setMissionResourceLabel(existing.missionResourceLabel ?? "");
          setFamilyResourceUrl(existing.familyResourceUrl ?? "");
          setFamilyResourceLabel(existing.familyResourceLabel ?? "");
          setFamilyCoachRecapNote(existing.familyCoachRecapNote ?? "");
        }
      } else {
        setTab("templates");
        setSelectedTemplateId("guard-pull-defense-knee-middle");
        setReferenceUrl("");
        setMissionResourceUrl("");
        setMissionResourceLabel("");
        setFamilyResourceUrl("");
        setFamilyResourceLabel("");
        setFamilyCoachRecapNote("");
        setCustomTitle("");
        setCustomNote("");
        setCustomYoutubeUrl("");
      }
    } finally {
      setReady(true);
    }
  }, [kidId, weekStartYMD, editEntryId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onSave = useCallback(async () => {
    if (!kidId || !weekStartYMD) {
      Alert.alert("Missing kid id", "Please go back and select a kid.");
      return;
    }

    try {
      const missionUrlTrim = missionResourceUrl.trim();
      if (missionUrlTrim && !isHttpsMissionUrl(missionUrlTrim)) {
        Alert.alert("Invalid Mission URL", "Mission links must be a valid https URL.");
        return;
      }
      const missionUrl = missionUrlTrim ? missionUrlTrim : undefined;
      const missionLabel = missionResourceLabel.trim() ? missionResourceLabel.trim() : undefined;

      if (editEntryId) {
        if (tab === "templates") {
          if (!selectedTemplateId) {
            Alert.alert("Pick a template", "Select a weekly focus template before saving.");
            return;
          }
          const t = TEMPLATE_CONTENT[selectedTemplateId];
          if (!t) {
            Alert.alert("Pick a template", "Select a weekly focus template before saving.");
            return;
          }
          const trimmedUrl = referenceUrl.trim();
          const famUrl = familyResourceUrl.trim();
          const famLabel = familyResourceLabel.trim();
          await updateKidWeeklyFocusFocusById(editEntryId, kidId, {
            focusType: "template",
            templateId: selectedTemplateId,
            title: t.title,
            metadata: t.metadata,
            youtubeUrl: trimmedUrl ? trimmedUrl : undefined,
            missionResourceUrl: missionUrl,
            missionResourceLabel: missionLabel,
            familyResourceUrl: famUrl ? famUrl : undefined,
            familyResourceLabel: famLabel ? famLabel : undefined,
            familyCoachRecapNote,
          });
        } else {
          const trimmedTitle = customTitle.trim();
          if (!trimmedTitle) {
            Alert.alert("Title required", "Add a short title for this custom focus item.");
            return;
          }
          const trimmedNote = customNote.trim();
          const trimmedUrl = customYoutubeUrl.trim();
          const famUrl = familyResourceUrl.trim();
          const famLabel = familyResourceLabel.trim();
          await updateKidWeeklyFocusFocusById(editEntryId, kidId, {
            focusType: "custom",
            title: trimmedTitle,
            note: trimmedNote ? trimmedNote : undefined,
            youtubeUrl: trimmedUrl ? trimmedUrl : undefined,
            missionResourceUrl: missionUrl,
            missionResourceLabel: missionLabel,
            familyResourceUrl: famUrl ? famUrl : undefined,
            familyResourceLabel: famLabel ? famLabel : undefined,
            familyCoachRecapNote,
          });
        }
      } else if (tab === "templates") {
        if (!selectedTemplateId) {
          Alert.alert("Pick a template", "Select a weekly focus template before saving.");
          return;
        }

        const t = TEMPLATE_CONTENT[selectedTemplateId];
        const trimmedUrl = referenceUrl.trim();
        const famUrl = familyResourceUrl.trim();
        const famLabel = familyResourceLabel.trim();
        const recap = familyCoachRecapNote.trim();

        await appendKidWeeklyFocus({
          kidId,
          weekStartYMD,
          focusType: "template",
          templateId: selectedTemplateId,
          title: t.title,
          metadata: t.metadata,
          youtubeUrl: trimmedUrl ? trimmedUrl : undefined,
          missionResourceUrl: missionUrl,
          missionResourceLabel: missionLabel,
          familyResourceUrl: famUrl ? famUrl : undefined,
          familyResourceLabel: famLabel ? famLabel : undefined,
          familyCoachRecapNote: recap ? recap : undefined,
        });
      } else {
        const trimmedTitle = customTitle.trim();
        if (!trimmedTitle) {
          Alert.alert("Title required", "Add a short title for this custom focus item.");
          return;
        }

        const trimmedNote = customNote.trim();
        const trimmedUrl = customYoutubeUrl.trim();
        const famUrl = familyResourceUrl.trim();
        const famLabel = familyResourceLabel.trim();
        const recap = familyCoachRecapNote.trim();

        await appendKidWeeklyFocus({
          kidId,
          weekStartYMD,
          focusType: "custom",
          title: trimmedTitle,
          note: trimmedNote ? trimmedNote : undefined,
          youtubeUrl: trimmedUrl ? trimmedUrl : undefined,
          missionResourceUrl: missionUrl,
          missionResourceLabel: missionLabel,
          familyResourceUrl: famUrl ? famUrl : undefined,
          familyResourceLabel: famLabel ? famLabel : undefined,
          familyCoachRecapNote: recap ? recap : undefined,
        });
      }

      router.replace(`/coach/kid/${kidId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Could not save", msg || "Something went wrong saving this weekly focus.");
    }
  }, [
    kidId,
    weekStartYMD,
    editEntryId,
    tab,
    selectedTemplateId,
    referenceUrl,
    customTitle,
    customNote,
    customYoutubeUrl,
    missionResourceUrl,
    missionResourceLabel,
    familyResourceUrl,
    familyResourceLabel,
    familyCoachRecapNote,
  ]);

  const tabButtonStyle = (active: boolean) => ({
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: active ? "#edf2ff" : UI.bgCard,
    opacity: active ? 1 : 0.95,
  });

  const tabTextStyle = (active: boolean) => ({
    color: UI.textPrimary,
    fontWeight: (active ? "900" : "700") as "700" | "900",
    textAlign: "center" as const,
    fontSize: 13,
  });

  return (
    <>
      <Stack.Screen
        options={{ title: editEntryId ? "Edit Weekly Focus (Pilot)" : "Set Weekly Focus (Pilot)" }}
      />
      <KeyboardAwareScrollView
        ref={keyboardAwareRef}
        enableOnAndroid
        extraScrollHeight={80}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: UI.screenBg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <Pressable
          onPress={() => router.push(`/coach/kid/${kidId}`)}
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
          <Text style={{ fontSize: 14, color: UI.textPrimary }}>Back to Kid</Text>
        </Pressable>

        <Text style={{ fontSize: 22, fontWeight: "900", marginBottom: 6, color: UI.textPrimary }}>
          {editEntryId ? "Edit Weekly Focus" : "Set Weekly Focus"}
        </Text>
        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
          {editEntryId ? (
            <>
              Update this saved focus log. Outcome and progress notes on the kid screen are unchanged.
            </>
          ) : (
            <>
              Log a focus for this kid (week of <Text style={{ fontWeight: "800" }}>{weekStartYMD}</Text>
              ). Each save adds a new entry.
            </>
          )}
        </Text>

        <View style={{ height: 14 }} />

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => setTab("templates")}
            style={({ pressed }) => ({
              ...tabButtonStyle(tab === "templates"),
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={tabTextStyle(tab === "templates")}>Templates</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("custom")}
            style={({ pressed }) => ({
              ...tabButtonStyle(tab === "custom"),
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={tabTextStyle(tab === "custom")}>Custom Focus</Text>
          </Pressable>
        </View>

        <View style={{ height: 14 }} />

        {tab === "templates" ? (
          <View
            style={{
              padding: 16,
              borderRadius: CARD_RADIUS,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary }}>
              Mission of the week
            </Text>
            <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
              Pilot catalog · title + template detail · publishes into the shared weekly note for this invite.
            </Text>

            <View style={{ gap: 10 }}>
              {templateEntries.map((t) => {
                const active = t.templateId === selectedTemplateId;
                return (
                  <Pressable
                    key={t.templateId}
                    onPress={() => {
                      setSelectedTemplateId(t.templateId);
                      setReferenceUrl("");
                    }}
                    style={({ pressed }) => ({
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: active ? "#1d4ed8" : UI.border,
                      backgroundColor: active ? "#edf2ff" : UI.bgCard,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "900", color: UI.textPrimary }}>
                      {t.title}
                    </Text>
                    <Text style={{ marginTop: 4, fontSize: 12, color: UI.textSecondary, lineHeight: 16 }}>
                      {t.metadata}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={referenceUrl}
              onChangeText={setReferenceUrl}
              placeholder="Reference video URL — coach only, not published"
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={{
                marginTop: 6,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgCard,
                color: UI.textPrimary,
              }}
            />
            <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary, marginTop: 14 }}>
              What we sharpened with Coach
            </Text>
            <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
              Optional · parent-safe recap — not private check-in notes. Publishes into the shared weekly note for
              this invite.
            </Text>
            <TextInput
              value={familyCoachRecapNote}
              onChangeText={setFamilyCoachRecapNote}
              onFocus={bumpScrollToFocusedInput}
              onContentSizeChange={bumpScrollToFocusedInput}
              placeholder="e.g. We drilled base and one clean stand-up escape…"
              placeholderTextColor={UI.textSecondary}
              multiline
              style={{
                marginTop: 8,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#6ee7b7",
                backgroundColor: "#f0fdf4",
                color: UI.textPrimary,
                minHeight: 88,
                textAlignVertical: "top",
              }}
            />
            <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary, marginTop: 14 }}>
              Mission (Optional)
            </Text>
            <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
              Primary focus for the athlete this week.
            </Text>
            <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
              Optional family link · https only · publishes after you publish from the kid screen.
            </Text>
            <TextInput
              value={missionResourceUrl}
              onChangeText={setMissionResourceUrl}
              onFocus={bumpScrollToFocusedInput}
              placeholder="https://…"
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={{
                marginTop: 6,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#6ee7b7",
                backgroundColor: "#f0fdf4",
                color: UI.textPrimary,
              }}
            />
            <TextInput
              value={missionResourceLabel}
              onChangeText={setMissionResourceLabel}
              onFocus={bumpScrollToFocusedInput}
              placeholder="Short label (optional)"
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="sentences"
              style={{
                marginTop: 8,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#6ee7b7",
                backgroundColor: "#f0fdf4",
                color: UI.textPrimary,
              }}
            />
            <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary, marginTop: 14 }}>
              Study the move
            </Text>
            <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
              Optional family link · https only · publishes after you publish from the kid screen.
            </Text>
            <TextInput
              value={familyResourceUrl}
              onChangeText={setFamilyResourceUrl}
              onFocus={bumpScrollToFocusedInput}
              placeholder="https://…"
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={{
                marginTop: 6,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#6ee7b7",
                backgroundColor: "#f0fdf4",
                color: UI.textPrimary,
              }}
            />
            <TextInput
              value={familyResourceLabel}
              onChangeText={setFamilyResourceLabel}
              onFocus={bumpScrollToFocusedInput}
              placeholder="Short label (e.g. Drill video, Academy schedule)"
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="sentences"
              style={{
                marginTop: 8,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#6ee7b7",
                backgroundColor: "#f0fdf4",
                color: UI.textPrimary,
              }}
            />
          </View>
        ) : (
          <View
            style={{
              padding: 16,
              borderRadius: CARD_RADIUS,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary }}>
              Mission of the week
            </Text>
            <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
              Title + note · publishes into the shared weekly note for this invite.
            </Text>

            <View>
              <Text style={{ fontSize: 13, color: UI.textSecondary, fontWeight: "700" }}>TITLE</Text>
              <TextInput
                value={customTitle}
                onChangeText={setCustomTitle}
                placeholder="e.g. Grip fighting + stance"
                placeholderTextColor={UI.textSecondary}
                style={{
                  marginTop: 6,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: UI.bgCard,
                  color: UI.textPrimary,
                }}
              />
            </View>

            <View>
              <Text style={{ fontSize: 13, color: UI.textSecondary, fontWeight: "700" }}>
                FAMILY NOTE (OPTIONAL)
              </Text>
              <TextInput
                value={customNote}
                onChangeText={setCustomNote}
                placeholder="Optional short note for this kid’s emphasis"
                placeholderTextColor={UI.textSecondary}
                multiline
                onFocus={bumpScrollToFocusedInput}
                onContentSizeChange={bumpScrollToFocusedInput}
                style={{
                  marginTop: 6,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: UI.bgCard,
                  color: UI.textPrimary,
                  minHeight: 92,
                  textAlignVertical: "top",
                }}
              />
            </View>

            <TextInput
              value={customYoutubeUrl}
              onChangeText={setCustomYoutubeUrl}
              placeholder="Reference video URL — coach only, not published"
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
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
            <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary, marginTop: 14 }}>
              What we sharpened with Coach
            </Text>
            <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
              Optional · parent-safe recap — not private check-in notes. Publishes into the shared weekly note for
              this invite.
            </Text>
            <TextInput
              value={familyCoachRecapNote}
              onChangeText={setFamilyCoachRecapNote}
              onFocus={bumpScrollToFocusedInput}
              onContentSizeChange={bumpScrollToFocusedInput}
              placeholder="e.g. We drilled base and one clean stand-up escape…"
              placeholderTextColor={UI.textSecondary}
              multiline
              style={{
                marginTop: 8,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#6ee7b7",
                backgroundColor: "#f0fdf4",
                color: UI.textPrimary,
                minHeight: 88,
                textAlignVertical: "top",
              }}
            />
            <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary, marginTop: 14 }}>
              Mission (Optional)
            </Text>
            <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
              Primary focus for the athlete this week.
            </Text>
            <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
              Optional family link · https only · publishes after you publish from the kid screen.
            </Text>
            <TextInput
              value={missionResourceUrl}
              onChangeText={setMissionResourceUrl}
              onFocus={bumpScrollToFocusedInput}
              placeholder="https://…"
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={{
                marginTop: 6,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#6ee7b7",
                backgroundColor: "#f0fdf4",
                color: UI.textPrimary,
              }}
            />
            <TextInput
              value={missionResourceLabel}
              onChangeText={setMissionResourceLabel}
              onFocus={bumpScrollToFocusedInput}
              placeholder="Short label (optional)"
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="sentences"
              style={{
                marginTop: 8,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#6ee7b7",
                backgroundColor: "#f0fdf4",
                color: UI.textPrimary,
              }}
            />
            <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary, marginTop: 14 }}>
              Study the move
            </Text>
            <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
              Optional family link · https only · publishes after you publish from the kid screen.
            </Text>
            <TextInput
              value={familyResourceUrl}
              onChangeText={setFamilyResourceUrl}
              onFocus={bumpScrollToFocusedInput}
              placeholder="https://…"
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={{
                marginTop: 6,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#6ee7b7",
                backgroundColor: "#f0fdf4",
                color: UI.textPrimary,
              }}
            />
            <TextInput
              value={familyResourceLabel}
              onChangeText={setFamilyResourceLabel}
              onFocus={bumpScrollToFocusedInput}
              placeholder="Short label for parents (optional)"
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="sentences"
              style={{
                marginTop: 8,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#6ee7b7",
                backgroundColor: "#f0fdf4",
                color: UI.textPrimary,
              }}
            />
          </View>
        )}

        <Pressable
          disabled={!ready}
          onPress={() => void onSave()}
          style={({ pressed }) => ({
            marginTop: 14,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#1d4ed8",
            backgroundColor: pressed ? "#1d4ed8" : "#1d4ed8",
            opacity: !ready ? 0.6 : pressed ? 0.85 : 1,
            alignSelf: "stretch",
          })}
        >
          <Text style={{ fontSize: 15, color: "#ffffff", fontWeight: "900", textAlign: "center" }}>
            {editEntryId ? "Save changes" : "Save Focus for This Week"}
          </Text>
        </Pressable>

        <Text style={{ marginTop: 10, fontSize: 12, color: UI.textSecondary }}>
          Internal pilot (coach-side)
        </Text>
      </KeyboardAwareScrollView>
    </>
  );
}

