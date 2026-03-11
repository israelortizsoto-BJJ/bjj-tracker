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
        marginTop: 14,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          letterSpacing: 0.6,
          opacity: 0.7,
          marginBottom: 8,
        }}
      >
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

  return (
    <>
      <Stack.Screen options={{ title: "Coaches & Programs" }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6 }}>
          Coach Share
        </Text>
        <Text style={{ fontSize: 14, opacity: 0.75, lineHeight: 20 }}>
          See what your coach has planned for your child this week, including
          today&apos;s focus and the current program pack.
        </Text>
        
         <Pressable
          onPress={() => router.push("/profile/coaches/join")}
          style={{
            marginTop: 14,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ fontSize: 16 }}>Join Coach / Program</Text>
          <Text style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
            Enter an invite code or use a coach invite later
          </Text>
        </Pressable>
        
                <Pressable
          onPress={() => router.push("/profile/coaches/manage")}
          style={{
            marginTop: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ fontSize: 16 }}>Manage Coach Link</Text>
          <Text style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
            Review linked coach access and revoke later
          </Text>
        </Pressable>

        <Pressable
          onPress={() => void loadCoachShareData()}
          style={{
            marginTop: 14,
            marginBottom: 4,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ fontSize: 14 }}>Reload Coach Share Data</Text>
        </Pressable>

        {!ready ? (
          <Text style={{ marginTop: 14, fontSize: 14, opacity: 0.7 }}>
            Loading Coach Share data…
          </Text>
        ) : coachLinks.length === 0 ? (
          <Section title="Empty State">
            <Text style={{ fontSize: 15, marginBottom: 6 }}>
              No Coach Share data found yet.
            </Text>
            <Text style={{ fontSize: 14, opacity: 0.75, lineHeight: 20 }}>
              When you connect with a coach, their assignments and program
              details will appear here.
            </Text>
            <Text style={{ marginTop: 8, fontSize: 12, opacity: 0.6, lineHeight: 18 }}>
              For local preview, you can seed demo data from Developer Settings.
            </Text>
          </Section>
        ) : (
          <>
            <Section title="Coach">
              <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 4 }}>
                {currentCoach?.displayName ?? "—"}
              </Text>
              <Text style={{ fontSize: 14, opacity: 0.8 }}>
                {currentCoach?.academyName ?? "—"}
              </Text>
            </Section>

            <Section title="Assigned Now">
              <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 4 }}>
                {currentAssignment?.title ?? "No active assignment"}
              </Text>
              <Text style={{ fontSize: 14, opacity: 0.8, lineHeight: 20 }}>
                {currentAssignment?.notes ??
                  "Your coach&apos;s current assignment details will appear here."}
              </Text>
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 14 }}>
                  Status:{" "}
                  <Text style={{ fontWeight: "500" }}>
                    {currentAssignment?.status ?? "—"}
                  </Text>
                </Text>
                <Text style={{ fontSize: 14, marginTop: 2 }}>
                  Assigned:{" "}
                  <Text style={{ fontWeight: "500" }}>
                    {currentAssignmentAssignedDate
                      ? currentAssignmentAssignedDate.toLocaleDateString()
                      : "—"}
                  </Text>
                </Text>
              </View>
              {currentAssignment?.status === "assigned" ? (
                <Pressable
                  onPress={() => void handleMarkCurrentAssignmentComplete()}
                  style={{
                    marginTop: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    alignSelf: "flex-start",
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "500" }}>
                    Mark Complete
                  </Text>
                </Pressable>
              ) : null}
            </Section>

            <Section title="Module Focus">
              <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 4 }}>
                {currentModule?.title ?? "No specific module selected"}
              </Text>
              <Text style={{ fontSize: 14, opacity: 0.8, lineHeight: 20 }}>
                {currentModule?.summary ??
                  "When your coach assigns a module, the focus and summary will show here."}
              </Text>
              {currentModulePosition ? (
                <Text style={{ fontSize: 14, marginTop: 8 }}>
                  Position in pack: {currentModulePosition}
                </Text>
              ) : null}
            </Section>

            <Section title="Program Pack">
              <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 4 }}>
                {currentPack?.title ?? "—"}
              </Text>
              <Text style={{ fontSize: 14, opacity: 0.8, lineHeight: 20 }}>
                {currentPack?.description ?? "—"}
              </Text>
              <Text style={{ fontSize: 14, marginTop: 8 }}>
                Modules: {currentPack?.modules.length ?? 0}
              </Text>
            </Section>

            <Section title="Debug Data">
              <Text style={{ fontSize: 14 }}>Links: {coachLinks.length}</Text>
              <Text style={{ fontSize: 14 }}>
                Coaches: {Object.keys(coachesById).length}
              </Text>
              <Text style={{ fontSize: 14 }}>
                Packs: {Object.keys(packsById).length}
              </Text>
              <Text style={{ fontSize: 14 }}>
                Enrollments: {packEnrollments.length}
              </Text>
              <Text style={{ fontSize: 14 }}>
                Assignments: {Object.keys(assignmentsById).length}
              </Text>
              <Text style={{ fontSize: 14 }}>
                Receipt queue: {completionReceiptsQueue.length}
              </Text>
            </Section>
          </>
        )}
      </ScrollView>
    </>
  );
}
