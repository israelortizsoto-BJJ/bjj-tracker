import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
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
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
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

export default function CoachesScreen() {
  const [ready, setReady] = useState(false);
  const [showDebugData, setShowDebugData] = useState(false);
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

  const currentModulePosition =
    currentModule && currentPack?.modules
      ? currentPack.modules.findIndex((module) => module.id === currentModule.id) +
        1
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

  return (
    <>
      <Stack.Screen options={{ title: "Coaches & Programs" }} />
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
          style={{ fontSize: 24, fontWeight: "700", color: UI.textPrimary, marginBottom: 8 }}
        >
          Coach Share
        </Text>
        <Section title="What Coach Share is">
          <Text style={{ fontSize: 15, color: UI.textPrimary, lineHeight: 22, fontWeight: "600" }}>
            Stay aligned on the current focus so 1:1 lessons carry over more clearly into regular training.
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
            Coach Share helps parents understand what the coach is emphasizing so kids can recognize and apply that focus during regular class and throughout the training week.
          </Text>
        </Section>

        {!ready ? (
          <Text style={{ marginTop: 18, fontSize: 15, color: UI.textSecondary }}>
            Loading Coach Share data…
          </Text>
        ) : (
          <>
            <Section title="Current Focus This Week">
              {coachLinks.length === 0 ? (
                <>
                  {pilotPreviewItems.length > 0 ? (
                    <>
                      <Text style={{ fontSize: 15, marginBottom: 6, color: UI.textPrimary, fontWeight: "600" }}>
                        No family-facing coach/program connected yet.
                      </Text>
                      <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
                        Coach-side pilot preview items are saved below, but they are not assigned or published to families.
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontSize: 15, marginBottom: 6, color: UI.textPrimary, fontWeight: "600" }}>
                        No coach/program connected yet.
                      </Text>
                      <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
                        Once you join, you&apos;ll see the coach&apos;s current weekly focus, what to watch for in regular class, and recent completions.
                      </Text>
                      <Text style={{ marginTop: 10, fontSize: 13, color: UI.textSecondary, lineHeight: 20 }}>
                        For local preview, you can seed demo data from Developer Settings.
                      </Text>
                    </>
                  )}
                </>
              ) : (
                <View style={{ gap: 14 }}>
                  <View>
                    <Text style={{ fontSize: 12, color: UI.textSecondary, letterSpacing: 0.6, fontWeight: "600" }}>
                      CURRENT COACH
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: "700", marginTop: 6, color: UI.textPrimary }}>
                      {currentCoach?.displayName ?? "—"}
                    </Text>
                    <Text style={{ fontSize: 14, color: UI.textSecondary, marginTop: 2 }}>
                      {currentCoach?.academyName ?? "—"}
                    </Text>
                  </View>

                  <View style={{ height: 1, backgroundColor: UI.border }} />

                  <View>
                    <Text style={{ fontSize: 12, color: UI.textSecondary, letterSpacing: 0.6, fontWeight: "600" }}>
                      THIS WEEK&apos;S FOCUS
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: "700", marginTop: 6, color: UI.textPrimary }}>
                      {currentAssignment?.title ?? "No active focus yet"}
                    </Text>
                    <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22, marginTop: 6 }}>
                      {currentAssignment?.notes ??
                        "Your coach&apos;s focus details will appear here."}
                    </Text>
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ fontSize: 14, color: UI.textSecondary }}>
                        Status:{" "}
                        <Text style={{ fontWeight: "600", color: UI.textPrimary }}>
                          {currentAssignment?.status ?? "—"}
                        </Text>
                      </Text>
                      <Text style={{ fontSize: 14, marginTop: 2, color: UI.textSecondary }}>
                        Assigned:{" "}
                        <Text style={{ fontWeight: "600", color: UI.textPrimary }}>
                          {currentAssignmentAssignedDate
                            ? currentAssignmentAssignedDate.toLocaleDateString()
                            : "—"}
                        </Text>
                      </Text>
                    </View>
                    {currentAssignment?.status === "assigned" ? (
                      <Pressable
                        onPress={() => void handleMarkCurrentAssignmentComplete()}
                        style={({ pressed }) => ({
                          marginTop: 12,
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          borderRadius: CARD_RADIUS,
                          borderWidth: 1,
                          borderColor: UI.border,
                          backgroundColor: pressed ? UI.bgCardActive : UI.bgCard,
                          alignSelf: "flex-start",
                        })}
                      >
                        <Text style={{ fontSize: 14, fontWeight: "700", color: UI.textPrimary }}>
                          Mark Complete
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={{ height: 1, backgroundColor: UI.border }} />

                  <View>
                    <Text style={{ fontSize: 12, color: UI.textSecondary, letterSpacing: 0.6, fontWeight: "600" }}>
                      FOCUS AREA
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: "700", marginTop: 6, color: UI.textPrimary }}>
                      {currentModule?.title ?? "No specific focus area selected"}
                    </Text>
                    <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22, marginTop: 6 }}>
                      {currentModule?.summary ??
                        "When your coach assigns a focus area, it will show here so you can spot it during regular class this week."}
                    </Text>
                    {currentModulePosition ? (
                      <Text style={{ fontSize: 14, marginTop: 10, color: UI.textSecondary }}>
                        Position in program:{" "}
                        <Text style={{ fontWeight: "600", color: UI.textPrimary }}>
                          {currentModulePosition}
                        </Text>
                      </Text>
                    ) : null}
                  </View>

                  <View style={{ height: 1, backgroundColor: UI.border }} />

                  <View>
                    <Text style={{ fontSize: 12, color: UI.textSecondary, letterSpacing: 0.6, fontWeight: "600" }}>
                      CURRENT TRAINING PLAN
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: "700", marginTop: 6, color: UI.textPrimary }}>
                      {currentPack?.title ?? "—"}
                    </Text>
                    <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22, marginTop: 6 }}>
                      {currentPack?.description ?? "Your coach’s current program details will appear here."}
                    </Text>
                    <Text style={{ fontSize: 14, marginTop: 10, color: UI.textSecondary }}>
                      Modules:{" "}
                      <Text style={{ fontWeight: "600", color: UI.textPrimary }}>
                        {currentPack?.modules.length ?? 0}
                      </Text>
                    </Text>
                  </View>
                </View>
              )}
            </Section>

            <Section title="Parent Actions">
              <Pressable
                onPress={() => router.push("/profile/coaches/join")}
                style={({ pressed }) => cardButtonStyle(pressed)}
              >
                <Text style={{ fontSize: 16, color: UI.textPrimary, fontWeight: "700" }}>Join Coach / Program</Text>
                <Text style={{ marginTop: 4, fontSize: 13, color: UI.textSecondary }}>
                  Connect with a coach using an invite code
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.push("/profile/coaches/manage")}
                style={({ pressed }) => cardButtonStyle(pressed)}
              >
                <Text style={{ fontSize: 16, color: UI.textPrimary, fontWeight: "700" }}>Manage Coach Link</Text>
                <Text style={{ marginTop: 4, fontSize: 13, color: UI.textSecondary }}>
                  Review who&apos;s linked and revoke access if needed
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void loadCoachShareData()}
                style={({ pressed }) => cardButtonStyle(pressed)}
              >
                <Text style={{ fontSize: 16, color: UI.textPrimary, fontWeight: "700" }}>Refresh Coach Share</Text>
                <Text style={{ marginTop: 4, fontSize: 13, color: UI.textSecondary }}>
                  Refresh the current focus and completion status
                </Text>
              </Pressable>
            </Section>

            {coachLinks.length > 0 && hasCompletionSummary ? (
              <Section title="Recent Completion">
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
                    Completed:{" "}
                    <Text style={{ fontWeight: "500", color: UI.textPrimary }}>
                      {completionCompletedAtDate
                        ? completionCompletedAtDate.toLocaleDateString()
                        : "—"}
                    </Text>
                  </Text>
                  <Text style={{ fontSize: 14, marginTop: 2, color: UI.textSecondary }}>
                    Status:{" "}
                    <Text style={{ fontWeight: "500", color: UI.textPrimary }}>Recorded locally</Text>
                  </Text>
                </View>
              </Section>
            ) : null}

            <Section title="Coach Tools">
              <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
                Internal pilot (coach-side). Parents can ignore this section.
              </Text>
              <Pressable
                onPress={() => router.push("/profile/coaches/create-pack")}
                style={({ pressed }) => cardButtonStyle(pressed)}
              >
                <Text style={{ fontSize: 16, color: UI.textPrimary, fontWeight: "700" }}>Create Program Pack</Text>
                <Text style={{ marginTop: 4, fontSize: 13, color: UI.textSecondary }}>
                  Pilot path: start from a template (other paths coming)
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
                  No preview items yet. Add a template from Coach Tools or add a custom focus from the coach tools below.
                </Text>
              </Section>
            )}

            {__DEV__ && showDebugData ? (
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
            ) : null}
          </>
        )}
      </KeyboardAwareScrollView>
    </>
  );
}
