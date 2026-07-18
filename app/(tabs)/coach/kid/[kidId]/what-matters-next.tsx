import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getDefaultWhatMattersNextDraftGenerator } from "../../../../../src/ai-coach/whatMattersNextDraftGenerator";
import { loadWhatMattersNextDraftPayload } from "../../../../../src/ai-coach/loadWhatMattersNextDraftPayload";
import type { WhatMattersNextDraftResult } from "../../../../../src/ai-coach/whatMattersNextDraftTypes";
import { CoachVoiceNoteField } from "../../../../../src/features/coach/CoachVoiceNoteField";
import { getKidCurrentStateAssessment } from "../../../../../src/storage/kidCurrentStateAssessmentStore";
import {
  getKidStandingGuidance,
  saveKidStandingGuidance,
} from "../../../../../src/storage/kidStandingGuidanceStore";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  accent: "#1d4ed8",
  rowMutedBg: "#f9fafb",
};

const CARD_RADIUS = 16;

function collapseSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function excerptText(s: string, maxLength: number): string {
  const collapsed = collapseSpace(s);
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export default function WhatMattersNextScreen() {
  const params = useLocalSearchParams<{ kidId?: string }>();
  const kidId = params.kidId ? String(params.kidId) : "";

  const [ready, setReady] = useState(false);
  const [headlineDraft, setHeadlineDraft] = useState("");
  const [detailDraft, setDetailDraft] = useState("");
  const [currentStateNarrative, setCurrentStateNarrative] = useState("");
  const [saving, setSaving] = useState(false);

  const draftGenerator = useMemo(() => getDefaultWhatMattersNextDraftGenerator(), []);
  const [draftReviewOpen, setDraftReviewOpen] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftResult, setDraftResult] = useState<WhatMattersNextDraftResult | null>(null);

  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const keyboardAwareRef = useRef<InstanceType<typeof KeyboardAwareScrollView> | null>(null);

  const bumpScrollToFocusedInput = useCallback(() => {
    const run = () => {
      (keyboardAwareRef.current as { update?: () => void } | null)?.update?.();
    };
    requestAnimationFrame(run);
    setTimeout(run, 120);
    setTimeout(run, 340);
  }, []);

  const load = useCallback(async () => {
    if (!kidId) return;
    setReady(false);
    try {
      const [row, currentStateRow] = await Promise.all([
        getKidStandingGuidance(kidId),
        getKidCurrentStateAssessment(kidId),
      ]);
      setHeadlineDraft(row?.headline ?? "");
      setDetailDraft(row?.detail ?? "");
      setCurrentStateNarrative(currentStateRow?.narrative ?? "");
    } finally {
      setReady(true);
    }
  }, [kidId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!kidId) {
      Alert.alert("Missing kid id", "This pilot route requires a kid selection.");
      router.replace("/coach/kids");
    }
  }, [kidId]);

  useEffect(() => {
    if (Platform.OS === "ios") {
      const sub = Keyboard.addListener("keyboardWillChangeFrame", bumpScrollToFocusedInput);
      return () => sub.remove();
    }
    const sub = Keyboard.addListener("keyboardDidShow", bumpScrollToFocusedInput);
    return () => sub.remove();
  }, [bumpScrollToFocusedInput]);

  const runDraftGeneration = useCallback(async () => {
    if (!kidId) {
      setDraftError("Missing athlete — go back and select someone on your roster.");
      return;
    }
    setDraftLoading(true);
    setDraftError(null);
    setDraftResult(null);
    try {
      const payload = await loadWhatMattersNextDraftPayload(kidId, {
        headline: headlineDraft,
        detail: detailDraft,
      });
      if (!payload) {
        setDraftError("Could not load this athlete’s local data.");
        return;
      }
      const result = await draftGenerator.generateDraft(payload);
      setDraftResult(result);
    } catch (e) {
      const msg =
        e instanceof Error && e.message
          ? e.message
          : "Something went wrong while drafting. Nothing was saved.";
      setDraftError(msg);
    } finally {
      setDraftLoading(false);
    }
  }, [kidId, headlineDraft, detailDraft, draftGenerator]);

  const onHelpPhrase = useCallback(() => {
    setDraftReviewOpen(true);
    void runDraftGeneration();
  }, [runDraftGeneration]);

  const closeDraftReview = useCallback(() => {
    setDraftReviewOpen(false);
    setDraftError(null);
    setDraftResult(null);
  }, []);

  const onSave = useCallback(async () => {
    if (!kidId) {
      Alert.alert("Missing kid id", "Please go back and select a kid.");
      return;
    }
    setSaving(true);
    try {
      await saveKidStandingGuidance(kidId, {
        headline: headlineDraft,
        detail: detailDraft,
      });
      router.replace(`/coach/kid/${kidId}`);
    } finally {
      setSaving(false);
    }
  }, [kidId, headlineDraft, detailDraft]);

  const currentStateExcerpt = excerptText(currentStateNarrative, 320);

  return (
    <>
      <Stack.Screen options={{ title: "Direction of growth" }} />
      <KeyboardAwareScrollView
        ref={keyboardAwareRef}
        enableOnAndroid
        enableAutomaticScroll
        enableResetScrollToCoords={false}
        keyboardOpeningTime={120}
        viewIsInsideTabBar
        extraHeight={headerHeight + 16}
        extraScrollHeight={insets.bottom + 56}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        style={{ flex: 1, backgroundColor: UI.screenBg }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120 }}
      >
        <Pressable
          onPress={() => router.replace(`/coach/kid/${kidId}`)}
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
          <Text style={{ fontSize: 14, color: UI.textPrimary }}>Back</Text>
        </Pressable>

        <Text style={{ fontSize: 22, fontWeight: "800", color: UI.textPrimary, marginBottom: 8 }}>
          Direction of growth
        </Text>
        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
          Given what is true today, name the shift you are coaching toward.
        </Text>

        <View style={{ height: 14 }} />

        {currentStateExcerpt ? (
          <>
            <View
              style={{
                padding: 14,
                borderRadius: CARD_RADIUS,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: "#f8fafc",
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "800", color: UI.textPrimary }}>
                Current read
              </Text>
              <Text style={{ fontSize: 14, color: UI.textPrimary, lineHeight: 21 }}>
                {currentStateExcerpt}
              </Text>
              <Text style={{ fontSize: 12, color: UI.textSecondary, lineHeight: 17 }}>
                Use this as context only. Saving below updates the direction, not the assessment.
              </Text>
            </View>

            <View style={{ height: 14 }} />
          </>
        ) : null}

        <View
          style={{
            padding: 14,
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: "#f8fafc",
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "800", color: UI.textPrimary }}>
            Let AI help you write this
          </Text>
          <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 20 }}>
            The AI reads what you put in the two fields below, plus this kid’s weekly focus,
            recent check-ins, and competitions from this profile. It does not use raw video links
            or other athletes.
          </Text>
          <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 20 }}>
            It’s a draft only. Tap Help me phrase this to generate suggestions from this kid’s
            info—a quick way to save time. Edit as needed, then tap Save direction to keep it.
            Runs on your device; does not message parents.
          </Text>
        </View>

        <View style={{ height: 14 }} />

        <Pressable
          disabled={!ready || saving || draftLoading}
          onPress={onHelpPhrase}
          style={({ pressed }) => ({
            marginBottom: 16,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: pressed ? "#eef2ff" : UI.bgCard,
            opacity: !ready || saving || draftLoading ? 0.55 : 1,
            alignSelf: "flex-start",
          })}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: UI.textPrimary }}>
            Help me phrase this
          </Text>
        </Pressable>

        <View
          style={{
            padding: 16,
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
            gap: 14,
          }}
        >
          <View style={{ gap: 6 }}>
            <CoachVoiceNoteField
              label="Coaching direction"
              value={headlineDraft}
              onChangeText={setHeadlineDraft}
              onFocus={bumpScrollToFocusedInput}
              onContentSizeChange={bumpScrollToFocusedInput}
              placeholder="What shift are you guiding next?"
              scrollEnabled
              minHeight={88}
              maxHeight={152}
              disabled={!ready || saving || draftLoading}
            />
          </View>

          <View style={{ gap: 6 }}>
            <CoachVoiceNoteField
              label="Why this direction"
              value={detailDraft}
              onChangeText={setDetailDraft}
              onFocus={bumpScrollToFocusedInput}
              onContentSizeChange={bumpScrollToFocusedInput}
              placeholder="Connect the current read to the next coaching emphasis."
              scrollEnabled
              minHeight={88}
              maxHeight={152}
              disabled={!ready || saving || draftLoading}
            />
          </View>

          <Pressable
            disabled={saving || !ready}
            onPress={() => void onSave()}
            style={({ pressed }) => ({
              marginTop: 4,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.accent,
              backgroundColor: pressed ? UI.accent : UI.accent,
              opacity: saving || !ready ? 0.6 : 1,
              alignSelf: "flex-start",
            })}
          >
            <Text style={{ fontSize: 14, color: "#ffffff", fontWeight: "800" }}>
              Save direction
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>

      <Modal
        visible={draftReviewOpen}
        animationType="slide"
        transparent
        onRequestClose={closeDraftReview}
      >
        <Pressable
          onPress={closeDraftReview}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              maxHeight: "88%",
              backgroundColor: UI.bgCard,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 28,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: UI.textPrimary, marginBottom: 6 }}>
              Review draft
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: UI.textPrimary,
                lineHeight: 18,
                marginBottom: 8,
              }}
            >
              Based on this kid’s current profile data
            </Text>
            <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 18, marginBottom: 8 }}>
              Suggestions use what’s already in the app for this kid. This is a draft only—nothing
              saves until you do. Nothing here messages parents.
            </Text>
            <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 18, marginBottom: 14 }}>
              Apply the headline, detail, or both below. Then tap{" "}
              <Text style={{ fontWeight: "800", color: UI.textPrimary }}>Save direction</Text> on the
              main screen under this sheet to save it for this kid.
            </Text>

            {draftLoading ? (
              <View style={{ paddingVertical: 32, alignItems: "center", gap: 12 }}>
                <ActivityIndicator size="large" color={UI.accent} />
                <Text style={{ fontSize: 14, color: UI.textSecondary }}>Drafting…</Text>
              </View>
            ) : null}

            {draftError && !draftLoading ? (
              <View style={{ gap: 14, marginBottom: 12 }}>
                <Text style={{ fontSize: 14, color: "#b91c1c", lineHeight: 20 }}>{draftError}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  <Pressable
                    onPress={() => void runDraftGeneration()}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: UI.accent,
                      backgroundColor: pressed ? "#eef2ff" : UI.bgCard,
                    })}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "700", color: UI.accent }}>Try again</Text>
                  </Pressable>
                  <Pressable
                    onPress={closeDraftReview}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: UI.border,
                      backgroundColor: pressed ? UI.rowMutedBg : UI.bgCard,
                    })}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: UI.textPrimary }}>Close</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {draftResult && !draftLoading ? (
              <ScrollView
                style={{ maxHeight: 360 }}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 8, gap: 12 }}
              >
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: UI.textSecondary }}>
                    Coaching direction
                  </Text>
                  <Text style={{ fontSize: 15, color: UI.textPrimary, lineHeight: 22 }}>
                    {draftResult.suggestedHeadline || "—"}
                  </Text>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: UI.textSecondary }}>
                    Why this direction
                  </Text>
                  <Text style={{ fontSize: 15, color: UI.textPrimary, lineHeight: 22 }}>
                    {draftResult.suggestedDetail || "—"}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                  <Pressable
                    onPress={() => {
                      setHeadlineDraft(draftResult.suggestedHeadline);
                      closeDraftReview();
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: UI.accent,
                      backgroundColor: pressed ? "#eef2ff" : UI.bgCard,
                    })}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: UI.accent }}>
                      Apply headline only
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setDetailDraft(draftResult.suggestedDetail);
                      closeDraftReview();
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: UI.accent,
                      backgroundColor: pressed ? "#eef2ff" : UI.bgCard,
                    })}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: UI.accent }}>
                      Apply detail only
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setHeadlineDraft(draftResult.suggestedHeadline);
                      setDetailDraft(draftResult.suggestedDetail);
                      closeDraftReview();
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: UI.accent,
                      backgroundColor: pressed ? UI.accent : UI.accent,
                    })}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#ffffff" }}>Apply both</Text>
                  </Pressable>
                  <Pressable
                    onPress={closeDraftReview}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: UI.border,
                      backgroundColor: pressed ? UI.rowMutedBg : UI.bgCard,
                    })}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: UI.textPrimary }}>
                      Discard
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
