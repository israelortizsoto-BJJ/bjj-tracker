import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  getAssignmentsById,
  getCoachLinks,
  getCoachesById,
  getCompletionReceiptsQueue,
  getPackEnrollments,
  getPacksById,
} from "../../../src/storage/coachShareStore";
import type {
  AssignmentMap,
  CoachIdentityMap,
  CoachLink,
  CompletionReceipt,
  PackEnrollment,
  ProgramPackMap,
} from "../../../src/types/coachShare";

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
        <Text style={{ fontSize: 18, marginBottom: 8 }}>
          Coach Share (Scaffold)
        </Text>

        <Pressable
          onPress={() => void loadCoachShareData()}
          style={{
            marginBottom: 12,
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
          <Text style={{ fontSize: 14, opacity: 0.7 }}>
            Loading Coach Share data…
          </Text>
        ) : (
          <>
            <Text style={{ fontSize: 14, opacity: 0.8, marginBottom: 10 }}>
              Debug — links: {coachLinks.length} • enrollments:{" "}
              {packEnrollments.length} • assignments:{" "}
              {Object.keys(assignmentsById).length} • packs:{" "}
              {Object.keys(packsById).length} • coaches:{" "}
              {Object.keys(coachesById).length} • receipts:{" "}
              {completionReceiptsQueue.length}
            </Text>

            {coachLinks.length === 0 ? (
              <Text style={{ fontSize: 14, opacity: 0.7 }}>
                No Coach Share data found yet. Seed demo data from Developer
                Settings.
              </Text>
            ) : (
              <>
                <Text style={{ fontSize: 14, opacity: 0.8, marginBottom: 10 }}>
                  Seeded demo data loaded successfully.
                </Text>

                <Text style={{ fontSize: 16, marginBottom: 6 }}>
                  Coach: {firstCoach?.displayName ?? "—"}
                </Text>
                <Text style={{ fontSize: 14, opacity: 0.8, marginBottom: 10 }}>
                  Academy: {firstCoach?.academyName ?? "—"}
                </Text>

                <Text style={{ fontSize: 16, marginBottom: 6 }}>
                  Pack: {firstPack?.title ?? "—"}
                </Text>
                <Text style={{ fontSize: 14, opacity: 0.8, marginBottom: 10 }}>
                  Modules: {firstPack?.modules.length ?? 0}
                </Text>

                <Text style={{ fontSize: 16, marginBottom: 6 }}>
                  Assignment: {firstAssignment?.title ?? "—"}
                </Text>

                <View style={{ marginTop: 14 }}>
                  <Text style={{ fontSize: 14 }}>
                    Links: {coachLinks.length}
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
                </View>
              </>
            )}
          </>
        )}
      </View>
    </>
  );
}
