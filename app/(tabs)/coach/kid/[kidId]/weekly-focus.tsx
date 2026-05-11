import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Keyboard, Platform, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useFocusEffect } from "@react-navigation/native";

import { normalizeFamilyResourceUrl } from "../../../../../src/coach/familyResourceUrl";
import { normalizePublishableSystemKey } from "../../../../../src/lib/taxonomy/publishableSystemKey";
import { FUNDAMENTALS_TAXONOMY } from "../../../../../src/fundamentals/taxonomy";
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

/** Coach-only reference block: visually separated from publish-facing fields (not data changes). */
const coachOnlySection = {
  marginTop: 6,
  paddingTop: 16,
  paddingHorizontal: 12,
  paddingBottom: 12,
  borderTopWidth: 1,
  borderTopColor: "#e5e7eb",
  borderRadius: 12,
  backgroundColor: "#f9fafb",
  borderWidth: 1,
  borderColor: "#e7e5e4",
  gap: 8,
} as const;

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

  const systemOptions = useMemo(
    () => FUNDAMENTALS_TAXONOMY.map((system) => ({ id: system.id, label: system.label })),
    [],
  );

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
  const [systemKey, setSystemKey] = useState<string>("");

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
          setSystemKey(normalizePublishableSystemKey(existing.systemKey) ?? "");
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
          setSystemKey(normalizePublishableSystemKey(existing.systemKey) ?? "");
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
        setSystemKey("");
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
      const normalizedSk = normalizePublishableSystemKey(systemKey);
      if (!normalizedSk) {
        const raw = systemKey.trim();
        if (!raw) {
          Alert.alert("Pick a system", "Select the BJJ system this weekly focus belongs to.");
        } else {
          Alert.alert(
            "Invalid system id",
            "Use the BJJ system chips above (taxonomy ids only). If this persists, pick your system again.",
          );
        }
        return;
      }
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
            systemKey: normalizedSk,
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
            systemKey: normalizedSk,
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
          systemKey: normalizedSk,
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
          systemKey: normalizedSk,
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
    systemKey,
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

  const renderSystemSelector = () => (
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
      <Text style={{ fontSize: 12, fontWeight: "800", color: "#1d4ed8", letterSpacing: 0.4 }}>
        SYSTEM CLASSIFICATION
      </Text>
      <Text style={{ fontSize: 16, fontWeight: "900", color: UI.textPrimary }}>
        BJJ system
      </Text>
      <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
        Used for Summary alignment and progression. Families still see your headline and note.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {systemOptions.map((system) => {
          const active = system.id === systemKey;
          return (
            <Pressable
              key={system.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setSystemKey(system.id)}
              style={({ pressed }) => ({
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: active ? "#1d4ed8" : UI.border,
                backgroundColor: active ? "#edf2ff" : UI.bgCard,
                opacity: pressed ? 0.86 : 1,
              })}
            >
              <Text
                style={{
                  color: UI.textPrimary,
                  fontSize: 12,
                  fontWeight: active ? "900" : "700",
                }}
              >
                {system.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

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

        {renderSystemSelector()}

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
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#1d4ed8", letterSpacing: 0.4 }}>
              MISSION OF THE WEEK
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "900", color: UI.textPrimary, marginTop: 2 }}>
              Primary weekly message
            </Text>
            <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
              Pilot catalog: title + detail become the family-facing direction. Publishes in the shared weekly note
              when you publish from the kid screen.
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

            <View style={{ marginTop: 4, gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: UI.textPrimary, marginTop: 10 }}>
                Mission link (optional)
              </Text>
              <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
                Same mission, optional https link + label for parents. Not a second topic.
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
                  marginTop: 4,
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

            <View style={{ marginTop: 16, gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#047857", letterSpacing: 0.3 }}>
                WHAT WE SHARPENED WITH COACH
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary }}>
                Supporting context
              </Text>
              <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
                Reflection / recap for families — not private mat notes. Publishes in the shared weekly note.
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
            </View>

            <View style={{ marginTop: 16, gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#92400e", letterSpacing: 0.3 }}>
                STUDY THE MOVE
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary }}>
                Optional supplemental resource
              </Text>
              <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
                Separate from the mission: optional https link + label (e.g. drill clip, schedule).
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

            <View style={coachOnlySection}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: UI.textSecondary, letterSpacing: 0.3 }}>
                REFERENCE VIDEO · COACH ONLY
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary }}>
                Not shared with family
              </Text>
              <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
                For your bench-side planning only. Does not appear in the parent weekly note.
              </Text>
              <TextInput
                value={referenceUrl}
                onChangeText={setReferenceUrl}
                placeholder="Reference video URL (optional)"
                placeholderTextColor={UI.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={{
                  marginTop: 4,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#d6d3d1",
                  backgroundColor: "#fafaf9",
                  color: UI.textPrimary,
                }}
              />
            </View>
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
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#1d4ed8", letterSpacing: 0.4 }}>
              MISSION OF THE WEEK
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "900", color: UI.textPrimary, marginTop: 2 }}>
              Primary weekly message
            </Text>
            <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
              Title + family note are the direction for this week. Publishes in the shared weekly note when you
              publish from the kid screen.
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

            <View style={{ marginTop: 4, gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: UI.textPrimary, marginTop: 6 }}>
                Mission link (optional)
              </Text>
              <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
                Same mission, optional https link + label for parents. Not a second topic.
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
                  marginTop: 4,
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

            <View style={{ marginTop: 16, gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#047857", letterSpacing: 0.3 }}>
                WHAT WE SHARPENED WITH COACH
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary }}>
                Supporting context
              </Text>
              <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
                Reflection / recap for families — not private mat notes. Publishes in the shared weekly note.
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
            </View>

            <View style={{ marginTop: 16, gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#92400e", letterSpacing: 0.3 }}>
                STUDY THE MOVE
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary }}>
                Optional supplemental resource
              </Text>
              <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
                Separate from the mission: optional https link + label (e.g. drill clip, schedule).
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

            <View style={coachOnlySection}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: UI.textSecondary, letterSpacing: 0.3 }}>
                REFERENCE VIDEO · COACH ONLY
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary }}>
                Not shared with family
              </Text>
              <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
                For your bench-side planning only. Does not appear in the parent weekly note.
              </Text>
              <TextInput
                value={customYoutubeUrl}
                onChangeText={setCustomYoutubeUrl}
                placeholder="Reference video URL (optional)"
                placeholderTextColor={UI.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={{
                  marginTop: 4,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#d6d3d1",
                  backgroundColor: "#fafaf9",
                  color: UI.textPrimary,
                }}
              />
            </View>
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
