import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import {
  getAssignmentsById,
  getCoachLinks,
  getCoachesById,
  getCompletionReceiptsQueue,
  getCoachPilotPreviewItems,
  getPackEnrollments,
  getPacksById,
  setAssignmentsById as persistAssignmentsById,
  setCompletionReceiptsQueue as persistCompletionReceiptsQueue,
  setCoachPilotPreviewItems,
} from "../../../../src/storage/coachShareStore";
import type { CoachPilotPreviewItem } from "../../../../src/storage/coachShareStore";
import type {
  AssignmentMap,
  CoachIdentityMap,
  CoachLink,
  CompletionReceipt,
  PackEnrollment,
  ProgramPackMap,
} from "../../../../src/types/coachShare";

// Build 7 light visual system (matches training + profile)
const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  bgCardActive: "#edf2ff",
  bgHero: "#fffbf5",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  primaryFill: "#1d4ed8",
  primaryFillPressed: "#1e40af",
};
const CARD_RADIUS = 16;
const SECTION_LABEL = { fontSize: 11, letterSpacing: 1.2, color: "#6b7280", fontWeight: "600" as const };

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        marginTop: 18,
        padding: 18,
        borderRadius: CARD_RADIUS,
        borderWidth: 1,
        borderColor: UI.border,
        backgroundColor: UI.bgCard,
      }}
    >
      <Text style={[SECTION_LABEL, { marginBottom: 10 }]}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

const WEEKLY_STORY_STEP_COUNT = 5;

export default function CoachesScreen() {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [showDebugData, setShowDebugData] = useState(false);
  const [weeklyStoryOpen, setWeeklyStoryOpen] = useState(false);
  const [weeklyStoryStep, setWeeklyStoryStep] = useState(0);
  const [coachLinks, setCoachLinks] = useState<CoachLink[]>([]);
  const [coachesById, setCoachesById] = useState<CoachIdentityMap>({});
  const [packsById, setPacksById] = useState<ProgramPackMap>({});
  const [packEnrollments, setPackEnrollments] = useState<PackEnrollment[]>([]);
  const [assignmentsById, setAssignmentsById] = useState<AssignmentMap>({});
  const [completionReceiptsQueue, setCompletionReceiptsQueue] = useState<
    CompletionReceipt[]
  >([]);
  const [pilotPreviewItems, setPilotPreviewItemsState] = useState<CoachPilotPreviewItem[]>([]);

  const loadCoachShareData = useCallback(async () => {
    setReady(false);

    const [
      loadedCoachLinks,
      loadedCoachesById,
      loadedPacksById,
      loadedPackEnrollments,
      loadedAssignmentsById,
      loadedCompletionReceiptsQueue,
      loadedPilotPreviewItems,
    ] = await Promise.all([
      getCoachLinks(),
      getCoachesById(),
      getPacksById(),
      getPackEnrollments(),
      getAssignmentsById(),
      getCompletionReceiptsQueue(),
      getCoachPilotPreviewItems(),
    ]);

    setCoachLinks(loadedCoachLinks);
    setCoachesById(loadedCoachesById);
    setPacksById(loadedPacksById);
    setPackEnrollments(loadedPackEnrollments);
    setAssignmentsById(loadedAssignmentsById);
    setCompletionReceiptsQueue(loadedCompletionReceiptsQueue);
    setPilotPreviewItemsState(loadedPilotPreviewItems);
    setReady(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCoachShareData();
    }, [loadCoachShareData]),
  );
  const allCoaches = Object.values(coachesById);
  const allPacks = Object.values(packsById);
  const allAssignments = Object.values(assignmentsById);

  const firstCoach = allCoaches[0];
  const firstPack = allPacks[0];

  const assignedAssignments = allAssignments.filter(
    (assignment) => assignment.status === "assigned",
  );
  const currentAssignment = assignedAssignments[0] ?? allAssignments[0];

  const currentCoachFromAssignment = currentAssignment
    ? coachesById[currentAssignment.coachId]
    : undefined;
  const currentCoach = currentCoachFromAssignment ?? firstCoach;

  const currentPackFromAssignment = currentAssignment
    ? packsById[currentAssignment.packId]
    : undefined;
  const currentPack = currentPackFromAssignment ?? firstPack;

  const currentModule =
    currentAssignment && currentPack?.modules
      ? currentPack.modules.find(
          (module) => module.id === currentAssignment.moduleId,
        )
      : undefined;

  const currentAssignmentAssignedDate =
    currentAssignment && currentAssignment.assignedAt
      ? new Date(currentAssignment.assignedAt)
      : undefined;

  const completedCurrentAssignment =
    currentAssignment?.status === "completed" ? currentAssignment : undefined;

  const latestCompletionReceipt =
    completionReceiptsQueue.length > 0
      ? completionReceiptsQueue[completionReceiptsQueue.length - 1]
      : undefined;

  const completionSourceAssignment =
    completedCurrentAssignment ??
    (latestCompletionReceipt
      ? assignmentsById[latestCompletionReceipt.assignmentId]
      : undefined);

  const completionCompletedAtIso =
    completedCurrentAssignment?.completedAt ??
    latestCompletionReceipt?.completedAt ??
    completionSourceAssignment?.completedAt;

  const completionCompletedAtDate = completionCompletedAtIso
    ? new Date(completionCompletedAtIso)
    : undefined;

  const completionPack =
    completionSourceAssignment && packsById[completionSourceAssignment.packId]
      ? packsById[completionSourceAssignment.packId]
      : undefined;

  const completionModule =
    completionSourceAssignment && completionPack?.modules
      ? completionPack.modules.find(
          (module) => module.id === completionSourceAssignment.moduleId,
        )
      : undefined;

  const completionAssignmentTitle =
    completionSourceAssignment?.title ??
    currentAssignment?.title ??
    "Assignment completed";

  const hasCompletionSummary =
    Boolean(completedCurrentAssignment) || Boolean(latestCompletionReceipt);

  const handleMarkCurrentAssignmentComplete = useCallback(async () => {
    if (!currentAssignment || currentAssignment.status !== "assigned") {
      return;
    }

    const nowIso = new Date().toISOString();

    const updatedAssignment = {
      ...currentAssignment,
      status: "completed" as const,
      completedAt: nowIso,
    };

    const updatedAssignmentsById: AssignmentMap = {
      ...assignmentsById,
      [currentAssignment.id]: updatedAssignment,
    };

    const newReceipt: CompletionReceipt = {
      id: `local-${Date.now()}`,
      assignmentId: currentAssignment.id,
      enrollmentId: currentAssignment.enrollmentId,
      packId: currentAssignment.packId,
      moduleId: currentAssignment.moduleId,
      coachId: currentAssignment.coachId,
      parentProfileId: currentAssignment.parentProfileId,
      completedAt: nowIso,
    };

    const updatedCompletionReceiptsQueue = [
      ...completionReceiptsQueue,
      newReceipt,
    ];

    await Promise.all([
      persistAssignmentsById(updatedAssignmentsById),
      persistCompletionReceiptsQueue(updatedCompletionReceiptsQueue),
    ]);

    setAssignmentsById(updatedAssignmentsById);
    setCompletionReceiptsQueue(updatedCompletionReceiptsQueue);
  }, [assignmentsById, completionReceiptsQueue, currentAssignment]);

  const cardButtonStyle = (pressed: boolean): { marginTop: number; paddingVertical: number; paddingHorizontal: number; borderRadius: number; borderWidth: number; borderColor: string; backgroundColor: string; alignSelf: "flex-start" } => ({
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
    alignSelf: "flex-start",
  });

  const handleRemovePilotPreviewItem = useCallback(
    async (id: string) => {
      const updated = pilotPreviewItems.filter((item) => item.id !== id);
      await setCoachPilotPreviewItems(updated);
      setPilotPreviewItemsState(updated);
    },
    [pilotPreviewItems],
  );

  const isUsableYoutubeUrl = (raw?: string) => {
    if (!raw) return false;
    const trimmed = raw.trim();
    if (!trimmed) return false;
    const hasProtocol =
      trimmed.startsWith("http://") || trimmed.startsWith("https://");
    const candidate = hasProtocol ? trimmed : `https://${trimmed}`;
    const lower = candidate.toLowerCase();

    const looksLikeYoutube =
      lower.includes("youtube.com") || lower.includes("youtu.be");
    const looksLikeInstagram =
      lower.includes("instagram.com") || lower.includes("instagr.am");

    return looksLikeYoutube || looksLikeInstagram;
  };

  const openYoutubeUrl = useCallback(async (rawUrl: string | undefined) => {
    if (!isUsableYoutubeUrl(rawUrl)) {
      return;
    }

    const trimmed = rawUrl!.trim();

    const normalized =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;

    try {
      const canOpen = await Linking.canOpenURL(normalized);
      if (!canOpen) {
        Alert.alert(
          "Unable to open link",
          "This reference link cannot be opened on this device.",
        );
        return;
      }

      await Linking.openURL(normalized);
    } catch {
      Alert.alert(
        "Unable to open link",
        "Something went wrong opening this reference link.",
      );
    }
  }, []);

  const activeCoachLinks = coachLinks.filter((link) => link.status === "active");
  const isLinked = activeCoachLinks.length > 0;
  const hasCoachPilotPreviewOnDevice = pilotPreviewItems.length > 0;
  const hasSeededOrLocalShareData =
    !isLinked &&
    (allAssignments.length > 0 ||
      allPacks.length > 0 ||
      allCoaches.length > 0);
  const isPreviewOnlyOnDevice =
    !isLinked && (hasCoachPilotPreviewOnDevice || hasSeededOrLocalShareData);

  const focusTitle =
    currentAssignment?.title ??
    (isLinked
      ? "Your coach hasn’t shared a new focus yet"
      : "Connect to see this week’s focus");
  const focusNotes =
    currentAssignment?.notes ??
    (isLinked
      ? "When they post an update, it will show up here for your family."
      : "Use your invite code to link this phone to your academy. What you see before then stays on this device only.");

  const assignmentStatusLine =
    !currentAssignment || !isLinked
      ? null
      : currentAssignment.status === "assigned"
        ? currentAssignmentAssignedDate
          ? `Shared ${currentAssignmentAssignedDate.toLocaleDateString()}`
          : "Shared by your coach"
        : currentAssignment.status === "completed"
          ? "Marked done at home (saved on this phone)"
          : null;

  const showCoachPilotUi = __DEV__ && showDebugData;

  const weeklyStoryConnectionLabel = isLinked
    ? "Linked to your coach"
    : isPreviewOnlyOnDevice
      ? "On this phone only — not linked yet"
      : "Not linked yet";

  const weeklyStoryConnectionBody = isLinked
    ? "Updates you see here come from your coach through this link. If something looks off, you can refresh or adjust the link from the main screen."
    : isPreviewOnlyOnDevice
      ? hasCoachPilotPreviewOnDevice
        ? "Coach pilot previews on this phone are not shared with families until you connect with a real invite."
        : "Sample or local data on this phone only — connect to use your coach’s real weekly note."
      : "You’re not linked yet. What you see before connecting stays on this device only.";

  const weeklyStoryPrimaryHint =
    isLinked && currentAssignment?.status === "assigned"
      ? "When you’re ready, use Log practice for this week on the screen behind this."
      : !isLinked
        ? "When you’re ready, use Connect with your coach on the screen behind this."
        : "When you’re ready, use Refresh this week’s update on the screen behind this.";

  const closeWeeklyStory = useCallback(() => {
    setWeeklyStoryOpen(false);
    setWeeklyStoryStep(0);
  }, []);

  const openWeeklyStory = useCallback(() => {
    setWeeklyStoryStep(0);
    setWeeklyStoryOpen(true);
  }, []);

  const weeklyStoryClassBody =
    currentModule?.title || (isLinked && currentPack?.title)
      ? [
          currentModule?.title
            ? `In class, look for: ${currentModule.title}${
                currentModule.summary ? ` — ${currentModule.summary}` : ""
              }`
            : null,
          isLinked && currentPack?.title
            ? `Program: ${currentPack.title}${
                currentPack.description ? ` · ${currentPack.description}` : ""
              }`
            : null,
        ]
          .filter(Boolean)
          .join("\n\n")
      : "No extra class or program line on this note right now — that’s okay.";

  return (
    <>
      <Stack.Screen options={{ title: "This week" }} />
      <Modal
        visible={weeklyStoryOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={closeWeeklyStory}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: UI.screenBg,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 16,
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                fontWeight: "600",
                color: UI.textSecondary,
                letterSpacing: 0.4,
              }}
            >
              Read together · {weeklyStoryStep + 1} of {WEEKLY_STORY_STEP_COUNT}
            </Text>
            <Pressable
              onPress={closeWeeklyStory}
              accessibilityRole="button"
              accessibilityLabel="Close story"
              hitSlop={8}
              style={({ pressed }) => ({
                paddingVertical: 6,
                paddingHorizontal: 4,
                marginRight: -4,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: UI.primaryFill,
                }}
              >
                Close
              </Text>
            </Pressable>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            {weeklyStoryStep === 0 ? (
              <>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "700",
                    color: UI.textPrimary,
                    lineHeight: 32,
                    marginBottom: 12,
                  }}
                >
                  A few calm screens
                </Text>
                <Text style={{ fontSize: 16, color: UI.textSecondary, lineHeight: 24 }}>
                  This is the same weekly note as on the screen behind you — just spaced out so you can read it together. Tap Next when everyone is ready; tap Back anytime.
                </Text>
              </>
            ) : null}

            {weeklyStoryStep === 1 ? (
              <>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "700",
                    color: UI.textPrimary,
                    lineHeight: 32,
                    marginBottom: 14,
                  }}
                >
                  How this phone is set up
                </Text>
                <View
                  style={{
                    alignSelf: "flex-start",
                    marginBottom: 14,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: isLinked
                      ? "#dcfce7"
                      : isPreviewOnlyOnDevice
                        ? "#fef3c7"
                        : "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: isLinked
                        ? "#166534"
                        : isPreviewOnlyOnDevice
                          ? "#92400e"
                          : UI.textSecondary,
                    }}
                  >
                    {weeklyStoryConnectionLabel}
                  </Text>
                </View>
                <Text style={{ fontSize: 16, color: UI.textSecondary, lineHeight: 24 }}>
                  {weeklyStoryConnectionBody}
                </Text>
              </>
            ) : null}

            {weeklyStoryStep === 2 ? (
              <>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    letterSpacing: 1,
                    color: "#78716c",
                    marginBottom: 8,
                  }}
                >
                  THIS WEEK&apos;S FOCUS
                </Text>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "700",
                    color: UI.textPrimary,
                    lineHeight: 30,
                    marginBottom: 12,
                  }}
                >
                  {focusTitle}
                </Text>
                <Text style={{ fontSize: 16, color: UI.textSecondary, lineHeight: 24 }}>
                  {focusNotes}
                </Text>
                {isLinked && currentCoach ? (
                  <Text style={{ marginTop: 16, fontSize: 15, color: UI.textSecondary, lineHeight: 22 }}>
                    From{" "}
                    <Text style={{ fontWeight: "700", color: UI.textPrimary }}>
                      {currentCoach.displayName}
                    </Text>
                    {currentCoach.academyName ? (
                      <>
                        {" "}
                        at {currentCoach.academyName}
                      </>
                    ) : null}
                  </Text>
                ) : null}
                {assignmentStatusLine ? (
                  <Text style={{ marginTop: 12, fontSize: 14, color: UI.textSecondary }}>
                    {assignmentStatusLine}
                  </Text>
                ) : null}
              </>
            ) : null}

            {weeklyStoryStep === 3 ? (
              <>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "700",
                    color: UI.textPrimary,
                    lineHeight: 32,
                    marginBottom: 12,
                  }}
                >
                  Class and program
                </Text>
                <Text style={{ fontSize: 16, color: UI.textSecondary, lineHeight: 24 }}>
                  {weeklyStoryClassBody}
                </Text>
              </>
            ) : null}

            {weeklyStoryStep === 4 ? (
              <>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "700",
                    color: UI.textPrimary,
                    lineHeight: 32,
                    marginBottom: 12,
                  }}
                >
                  You&apos;re all caught up
                </Text>
                <Text style={{ fontSize: 16, color: UI.textSecondary, lineHeight: 24, marginBottom: 16 }}>
                  That&apos;s everything on this week&apos;s coach note. There isn&apos;t another page to scroll to — you can close this when you&apos;re ready.
                </Text>
                <Text style={{ fontSize: 16, color: UI.textSecondary, lineHeight: 24 }}>
                  {weeklyStoryPrimaryHint}
                </Text>
              </>
            ) : null}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            {weeklyStoryStep > 0 ? (
              <Pressable
                onPress={() => setWeeklyStoryStep((s) => Math.max(0, s - 1))}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: CARD_RADIUS,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
                  alignItems: "center",
                })}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: UI.textPrimary }}>Back</Text>
              </Pressable>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            {weeklyStoryStep < WEEKLY_STORY_STEP_COUNT - 1 ? (
              <Pressable
                onPress={() =>
                  setWeeklyStoryStep((s) =>
                    Math.min(WEEKLY_STORY_STEP_COUNT - 1, s + 1),
                  )
                }
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: CARD_RADIUS,
                  backgroundColor: pressed ? UI.primaryFillPressed : UI.primaryFill,
                  alignItems: "center",
                })}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>Next</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={closeWeeklyStory}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: CARD_RADIUS,
                  backgroundColor: pressed ? UI.primaryFillPressed : UI.primaryFill,
                  alignItems: "center",
                })}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>Done</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
      <KeyboardAwareScrollView
        enableOnAndroid
        extraScrollHeight={80}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: UI.screenBg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <Text
          onLongPress={
            __DEV__ ? () => setShowDebugData((prev) => !prev) : undefined
          }
          style={{ fontSize: 26, fontWeight: "700", color: UI.textPrimary, marginBottom: 6 }}
        >
          This week together
        </Text>
        <Text style={{ fontSize: 15, color: UI.textSecondary, lineHeight: 22, marginBottom: 4 }}>
          A simple weekly note from your coach so class and practice line up.
        </Text>
        {__DEV__ ? (
          <Text style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>
            Dev: long-press the title to show coach pilot tools.
          </Text>
        ) : (
          <View style={{ height: 14 }} />
        )}

        {!ready ? (
          <Text style={{ marginTop: 4, fontSize: 15, color: UI.textSecondary }}>
            Loading…
          </Text>
        ) : (
          <>
            <View
              style={{
                padding: 20,
                borderRadius: CARD_RADIUS,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgHero,
              }}
            >
              <View
                style={{
                  alignSelf: "flex-start",
                  marginBottom: 14,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: isLinked ? "#dcfce7" : isPreviewOnlyOnDevice ? "#fef3c7" : "#f3f4f6",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: isLinked ? "#166534" : isPreviewOnlyOnDevice ? "#92400e" : UI.textSecondary,
                  }}
                >
                  {isLinked
                    ? "Linked to your coach"
                    : isPreviewOnlyOnDevice
                      ? "On this phone only — not linked yet"
                      : "Not linked yet"}
                </Text>
              </View>

              <Text style={[SECTION_LABEL, { marginBottom: 8, color: "#78716c" }]}>
                THIS WEEK&apos;S FOCUS
              </Text>
              <Text style={{ fontSize: 20, fontWeight: "700", color: UI.textPrimary, lineHeight: 28 }}>
                {focusTitle}
              </Text>
              <Text style={{ marginTop: 10, fontSize: 15, color: UI.textSecondary, lineHeight: 23 }}>
                {focusNotes}
              </Text>

              {isLinked && currentCoach ? (
                <Text style={{ marginTop: 16, fontSize: 14, color: UI.textSecondary, lineHeight: 21 }}>
                  From{" "}
                  <Text style={{ fontWeight: "700", color: UI.textPrimary }}>
                    {currentCoach.displayName}
                  </Text>
                  {currentCoach.academyName ? (
                    <>
                      {" "}
                      at {currentCoach.academyName}
                    </>
                  ) : null}
                </Text>
              ) : null}

              {currentModule?.title ? (
                <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: UI.border }}>
                  <Text style={{ fontSize: 13, color: UI.textSecondary, lineHeight: 20 }}>
                    <Text style={{ fontWeight: "700", color: UI.textPrimary }}>In class, look for: </Text>
                    {currentModule.title}
                    {currentModule.summary ? ` — ${currentModule.summary}` : ""}
                  </Text>
                </View>
              ) : null}

              {currentPack?.title && isLinked ? (
                <Text style={{ marginTop: 10, fontSize: 13, color: UI.textSecondary }}>
                  Program: <Text style={{ fontWeight: "600", color: UI.textPrimary }}>{currentPack.title}</Text>
                  {currentPack.description ? ` · ${currentPack.description}` : ""}
                </Text>
              ) : null}

              {assignmentStatusLine ? (
                <Text style={{ marginTop: 10, fontSize: 13, color: UI.textSecondary }}>
                  {assignmentStatusLine}
                </Text>
              ) : null}

              {!isLinked && hasCoachPilotPreviewOnDevice ? (
                <Text style={{ marginTop: 12, fontSize: 13, color: "#92400e", lineHeight: 19 }}>
                  Coach pilot previews on this phone are not shared with families until you connect with a real invite.
                </Text>
              ) : null}

              {!isLinked && hasSeededOrLocalShareData && !hasCoachPilotPreviewOnDevice ? (
                <Text style={{ marginTop: 12, fontSize: 13, color: "#92400e", lineHeight: 19 }}>
                  Sample or local data on this phone only — connect to use your coach’s real weekly note.
                </Text>
              ) : null}

              <Pressable
                onPress={openWeeklyStory}
                style={({ pressed }) => ({
                  marginTop: 16,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: CARD_RADIUS,
                  borderWidth: 1,
                  borderColor: UI.border,
                  backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
                  alignSelf: "stretch",
                  alignItems: "center",
                })}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: UI.textPrimary }}>
                  Read together
                </Text>
                <Text style={{ marginTop: 4, fontSize: 13, color: UI.textSecondary, textAlign: "center" }}>
                  Walk through this week&apos;s note tap by tap — same words, calmer pace.
                </Text>
              </Pressable>

              {isLinked && currentAssignment?.status === "assigned" ? (
                <Pressable
                  onPress={() => void handleMarkCurrentAssignmentComplete()}
                  style={({ pressed }) => ({
                    marginTop: 18,
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderRadius: CARD_RADIUS,
                    backgroundColor: pressed ? UI.primaryFillPressed : UI.primaryFill,
                    alignSelf: "stretch",
                    alignItems: "center",
                  })}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                    Log practice for this week
                  </Text>
                </Pressable>
              ) : !isLinked ? (
                <Pressable
                  onPress={() => router.push("/profile/coaches/join")}
                  style={({ pressed }) => ({
                    marginTop: 18,
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderRadius: CARD_RADIUS,
                    backgroundColor: pressed ? UI.primaryFillPressed : UI.primaryFill,
                    alignSelf: "stretch",
                    alignItems: "center",
                  })}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                    Connect with your coach
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => void loadCoachShareData()}
                  style={({ pressed }) => ({
                    marginTop: 18,
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderRadius: CARD_RADIUS,
                    backgroundColor: pressed ? UI.primaryFillPressed : UI.primaryFill,
                    alignSelf: "stretch",
                    alignItems: "center",
                  })}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                    Refresh this week’s update
                  </Text>
                </Pressable>
              )}

              {isLinked ? (
                <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                  <Pressable onPress={() => router.push("/profile/coaches/manage")}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: UI.primaryFill }}>
                      Manage coach link
                    </Text>
                  </Pressable>
                  {currentAssignment?.status === "assigned" ? (
                    <Pressable onPress={() => void loadCoachShareData()}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: UI.primaryFill }}>
                        Refresh
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>

            {isLinked && hasCompletionSummary ? (
              <Section title="Nice work">
                <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 4, color: UI.textPrimary }}>
                  {completionAssignmentTitle}
                </Text>
                {completionPack || completionModule ? (
                  <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
                    {completionModule?.title
                      ? `${completionModule.title}${
                          completionPack?.title
                            ? ` · ${completionPack.title}`
                            : ""
                        }`
                      : completionPack?.title}
                  </Text>
                ) : null}
                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontSize: 14, color: UI.textSecondary }}>
                    Logged:{" "}
                    <Text style={{ fontWeight: "500", color: UI.textPrimary }}>
                      {completionCompletedAtDate
                        ? completionCompletedAtDate.toLocaleDateString()
                        : "—"}
                    </Text>
                  </Text>
                  <Text style={{ fontSize: 14, marginTop: 2, color: UI.textSecondary }}>
                    Saved on this phone for now
                  </Text>
                </View>
              </Section>
            ) : null}

            {showCoachPilotUi ? (
              <>
                <Section title="Coach Tools (pilot)">
                  <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
                    Internal pilot (coach-side). Hidden from families unless dev debug is on.
                  </Text>
                  <Pressable
                    onPress={() => router.push("/profile/coaches/kids")}
                    style={({ pressed }) => cardButtonStyle(pressed)}
                  >
                    <Text style={{ fontSize: 16, color: UI.textPrimary, fontWeight: "700" }}>
                      Kids (Pilot)
                    </Text>
                    <Text style={{ marginTop: 4, fontSize: 13, color: UI.textSecondary }}>
                      Roster + kid-specific weekly focus
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push("/profile/coaches/create-pack")}
                    style={({ pressed }) => cardButtonStyle(pressed)}
                  >
                    <Text style={{ fontSize: 15, color: UI.textSecondary, fontWeight: "600" }}>
                      Template Preview (Coach Pilot)
                    </Text>
                    <Text style={{ marginTop: 4, fontSize: 12, color: UI.textSecondary }}>
                      Coach-side preview only; use Kids (Pilot) for kid weekly focus.
                    </Text>
                  </Pressable>
                </Section>

                {pilotPreviewItems.length > 0 ? (
                  <Section title="Coach Pilot Preview">
                    <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
                      Internal pilot preview (coach-side). This does not assign or publish anything to families.
                    </Text>

                    <View style={{ marginTop: 12, gap: 10 }}>
                      {pilotPreviewItems.slice(0, 3).map((item) => {
                        const label = item.type === "template" ? "TEMPLATE" : "CUSTOM";
                        const meta = item.type === "template" ? item.metadata : item.note;
                        return (
                          <View
                            key={item.id}
                            style={{
                              padding: 12,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: UI.border,
                              backgroundColor: UI.bgCard,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                color: UI.textSecondary,
                                letterSpacing: 0.6,
                                fontWeight: "600",
                              }}
                            >
                              {label}
                            </Text>
                            <Text
                              style={{
                                fontSize: 16,
                                fontWeight: "700",
                                marginTop: 6,
                                color: UI.textPrimary,
                              }}
                            >
                              {item.title}
                            </Text>
                            {meta ? (
                              <Text
                                style={{
                                  fontSize: 14,
                                  color: UI.textSecondary,
                                  marginTop: 6,
                                  lineHeight: 20,
                                }}
                              >
                                {meta}
                              </Text>
                            ) : null}
                            <View
                              style={{
                                marginTop: 10,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <Text style={{ fontSize: 12, color: UI.textSecondary }}>
                                Added:{" "}
                                <Text style={{ fontWeight: "500", color: UI.textPrimary }}>
                                  {new Date(item.createdAt).toLocaleDateString()}
                                </Text>
                              </Text>
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                {isUsableYoutubeUrl(item.youtubeUrl) ? (
                                  <Pressable
                                    onPress={() => void openYoutubeUrl(item.youtubeUrl)}
                                    style={({ pressed }) => ({
                                      paddingVertical: 6,
                                      paddingHorizontal: 10,
                                      borderRadius: 999,
                                      borderWidth: 1,
                                      borderColor: UI.border,
                                      backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
                                    })}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 11,
                                        fontWeight: "700",
                                        color: UI.textPrimary,
                                      }}
                                    >
                                      YT
                                    </Text>
                                  </Pressable>
                                ) : null}
                                <Pressable
                                  onPress={() => void handleRemovePilotPreviewItem(item.id)}
                                  style={({ pressed }) => ({
                                    paddingVertical: 6,
                                    paddingHorizontal: 10,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: UI.border,
                                    backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
                                  })}
                                >
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      color: UI.textPrimary,
                                      fontWeight: "600",
                                    }}
                                  >
                                    Remove
                                  </Text>
                                </Pressable>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                      <Text style={{ fontSize: 12, color: UI.textSecondary }}>
                        {pilotPreviewItems.length}/3 items saved
                      </Text>
                    </View>

                    <View style={{ marginTop: 14, gap: 10 }}>
                      <Pressable
                        onPress={() => router.push("/profile/coaches/custom-focus")}
                        style={({ pressed }) => ({
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                          borderRadius: CARD_RADIUS,
                          borderWidth: 1,
                          borderColor: UI.border,
                          backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
                          alignSelf: "flex-start",
                        })}
                      >
                        <Text style={{ fontSize: 15, color: UI.textPrimary, fontWeight: "700" }}>
                          Add Custom Focus
                        </Text>
                        <Text style={{ marginTop: 4, fontSize: 12, color: UI.textSecondary }}>
                          Title required. Optional short note. Internal pilot preview only.
                        </Text>
                      </Pressable>
                    </View>
                  </Section>
                ) : (
                  <Section title="Coach Pilot Preview">
                    <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
                      Internal pilot preview (coach-side). This does not assign or publish anything to families.
                    </Text>
                    <Text style={{ marginTop: 10, fontSize: 14, color: UI.textSecondary }}>
                      No preview items yet. Add a template from Coach Tools or add a custom focus.
                    </Text>
                  </Section>
                )}

                <Section title="Debug Data">
                  <Text style={{ fontSize: 14, color: UI.textSecondary }}>Links: {coachLinks.length}</Text>
                  <Text style={{ fontSize: 14, color: UI.textSecondary }}>
                    Coaches: {Object.keys(coachesById).length}
                  </Text>
                  <Text style={{ fontSize: 14, color: UI.textSecondary }}>
                    Packs: {Object.keys(packsById).length}
                  </Text>
                  <Text style={{ fontSize: 14, color: UI.textSecondary }}>
                    Enrollments: {packEnrollments.length}
                  </Text>
                  <Text style={{ fontSize: 14, color: UI.textSecondary }}>
                    Assignments: {Object.keys(assignmentsById).length}
                  </Text>
                  <Text style={{ fontSize: 14, color: UI.textSecondary }}>
                    Receipt queue: {completionReceiptsQueue.length}
                  </Text>
                  <Text style={{ fontSize: 14, color: UI.textSecondary }}>
                    Pilot preview items: {pilotPreviewItems.length}
                  </Text>
                </Section>
              </>
            ) : null}
          </>
        )}
      </KeyboardAwareScrollView>
    </>
  );
}
