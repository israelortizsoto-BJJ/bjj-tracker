import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Keyboard, Platform, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import StableTextInput from "../../../../../src/components/inputs/StableTextInput";
import {
  getKidWeeklyFocusEntryById,
  getOrCreateWeeklyFocusState,
  startOfWeekMondayYMD,
  todayYMD,
  updateKidWeeklyFocusFocusById,
} from "../../../../../src/storage/coachKidStore";
import { TEMPLATE_CONTENT } from "../../template-preview";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
};

const CARD_RADIUS = 16;

const weeklyFocusInputStyles = {
  customTitle: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.bgCard,
    color: UI.textPrimary,
  },
  customFamilyNote: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.bgCard,
    color: UI.textPrimary,
    minHeight: 92,
    textAlignVertical: "top" as const,
  },
  missionUrl: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#6ee7b7",
    backgroundColor: "#f0fdf4",
    color: UI.textPrimary,
  },
  missionLabel: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#6ee7b7",
    backgroundColor: "#f0fdf4",
    color: UI.textPrimary,
  },
  coachRecap: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#6ee7b7",
    backgroundColor: "#f0fdf4",
    color: UI.textPrimary,
    minHeight: 88,
    textAlignVertical: "top" as const,
  },
  studyUrl: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#6ee7b7",
    backgroundColor: "#f0fdf4",
    color: UI.textPrimary,
  },
  studyLabel: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#6ee7b7",
    backgroundColor: "#f0fdf4",
    color: UI.textPrimary,
  },
};

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
  const bumpScrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpScrollToFocusedInput = useCallback(() => {
    if (bumpScrollDebounceRef.current != null) {
      clearTimeout(bumpScrollDebounceRef.current);
    }
    bumpScrollDebounceRef.current = setTimeout(() => {
      bumpScrollDebounceRef.current = null;
      (keyboardAwareRef.current as { update?: () => void } | null)?.update?.();
    }, 100);
  }, []);

  useEffect(() => {
    if (Platform.OS === "ios") {
      const sub = Keyboard.addListener("keyboardWillChangeFrame", bumpScrollToFocusedInput);
      return () => {
        sub.remove();
        if (bumpScrollDebounceRef.current != null) {
          clearTimeout(bumpScrollDebounceRef.current);
        }
      };
    }
    const sub = Keyboard.addListener("keyboardDidShow", bumpScrollToFocusedInput);
    return () => {
      sub.remove();
      if (bumpScrollDebounceRef.current != null) {
        clearTimeout(bumpScrollDebounceRef.current);
      }
    };
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
          router.replace(`/this-week/kid/${kidId}`);
          return;
        }
        if (existing.focusType === "template" && !TEMPLATE_CONTENT[existing.templateId]) {
          Alert.alert(
            "Unavailable template",
            "This log uses a template that is no longer in the pilot catalog. Add a new weekly focus from the kid screen.",
          );
          router.replace(`/this-week/kid/${kidId}`);
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

  // Load when kid/week/entry target changes — not on every navigation focus, so in-progress edits
  // and URL fields are not reset while the screen stays mounted, and we avoid refetch races.
  useEffect(() => {
    void load();
  }, [load]);

  const onSave = useCallback(async () => {
    if (!kidId || !weekStartYMD) {
      Alert.alert("Missing kid id", "Please go back and select a kid.");
      return;
    }

    try {
      if (editEntryId) {
        const rowForMerge = await getKidWeeklyFocusEntryById(editEntryId);
        if (!rowForMerge || rowForMerge.kidId !== kidId) {
          Alert.alert("Not found", "This weekly focus entry is missing or belongs to another kid.");
          return;
        }

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
          const mUrl = missionResourceUrl.trim();
          const mLabel = missionResourceLabel.trim();
          const famUrl = familyResourceUrl.trim();
          const famLabel = familyResourceLabel.trim();
          const missionOut = mUrl;
          const familyOut = famUrl;
          await updateKidWeeklyFocusFocusById(editEntryId, kidId, {
            focusType: "template",
            templateId: selectedTemplateId,
            title: t.title,
            metadata: t.metadata,
            youtubeUrl: trimmedUrl ? trimmedUrl : undefined,
            missionResourceUrl: missionOut,
            missionResourceLabel: mLabel ? mLabel : undefined,
            familyResourceUrl: familyOut,
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
          const mUrl = missionResourceUrl.trim();
          const mLabel = missionResourceLabel.trim();
          const famUrl = familyResourceUrl.trim();
          const famLabel = familyResourceLabel.trim();
          const missionOut = mUrl;
          const familyOut = famUrl;
          await updateKidWeeklyFocusFocusById(editEntryId, kidId, {
            focusType: "custom",
            title: trimmedTitle,
            note: trimmedNote ? trimmedNote : undefined,
            youtubeUrl: trimmedUrl ? trimmedUrl : undefined,
            missionResourceUrl: missionOut,
            missionResourceLabel: mLabel ? mLabel : undefined,
            familyResourceUrl: familyOut,
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
        const mUrl = missionResourceUrl.trim();
        const mLabel = missionResourceLabel.trim();
        const famUrl = familyResourceUrl.trim();
        const famLabel = familyResourceLabel.trim();
        const recap = familyCoachRecapNote.trim();

        const existing = await getOrCreateWeeklyFocusState(kidId, weekStartYMD);
        const missionOut = mUrl;
        const familyOut = famUrl;
        await updateKidWeeklyFocusFocusById(existing.id, kidId, {
          focusType: "template",
          templateId: selectedTemplateId,
          title: t.title,
          metadata: t.metadata,
          youtubeUrl: trimmedUrl ? trimmedUrl : undefined,
          missionResourceUrl: missionOut,
          missionResourceLabel: mLabel ? mLabel : undefined,
          familyResourceUrl: familyOut,
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
        const mUrl = missionResourceUrl.trim();
        const mLabel = missionResourceLabel.trim();
        const famUrl = familyResourceUrl.trim();
        const famLabel = familyResourceLabel.trim();
        const recap = familyCoachRecapNote.trim();

        const existing = await getOrCreateWeeklyFocusState(kidId, weekStartYMD);
        const missionOut = mUrl;
        const familyOut = famUrl;
        await updateKidWeeklyFocusFocusById(existing.id, kidId, {
          focusType: "custom",
          title: trimmedTitle,
          note: trimmedNote ? trimmedNote : undefined,
          youtubeUrl: trimmedUrl ? trimmedUrl : undefined,
          missionResourceUrl: missionOut,
          missionResourceLabel: mLabel ? mLabel : undefined,
          familyResourceUrl: familyOut,
          familyResourceLabel: famLabel ? famLabel : undefined,
          familyCoachRecapNote: recap ? recap : undefined,
        });
      }

      router.replace(`/this-week/kid/${kidId}`);
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

  const studyLabelPlaceholder = useMemo(
    () =>
      tab === "templates"
        ? "Short label (e.g. Drill video, Academy schedule)"
        : "Short label for parents (optional)",
    [tab],
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
          onPress={() => router.push(`/this-week/kid/${kidId}`)}
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
              ). Saving updates this week’s single focus (created if needed).
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
          <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary }}>Mission of the week</Text>
          {tab === "templates" ? (
            <>
              <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
                Pilot catalog · title + template detail · publishes into the shared weekly note for this invite.
              </Text>
              <View style={{ gap: 10 }} collapsable={false}>
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
                      <Text style={{ fontSize: 14, fontWeight: "900", color: UI.textPrimary }}>{t.title}</Text>
                      <Text style={{ marginTop: 4, fontSize: 12, color: UI.textSecondary, lineHeight: 16 }}>
                        {t.metadata}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
                Title + note · publishes into the shared weekly note for this invite.
              </Text>
              <View collapsable={false}>
                <Text style={{ fontSize: 13, color: UI.textSecondary, fontWeight: "700" }}>TITLE</Text>
                <StableTextInput
                  value={customTitle}
                  onChangeText={setCustomTitle}
                  placeholder="e.g. Grip fighting + stance"
                  placeholderTextColor={UI.textSecondary}
                  style={weeklyFocusInputStyles.customTitle}
                />
              </View>
              <View collapsable={false}>
                <Text style={{ fontSize: 13, color: UI.textSecondary, fontWeight: "700" }}>FAMILY NOTE (OPTIONAL)</Text>
                <StableTextInput
                  value={customNote}
                  onChangeText={setCustomNote}
                  placeholder="Optional short note for this kid’s emphasis"
                  placeholderTextColor={UI.textSecondary}
                  multiline
                  scrollEnabled={false}
                  style={weeklyFocusInputStyles.customFamilyNote}
                />
              </View>
            </>
          )}

          <View key="mission-section" collapsable={false} style={{ gap: 0 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary, marginTop: 6 }}>
              Mission link for families (optional)
            </Text>
            <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
              YouTube / Instagram / https — publishes to parents on Read together “Mission of the week.” Separate from
              Study the move below.
            </Text>
            <StableTextInput
              value={missionResourceUrl}
              onChangeText={setMissionResourceUrl}
              placeholder="https://…"
              placeholderTextColor={UI.textSecondary}
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={weeklyFocusInputStyles.missionUrl}
            />
            <Pressable
              onPress={() => setMissionResourceUrl("")}
              style={({ pressed }) => ({
                marginTop: 6,
                alignSelf: "flex-start",
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: pressed ? "#f3f4f6" : UI.bgCard,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ fontSize: 14, color: UI.textPrimary, fontWeight: "600" }}>Clear</Text>
            </Pressable>
            <StableTextInput
              value={missionResourceLabel}
              onChangeText={setMissionResourceLabel}
              placeholder="Short label (optional)"
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="sentences"
              style={weeklyFocusInputStyles.missionLabel}
            />
          </View>

          <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary, marginTop: 14 }}>
            What we sharpened with coach
          </Text>
          <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
            Optional · parent-safe recap — not private check-in notes. Publishes into the shared weekly note for this
            invite.
          </Text>
          <StableTextInput
            value={familyCoachRecapNote}
            onChangeText={setFamilyCoachRecapNote}
            placeholder="e.g. We drilled base and one clean stand-up escape…"
            placeholderTextColor={UI.textSecondary}
            multiline
            scrollEnabled={false}
            style={weeklyFocusInputStyles.coachRecap}
          />
          <View key="study-section" collapsable={false} style={{ gap: 0 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: UI.textPrimary, marginTop: 14 }}>Study the move</Text>
            <Text style={{ fontSize: 11, color: UI.textSecondary, lineHeight: 16 }}>
              Optional family link · https only · publishes after you publish from the kid screen.
            </Text>
            <StableTextInput
              value={familyResourceUrl}
              onChangeText={setFamilyResourceUrl}
              placeholder="https://…"
              placeholderTextColor={UI.textSecondary}
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={weeklyFocusInputStyles.studyUrl}
            />
            <Pressable
              onPress={() => setFamilyResourceUrl("")}
              style={({ pressed }) => ({
                marginTop: 6,
                alignSelf: "flex-start",
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: pressed ? "#f3f4f6" : UI.bgCard,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ fontSize: 14, color: UI.textPrimary, fontWeight: "600" }}>Clear</Text>
            </Pressable>
            <StableTextInput
              value={familyResourceLabel}
              onChangeText={setFamilyResourceLabel}
              placeholder={studyLabelPlaceholder}
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="sentences"
              style={weeklyFocusInputStyles.studyLabel}
            />
          </View>
        </View>

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

