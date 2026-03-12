import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  getAssignmentsById,
  getCoachLinks,
  getCoachesById,
  getCompletionReceiptsQueue,
  getPackEnrollments,
  getPacksById,
  setAssignmentsById as persistAssignmentsById,
  setCompletionReceiptsQueue as persistCompletionReceiptsQueue,
} from "../../../../src/storage/coachShareStore";
import type {
  AssignmentMap,
  CoachIdentityMap,
  CoachLink,
  CompletionReceipt,
  PackEnrollment,
  ProgramPackMap,
} from "../../../../src/types/coachShare";

const UI = {
  screenBg: "#0b0d12",
  bgCard: "#0f172a",
  border: "#233047",
  textPrimary: "#f8fafc",
  textSecondary: "#cbd5e1",
};
const CARD_RADIUS = 16;
const SECTION_LABEL = { fontSize: 11, letterSpacing: 1.2, color: "#94a3b8", fontWeight: "600" as const };

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
  const [coachLinks, setCoachLinks] = useState<CoachLink[]>([]);
  const [coachesById, setCoachesById] = useState<CoachIdentityMap>({});
  const [packsById, setPacksById] = useState<ProgramPackMap>({});
  const [packEnrollments, setPackEnrollments] = useState<PackEnrollment[]>([]);
  const [assignmentsById, setAssignmentsById] = useState<AssignmentMap>({});
  const [completionReceiptsQueue, setCompletionReceiptsQueue] = useState<
    CompletionReceipt[]
  >([]);

  const loadCoachShareData = useCallback(async () => {
    setReady(false);

    const [
      loadedCoachLinks,
      loadedCoachesById,
      loadedPacksById,
      loadedPackEnrollments,
      loadedAssignmentsById,
      loadedCompletionReceiptsQueue,
    ] = await Promise.all([
      getCoachLinks(),
      getCoachesById(),
      getPacksById(),
      getPackEnrollments(),
      getAssignmentsById(),
      getCompletionReceiptsQueue(),
    ]);

    setCoachLinks(loadedCoachLinks);
    setCoachesById(loadedCoachesById);
    setPacksById(loadedPacksById);
    setPackEnrollments(loadedPackEnrollments);
    setAssignmentsById(loadedAssignmentsById);
    setCompletionReceiptsQueue(loadedCompletionReceiptsQueue);
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
    backgroundColor: pressed ? "#111827" : UI.bgCard,
    alignSelf: "flex-start",
  });

  return (
    <>
      <Stack.Screen options={{ title: "Coaches & Programs" }} />
      <ScrollView style={{ flex: 1, backgroundColor: UI.screenBg }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ fontSize: 24, fontWeight: "700", color: UI.textPrimary, marginBottom: 8 }}>
          Coach Share
        </Text>
        <Text style={{ fontSize: 15, color: UI.textSecondary, lineHeight: 22 }}>
          See what your coach has planned for your child this week, including
          today&apos;s focus and the current program pack.
        </Text>

        <Pressable
          onPress={() => router.push("/profile/coaches/join")}
          style={({ pressed }) => cardButtonStyle(pressed)}
        >
          <Text style={{ fontSize: 16, color: UI.textPrimary, fontWeight: "600" }}>Join Coach / Program</Text>
          <Text style={{ marginTop: 4, fontSize: 13, color: UI.textSecondary }}>
            Enter an invite code or use a coach invite later
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/profile/coaches/manage")}
          style={({ pressed }) => cardButtonStyle(pressed)}
        >
          <Text style={{ fontSize: 16, color: UI.textPrimary, fontWeight: "600" }}>Manage Coach Link</Text>
          <Text style={{ marginTop: 4, fontSize: 13, color: UI.textSecondary }}>
            Review linked coach access and revoke later
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/profile/coaches/create-pack")}
          style={({ pressed }) => cardButtonStyle(pressed)}
        >
          <Text style={{ fontSize: 16, color: UI.textPrimary, fontWeight: "600" }}>Create Program Pack</Text>
          <Text style={{ marginTop: 4, fontSize: 13, color: UI.textSecondary }}>
            Start from template, customize, or build from scratch
          </Text>
        </Pressable>

        <Pressable
          onPress={() => void loadCoachShareData()}
          style={({ pressed }) => ({ ...cardButtonStyle(pressed), marginTop: 16 })}
        >
          <Text style={{ fontSize: 14, color: UI.textSecondary, fontWeight: "600" }}>Reload Coach Share Data</Text>
        </Pressable>

        {!ready ? (
          <Text style={{ marginTop: 18, fontSize: 15, color: UI.textSecondary }}>
            Loading Coach Share data…
          </Text>
        ) : coachLinks.length === 0 ? (
          <Section title="Empty State">
            <Text style={{ fontSize: 15, marginBottom: 6, color: UI.textPrimary, fontWeight: "600" }}>
              No Coach Share data found yet.
            </Text>
            <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
              When you connect with a coach, their assignments and program
              details will appear here.
            </Text>
            <Text style={{ marginTop: 10, fontSize: 13, color: UI.textSecondary, lineHeight: 20 }}>
              For local preview, you can seed demo data from Developer Settings.
            </Text>
          </Section>
        ) : (
          <>
            <Section title="Coach">
              <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 4, color: UI.textPrimary }}>
                {currentCoach?.displayName ?? "—"}
              </Text>
              <Text style={{ fontSize: 14, color: UI.textSecondary }}>
                {currentCoach?.academyName ?? "—"}
              </Text>
            </Section>

            <Section title="Assigned Now">
              <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 4, color: UI.textPrimary }}>
                {currentAssignment?.title ?? "No active assignment"}
              </Text>
              <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
                {currentAssignment?.notes ??
                  "Your coach&apos;s current assignment details will appear here."}
              </Text>
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 14, color: UI.textSecondary }}>
                  Status:{" "}
                  <Text style={{ fontWeight: "500", color: UI.textPrimary }}>
                    {currentAssignment?.status ?? "—"}
                  </Text>
                </Text>
                <Text style={{ fontSize: 14, marginTop: 2, color: UI.textSecondary }}>
                  Assigned:{" "}
                  <Text style={{ fontWeight: "500", color: UI.textPrimary }}>
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
                    backgroundColor: pressed ? "#111827" : UI.bgCard,
                    alignSelf: "flex-start",
                  })}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: UI.textPrimary }}>
                    Mark Complete
                  </Text>
                </Pressable>
              ) : null}
            </Section>

            <Section title="Module Focus">
              <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 4, color: UI.textPrimary }}>
                {currentModule?.title ?? "No specific module selected"}
              </Text>
              <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
                {currentModule?.summary ??
                  "When your coach assigns a module, the focus and summary will show here."}
              </Text>
              {currentModulePosition ? (
                <Text style={{ fontSize: 14, marginTop: 10, color: UI.textSecondary }}>
                  Position in pack: {currentModulePosition}
                </Text>
              ) : null}
            </Section>

            <Section title="Program Pack">
              <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 4, color: UI.textPrimary }}>
                {currentPack?.title ?? "—"}
              </Text>
              <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 22 }}>
                {currentPack?.description ?? "—"}
              </Text>
              <Text style={{ fontSize: 14, marginTop: 10, color: UI.textSecondary }}>
                Modules: {currentPack?.modules.length ?? 0}
              </Text>
            </Section>

            {hasCompletionSummary ? (
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
            </Section>
          </>
        )}
      </ScrollView>
    </>
  );
}
