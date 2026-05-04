import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import {
  getKidsById,
  getLatestKidWeeklyFocusForWeek,
  startOfWeekMondayYMD,
  todayYMD,
} from "../../storage/coachKidStore";
import { getKidCompetitionEntriesForKid } from "../../storage/kidCompetitionStore";
import { StorageKeys } from "../../storage/storageKeys";
import type { Kid } from "../../types/coachKid";
import { computeCoachInsight, type CoachInsight } from "./computeCoachInsight";
import {
  deriveOutcomeFromSparring,
  insightOutcomeFromDerivedOutcome,
} from "./useCoachInsights";

type DebugRow = {
  athleteName: string;
  insight: CoachInsight;
};

function parseSessions(raw: string | null): any[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sessionsForAthlete(allSessions: any[], athlete: Kid): any[] {
  const athleteId = athlete.id.trim();
  const sharedAthleteId = athlete.sharedAthleteId?.trim() ?? "";

  return allSessions.filter((session) => {
    const sessionKidId =
      typeof session?.kidId === "string" ? session.kidId.trim() : "";
    const sessionSharedAthleteId =
      typeof session?.sharedAthleteId === "string"
        ? session.sharedAthleteId.trim()
        : "";

    return (
      sessionKidId === athleteId ||
      sessionSharedAthleteId === athleteId ||
      (Boolean(sharedAthleteId) && sessionSharedAthleteId === sharedAthleteId)
    );
  });
}

export default function CoachInsightDebugScreen() {
  const [rows, setRows] = useState<DebugRow[]>([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function load() {
        setLoading(true);

        try {
          const [kidsById, rawSessions] = await Promise.all([
            getKidsById(),
            AsyncStorage.getItem(StorageKeys.sessions),
          ]);
          const allSessions = parseSessions(rawSessions);
          const weekStart = startOfWeekMondayYMD(todayYMD());
          const nextRows: DebugRow[] = [];

          for (const athlete of Object.values(kidsById)) {
            const athleteId = athlete.id.trim();
            if (!athleteId) continue;

            const [competitions, weeklyFocus] = await Promise.all([
              getKidCompetitionEntriesForKid(athleteId),
              getLatestKidWeeklyFocusForWeek(athleteId, weekStart),
            ]);
            const derivedOutcome = deriveOutcomeFromSparring(
              weeklyFocus?.sparringApplication ?? "no_data",
            );
            const insight = computeCoachInsight({
              athleteId,
              sessions: sessionsForAthlete(allSessions, athlete),
              competitions,
              weeklyFocus,
              outcome: insightOutcomeFromDerivedOutcome(derivedOutcome),
            });

            console.log("[COACH INSIGHT DEBUG]", insight);
            nextRows.push({ athleteName: athlete.name, insight });
          }

          if (mounted) setRows(nextRows);
        } finally {
          if (mounted) setLoading(false);
        }
      }

      void load();

      return () => {
        mounted = false;
      };
    }, []),
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text>Coach Insight Debug</Text>
      {loading ? <Text>Loading…</Text> : null}
      {rows.map(({ athleteName, insight }) => (
        <View key={insight.athleteId}>
          <Text>{athleteName || insight.athleteId}</Text>
          <Text>{insight.athleteId}</Text>
          <Text>{insight.attentionLevel}</Text>
          <Text>{insight.reason}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
