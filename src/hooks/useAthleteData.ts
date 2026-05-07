import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";

import { mergeCompetitionMatchDetailIntoEntries } from "@/src/storage/competitionStore";
import { getKidCompetitionEntries } from "../storage/kidCompetitionStore";
import { getSessions } from "../storage/sessionsStore";
import type { Session } from "../types";
import type { KidCompetitionEntry } from "../types/coachKid";

type AthleteData = {
  sessions: Session[];
  competitions: KidCompetitionEntry[];
  loading: boolean;
};

export function useAthleteData(activeAthleteId: string): AthleteData {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [competitions, setCompetitions] = useState<KidCompetitionEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const athleteId = activeAthleteId.trim();

      async function load() {
        setLoading(true);

        if (!athleteId) {
          if (!mounted) return;

          setSessions([]);
          setCompetitions([]);
          setLoading(false);

          if (__DEV__) {
            console.log("[ATHLETE DATA]", {
              activeAthleteId: athleteId,
              sessionCount: 0,
              competitionCount: 0,
            });
          }

          return;
        }

        try {
          const [allSessions, allCompetitions] = await Promise.all([
            getSessions(),
            getKidCompetitionEntries(),
          ]);

          const nextSessions = allSessions.filter((session) => {
            const sharedAthleteId = session.sharedAthleteId?.trim();
            return sharedAthleteId === athleteId;
          });

          const filteredCompetitions = allCompetitions.filter((competition) => {
            const sharedAthleteId = competition.sharedAthleteId?.trim();
            return sharedAthleteId === athleteId;
          });

          const nextCompetitions = await mergeCompetitionMatchDetailIntoEntries(filteredCompetitions);

          if (!mounted) return;

          setSessions([...nextSessions]);
          setCompetitions([...nextCompetitions]);

          if (__DEV__) {
            console.log("[ATHLETE DATA]", {
              activeAthleteId: athleteId,
              sessionCount: nextSessions.length,
              competitionCount: nextCompetitions.length,
            });
          }
        } catch (error) {
          if (!mounted) return;

          setSessions([]);
          setCompetitions([]);

          if (__DEV__) {
            console.log("[ATHLETE DATA]", {
              activeAthleteId: athleteId,
              sessionCount: 0,
              competitionCount: 0,
              error,
            });
          }
        } finally {
          if (mounted) setLoading(false);
        }
      }

      void load();

      return () => {
        mounted = false;
      };
    }, [activeAthleteId]),
  );

  return useMemo(
    () => ({
      sessions: [...sessions],
      competitions: [...competitions],
      loading,
    }),
    [sessions, competitions, loading],
  );
}
