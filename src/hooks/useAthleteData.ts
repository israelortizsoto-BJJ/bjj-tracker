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

function sessionMatchesAthleteLineage(
  session: Session,
  athleteId: string,
  linkedKidIdTrim: string,
): boolean {
  const sid = (session.sharedAthleteId ?? "").trim();
  if (sid === athleteId) return true;
  if (linkedKidIdTrim && (session.kidId ?? "").trim() === linkedKidIdTrim) return true;
  return false;
}

/**
 * Loads athlete-scoped competitions (always `sharedAthleteId`) and training sessions tied to the
 * athlete via `sharedAthleteId` and/or the linked roster `kidId` (coach kid row / parent kid row).
 * Matches {@link filterSessionsLikeTrainingRefresh} “byShared | byKid” lineage, not viewer-only ids.
 */
export type SummaryFlowTraceRole = "parent" | "coach" | "unknown";

/**
 * @param summaryFlowTraceRole TEMP (Operator Mode): labels console rows for parent vs coach Summary.
 */
export function useAthleteData(
  activeAthleteId: string,
  linkedKidId?: string | null,
  summaryFlowTraceRole: SummaryFlowTraceRole = "unknown",
): AthleteData {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [competitions, setCompetitions] = useState<KidCompetitionEntryWithMatchDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const prevHydratedScopeRef = useRef<string | undefined>(undefined);
  const loadGenerationRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const athleteId = activeAthleteId.trim();
      const linkedKidTrim = (linkedKidId ?? "").trim();
      const scopeKey = `${athleteId}\u0001${linkedKidTrim}`;

      async function load() {
        const gen = ++loadGenerationRef.current;
        setLoading(true);

        if (!athleteId) {
          if (!mounted) return;
          if (gen !== loadGenerationRef.current) return;

          prevHydratedScopeRef.current = "";

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
          console.log("[COMP_SYNC_TRACE] useAthleteData", {
            athleteId,
            competitionsLoadedCount: 0,
          });

          return;
        }

        const prev = prevHydratedScopeRef.current;
        if (prev !== undefined && prev !== scopeKey) {
          setSessions([]);
          setCompetitions([]);
        }
        prevHydratedScopeRef.current = scopeKey;

        try {
          const [allSessions, allCompetitions] = await Promise.all([
            getSessions(),
            getKidCompetitionEntries(),
          ]);

          if (__DEV__) {
            console.log("[SUMMARY_FLOW_TRACE] 1_raw_sessions_fetched", {
              flow: summaryFlowTraceRole,
              activeAthleteId: athleteId || null,
              linkedKidId: linkedKidTrim || null,
              rawSessionCount: allSessions.length,
            });
          }

          const matchedBySharedCount = allSessions.filter(
            (session) => (session.sharedAthleteId ?? "").trim() === athleteId,
          ).length;
          const matchedByKidCount = linkedKidTrim
            ? allSessions.filter(
                (session) => (session.kidId ?? "").trim() === linkedKidTrim,
              ).length
            : 0;

          const nextSessions = allSessions.filter((session) =>
            sessionMatchesAthleteLineage(session, athleteId, linkedKidTrim),
          );

          if (__DEV__) {
            console.log("[SUMMARY_SESSION_SOURCE]", {
              athleteId,
              linkedKidId: linkedKidTrim || null,
              totalSessionsLoaded: allSessions.length,
              matchedBySharedCount,
              matchedByKidCount,
              finalSessionIds: nextSessions.map((s) => s.id),
            });
            console.log("[SUMMARY_FLOW_TRACE] 2_sessions_after_athlete_filtering", {
              flow: summaryFlowTraceRole,
              activeAthleteId: athleteId || null,
              linkedKidId: linkedKidTrim || null,
              lineageMatchCount: nextSessions.length,
              sampleLineage: nextSessions.slice(0, 5).map((s) => ({
                id: s.id,
                sharedAthleteId: (s.sharedAthleteId ?? "").trim() || null,
                kidId: (s.kidId ?? "").trim() || null,
                trainingLoggedByRole: s.trainingLoggedByRole ?? null,
              })),
            });
          }

          const filteredCompetitions = allCompetitions.filter((competition) => {
            const sharedAthleteId = competition.sharedAthleteId?.trim();
            return sharedAthleteId === athleteId;
          });

          const nextCompetitions = await mergeCompetitionMatchDetailIntoEntries(filteredCompetitions);

          if (!mounted || gen !== loadGenerationRef.current) return;

          setSessions([...nextSessions]);
          setCompetitions([...nextCompetitions]);

          if (__DEV__) {
            console.log("[SUMMARY_TRAINING_LINEAGE_RESOLVER]", {
              athleteId,
              sharedAthleteId: athleteId,
              linkedKidId: linkedKidTrim || null,
              sessionsFound: nextSessions.length,
              sessionIds: nextSessions.map((s) => s.id),
              resolverSource: "useAthleteData.sharedOrLinkedKid",
            });
            console.log("[ATHLETE DATA]", {
              activeAthleteId: athleteId,
              sessionCount: nextSessions.length,
              competitionCount: nextCompetitions.length,
            });
          }
          console.log("[COMP_SYNC_TRACE] useAthleteData", {
            athleteId,
            competitionsLoadedCount: nextCompetitions.length,
          });
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
          console.log("[COMP_SYNC_TRACE] useAthleteData", {
            athleteId,
            competitionsLoadedCount: 0,
            error: String(error),
          });
        } finally {
          if (mounted && gen === loadGenerationRef.current) setLoading(false);
        }
      }

      void load();

      return () => {
        mounted = false;
      };
    }, [activeAthleteId, linkedKidId, summaryFlowTraceRole]),
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
