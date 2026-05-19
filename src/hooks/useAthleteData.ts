import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useRef, useState } from "react";

import {
  devCompetitionSourceMatchTotal,
  devLogCompetitionSummaryTrace,
} from "@/src/features/summary/competitionSummaryAggregationTrace";
import { loadCanonicalAthleteCompetitionSlice } from "@/src/features/competition/canonicalCompetitionSource";
import type { KidCompetitionEntryWithMatchDetail } from "@/src/storage/competitionStore";
import { useCoachSyncHydrationVersion } from "../storage/coachSyncHydrationStore";
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
 * Loads training sessions and the **canonical competition slice** for the operating athlete
 * ({@link loadCanonicalAthleteCompetitionSlice} — same semantics as the Compete tab).
 * Sessions use `sharedAthleteId` and/or linked roster `kidId` lineage (not viewer-only ids).
 */
export type SummaryFlowTraceRole = "parent" | "coach" | "unknown";

/**
 * @param summaryFlowTraceRole TEMP (Operator Mode): labels console rows for parent vs coach Summary.
 */
export function useAthleteData(
  activeAthleteId: string,
  linkedKidId?: string | null,
  summaryFlowTraceRole: SummaryFlowTraceRole = "unknown",
  /** DEV: labels which screen subscribed (Summary vs Training); unused when omitted. */
  devHookConsumer?: "SummaryScreen" | "training",
): AthleteData {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [competitions, setCompetitions] = useState<KidCompetitionEntryWithMatchDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const prevHydratedScopeRef = useRef<string | undefined>(undefined);
  const loadGenerationRef = useRef(0);
  const hydrationVersion = useCoachSyncHydrationVersion();
  const prevHydrationVersionRef = useRef(hydrationVersion);

  useFocusEffect(
    useCallback(() => {
      const athleteId = activeAthleteId.trim();
      const isHydrationInvalidation =
        prevHydrationVersionRef.current !== hydrationVersion;
      prevHydrationVersionRef.current = hydrationVersion;

      if (__DEV__ && isHydrationInvalidation) {
        console.log("[COACH_SYNC_HYDRATION] useAthleteData_invalidation", {
          hydrationVersion,
          athleteId,
          deviceRole: summaryFlowTraceRole,
        });
      }

      let mounted = true;
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
          const [allSessions, nextCompetitions] = await Promise.all([
            getSessions(),
            loadCanonicalAthleteCompetitionSlice(athleteId, linkedKidTrim),
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

          if (__DEV__) {
            const sharedAthleteId = athleteId;
            const podiumish = nextCompetitions.filter((c) => {
              const t = (c.result ?? "").toString().trim().toLowerCase();
              return t === "gold" || t === "silver" || t === "bronze";
            }).length;
            const latest = [...nextCompetitions].sort((a, b) => {
              const d = b.eventDate.localeCompare(a.eventDate);
              if (d !== 0) return d;
              return b.createdAt.localeCompare(a.createdAt);
            })[0];
            devLogCompetitionSummaryTrace({
              stage: "useAthleteData.after_merge",
              devHookConsumer: devHookConsumer ?? "(unset)",
              athleteId,
              sharedAthleteId,
              linkedKidId: linkedKidTrim || null,
              competitionCount: nextCompetitions.length,
              matchCount: devCompetitionSourceMatchTotal(nextCompetitions),
              podiumCount: podiumish,
              latestCompetitionId: latest?.id ?? null,
              canonicalCompetitionSliceRowCount: nextCompetitions.length,
              summaryCompetitionSource: "loadCanonicalAthleteCompetitionSlice",
              summaryCompetitionSemantics:
                linkedKidTrim.length > 0
                  ? "kid-indexed + kidId filter (Compete parity)"
                  : "sharedAthleteId slice + merge (Compete parity)",
              summaryMerge: "mergeCompetitionMatchDetailIntoEntries (inside competitionStore loaders)",
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
    }, [
      activeAthleteId,
      linkedKidId,
      summaryFlowTraceRole,
      devHookConsumer,
      hydrationVersion,
    ]),
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
