import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useFocusEffect } from "@react-navigation/native";

import {
  appendKidWeeklyFocus,
  getKidWeeklyFocusEntryById,
  startOfWeekMondayYMD,
  todayYMD,
  updateKidWeeklyFocusFocusById,
} from "../../../../../../src/storage/coachKidStore";
import { TEMPLATE_CONTENT } from "../../template-preview";

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

  // Templates selection
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string>("");

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
          router.replace(`/profile/coaches/kid/${kidId}`);
          return;
        }
        if (existing.focusType === "template" && !TEMPLATE_CONTENT[existing.templateId]) {
          Alert.alert(
            "Unavailable template",
            "This log uses a template that is no longer in the pilot catalog. Add a new weekly focus from the kid screen.",
          );
          router.replace(`/profile/coaches/kid/${kidId}`);
          return;
        }
        if (existing.focusType === "template") {
          setTab("templates");
          setSelectedTemplateId(existing.templateId);
          setReferenceUrl(existing.youtubeUrl ?? "");
        } else {
          setTab("custom");
          setCustomTitle(existing.title);
          setCustomNote(existing.note ?? "");
          setCustomYoutubeUrl(existing.youtubeUrl ?? "");
        }
      } else {
        setTab("templates");
        setSelectedTemplateId("guard-pull-defense-knee-middle");
        setReferenceUrl("");
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
          await updateKidWeeklyFocusFocusById(editEntryId, kidId, {
            focusType: "template",
            templateId: selectedTemplateId,
            title: t.title,
            metadata: t.metadata,
            youtubeUrl: trimmedUrl ? trimmedUrl : undefined,
          });
        } else {
          const trimmedTitle = customTitle.trim();
          if (!trimmedTitle) {
            Alert.alert("Title required", "Add a short title for this custom focus item.");
            return;
          }
          const trimmedNote = customNote.trim();
          const trimmedUrl = customYoutubeUrl.trim();
          await updateKidWeeklyFocusFocusById(editEntryId, kidId, {
            focusType: "custom",
            title: trimmedTitle,
            note: trimmedNote ? trimmedNote : undefined,
            youtubeUrl: trimmedUrl ? trimmedUrl : undefined,
          });
        }
      } else if (tab === "templates") {
        if (!selectedTemplateId) {
          Alert.alert("Pick a template", "Select a weekly focus template before saving.");
          return;
        }

        const t = TEMPLATE_CONTENT[selectedTemplateId];
        const trimmedUrl = referenceUrl.trim();

        await appendKidWeeklyFocus({
          kidId,
          weekStartYMD,
          focusType: "template",
          templateId: selectedTemplateId,
          title: t.title,
          metadata: t.metadata,
          youtubeUrl: trimmedUrl ? trimmedUrl : undefined,
        });
      } else {
        const trimmedTitle = customTitle.trim();
        if (!trimmedTitle) {
          Alert.alert("Title required", "Add a short title for this custom focus item.");
          return;
        }

        const trimmedNote = customNote.trim();
        const trimmedUrl = customYoutubeUrl.trim();

        await appendKidWeeklyFocus({
          kidId,
          weekStartYMD,
          focusType: "custom",
          title: trimmedTitle,
          note: trimmedNote ? trimmedNote : undefined,
          youtubeUrl: trimmedUrl ? trimmedUrl : undefined,
        });
      }

      router.replace(`/profile/coaches/kid/${kidId}`);
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
        enableOnAndroid
        extraScrollHeight={80}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: UI.screenBg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <Pressable
          onPress={() => router.push(`/profile/coaches/kid/${kidId}`)}
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
            disabled={Boolean(editEntryId)}
            onPress={() => setTab("templates")}
            style={({ pressed }) => ({
              ...tabButtonStyle(tab === "templates"),
              opacity: editEntryId ? (tab === "templates" ? 1 : 0.45) : pressed ? 0.85 : 1,
            })}
          >
            <Text style={tabTextStyle(tab === "templates")}>Templates</Text>
          </Pressable>
          <Pressable
            disabled={Boolean(editEntryId)}
            onPress={() => setTab("custom")}
            style={({ pressed }) => ({
              ...tabButtonStyle(tab === "custom"),
              opacity: editEntryId ? (tab === "custom" ? 1 : 0.45) : pressed ? 0.85 : 1,
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
            <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "700", color: UI.textSecondary }}>
              TEMPLATE FOCUS (PILOT CATALOG)
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
              placeholder="Reference video URL (optional)"
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
            <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "700", color: UI.textSecondary }}>
              CUSTOM FOCUS (PILOT)
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
              <Text style={{ fontSize: 13, color: UI.textSecondary, fontWeight: "700" }}>NOTE (OPTIONAL)</Text>
              <TextInput
                value={customNote}
                onChangeText={setCustomNote}
                placeholder="Optional short note for this kid’s emphasis"
                placeholderTextColor={UI.textSecondary}
                multiline
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
              placeholder="Reference video URL (optional)"
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

