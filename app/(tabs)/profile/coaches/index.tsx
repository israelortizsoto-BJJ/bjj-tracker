import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  getAssignmentsById,
  getCoachLinks,
  getCoachesById,
  getCompletionReceiptsQueue,
  getPackEnrollments,
  getPacksById,
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

  const firstCoach = Object.values(coachesById)[0];
  const firstPack = Object.values(packsById)[0];
  const firstAssignment = Object.values(assignmentsById)[0];

  return (
    <>
      <Stack.Screen options={{ title: "Coaches & Programs" }} />
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6 }}>
          Coach Share
        </Text>
        <Text style={{ fontSize: 14, opacity: 0.75, lineHeight: 20 }}>
          Parent-controlled coach guidance, curriculum packs, and assignments.
          Dev scaffold only for now.
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
              Seed demo data from Developer Settings to preview the scaffold.
            </Text>
          </Section>
        ) : (
          <>
            <Section title="Coach">
              <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 4 }}>
                {firstCoach?.displayName ?? "—"}
              </Text>
              <Text style={{ fontSize: 14, opacity: 0.8 }}>
                {firstCoach?.academyName ?? "—"}
              </Text>
            </Section>

            <Section title="Program Pack">
              <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 4 }}>
                {firstPack?.title ?? "—"}
              </Text>
              <Text style={{ fontSize: 14, opacity: 0.8, lineHeight: 20 }}>
                {firstPack?.description ?? "—"}
              </Text>
              <Text style={{ fontSize: 14, marginTop: 8 }}>
                Modules: {firstPack?.modules.length ?? 0}
              </Text>
            </Section>

            <Section title="Current Assignment">
              <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 4 }}>
                {firstAssignment?.title ?? "—"}
              </Text>
              <Text style={{ fontSize: 14, opacity: 0.8, lineHeight: 20 }}>
                {firstAssignment?.notes ?? "—"}
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
      </View>
    </>
  );
}
