import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useRef, useState } from "react";

import { mergeCompetitionMatchDetailIntoEntries } from "@/src/storage/competitionStore";
import type { KidCompetitionEntryWithMatchDetail } from "@/src/storage/competitionStore";
import { getKidCompetitionEntries } from "../storage/kidCompetitionStore";
import { getSessions } from "../storage/sessionsStore";
import type { Session } from "../types";

type AthleteData = {
  sessions: Session[];
  competitions: KidCompetitionEntryWithMatchDetail[];
  loading: boolean;
};

export function useAthleteData(activeAthleteId: string): AthleteData {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [competitions, setCompetitions] = useState<KidCompetitionEntryWithMatchDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const prevHydratedAthleteRef = useRef<string | undefined>(undefined);
  const loadGenerationRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const athleteId = activeAthleteId.trim();

      async function load() {
        const gen = ++loadGenerationRef.current;
        setLoading(true);

        if (!athleteId) {
          if (!mounted) return;
          if (gen !== loadGenerationRef.current) return;

          prevHydratedAthleteRef.current = "";

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

        const prev = prevHydratedAthleteRef.current;
        if (prev !== undefined && prev !== athleteId) {
          setSessions([]);
          setCompetitions([]);
        }
        prevHydratedAthleteRef.current = athleteId;

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

          if (!mounted || gen !== loadGenerationRef.current) return;

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
          if (!mounted || gen !== loadGenerationRef.current) return;

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
          if (mounted && gen === loadGenerationRef.current) setLoading(false);
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
