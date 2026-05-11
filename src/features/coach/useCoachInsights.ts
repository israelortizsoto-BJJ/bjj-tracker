import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";

import {
  deriveCompetitionTrainingSkillFocus,
  principalTrainingSkillBucketFromCoachFocusText,
  principalTrainingSkillBucketFromDerivedFocus,
  type TrainingSkillBucket,
} from "../../ai-coach/competitionTrainingSkillFocus";
import {
  isCoachTrainingFocusDecisionFresh,
  peekCoachTrainingFocusDecision,
} from "../../ai-coach/coachTrainingFocusFeedback";
import {
  deriveCompetitionBucketHistorySignals,
  type BucketOutcomeTrend,
} from "../../lib/signals/competitionBucketHistory";
import type { CompetitionPlacementTrend } from "../../lib/signals/computeSignals";
import {
  getKidsById,
  getLatestKidWeeklyFocusForWeek,
  startOfWeekMondayYMD,
  todayYMD,
} from "../../storage/coachKidStore";
import { getKidCompetitionEntriesWithMatchDetailForKid } from "../../storage/competitionStore";
import { StorageKeys } from "../../storage/storageKeys";
import type { Session } from "../../types";
import { kidExcludedFromCoachActiveRoster, type Kid, type KidWeeklyFocusSparringApplication } from "../../types/coachKid";
import { computeCoachInsight, type CoachInsight } from "./computeCoachInsight";

export type CoachAppliedInSparring =
  | KidWeeklyFocusSparringApplication
  | "no_data";
export type CoachDerivedOutcome = "learning" | "developing" | "applying" | "unknown";

export type CoachInsightRow = {
  athlete: Kid;
  insight: CoachInsight & {
    appliedInSparring?: CoachAppliedInSparring;
    derivedOutcome?: CoachDerivedOutcome;
  };
};

/** Per-athlete training focus bucket for roster-wide aggregation (shared load with insights). */
export type CoachTeamFocusAthleteRow = {
  athlete: Kid;
  focusBucket: TrainingSkillBucket | null;
  placementTrend: CompetitionPlacementTrend | null | undefined;
  bucketOutcomeTrends: Partial<Record<TrainingSkillBucket, BucketOutcomeTrend>>;
  usedCoachFocusOverride: boolean;
};

export type CoachTeamFocusSnapshot = {
  athleteRows: CoachTeamFocusAthleteRow[];
};

export function deriveOutcomeFromSparring(
  sparring: "not_yet" | "sometimes" | "yes" | "no_data",
): CoachDerivedOutcome {
  switch (sparring) {
    case "not_yet":
      return "learning";
    case "sometimes":
      return "developing";
    case "yes":
      return "applying";
    case "no_data":
      return "unknown";
  }
}

export function insightOutcomeFromDerivedOutcome(
  outcome: CoachDerivedOutcome,
): string | null {
  switch (outcome) {
    case "learning":
      return "not_yet";
    case "developing":
      return "developing";
    case "applying":
      return "on_track";
    case "unknown":
      return null;
  }
}

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

export function useCoachInsights(): {
  loading: boolean;
  insights: CoachInsightRow[];
  teamFocus: CoachTeamFocusSnapshot;
} {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<CoachInsightRow[]>([]);
  const [teamFocus, setTeamFocus] = useState<CoachTeamFocusSnapshot>({ athleteRows: [] });

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
          const nextInsights: CoachInsightRow[] = [];
          const nextTeamFocusRows: CoachTeamFocusAthleteRow[] = [];

          for (const athlete of Object.values(kidsById)) {
            const athleteId = athlete.id.trim();
            if (!athleteId) continue;
            if (kidExcludedFromCoachActiveRoster(athlete)) continue;

            const [competitions, weeklyFocus] = await Promise.all([
              getKidCompetitionEntriesWithMatchDetailForKid(athleteId),
              getLatestKidWeeklyFocusForWeek(athleteId, weekStart),
            ]);
            const sessionsFiltered = sessionsForAthlete(allSessions, athlete);
            const recentCompetitionCount = competitions.length;
            const sessionsThisWeek = sessionsFiltered.length;
            const appliedInSparring: CoachAppliedInSparring =
              weeklyFocus?.sparringApplication ?? "no_data";
            const derivedOutcome = deriveOutcomeFromSparring(appliedInSparring);
            const outcome = insightOutcomeFromDerivedOutcome(derivedOutcome);

            console.log("[INSIGHT INPUT]", {
              athleteId,
              appliedInSparring,
              derivedOutcome,
              outcome,
              recentCompetitionCount,
              sessionsThisWeek,
            });

            const insight = computeCoachInsight({
              athleteId,
              sessions: sessionsFiltered,
              competitions,
              weeklyFocus,
              outcome,
            });

            if (athleteId === "kid_1777331810730") {
              console.log("[INSIGHT OUTPUT - MIKEY]", {
                athleteId,
                attentionLevel: insight.attentionLevel,
                transferScore: insight.transferScore,
                reason: insight.reason,
              });
            }

            nextInsights.push({
              athlete,
              insight: {
                ...insight,
                appliedInSparring,
                derivedOutcome,
              },
            });

            const tf = deriveCompetitionTrainingSkillFocus({
              competitionsWithMatches: competitions,
              sessions: sessionsFiltered as Session[],
            });
            const { bucketOutcomeTrends } = deriveCompetitionBucketHistorySignals(competitions);
            const placementTrend = tf?.placementTrend ?? null;
            const coachDecision = peekCoachTrainingFocusDecision(athleteId);
            let focusBucket: TrainingSkillBucket | null = null;
            let usedCoachFocusOverride = false;
            if (coachDecision && isCoachTrainingFocusDecisionFresh(coachDecision)) {
              const fromCoachText = principalTrainingSkillBucketFromCoachFocusText(
                coachDecision.finalCoachFocus,
              );
              if (fromCoachText) {
                focusBucket = fromCoachText;
                usedCoachFocusOverride = true;
              }
            }
            if (!focusBucket) {
              focusBucket = principalTrainingSkillBucketFromDerivedFocus(tf);
            }

            nextTeamFocusRows.push({
              athlete,
              focusBucket,
              placementTrend,
              bucketOutcomeTrends,
              usedCoachFocusOverride,
            });
          }
          if (mounted) setInsights(nextInsights);
          if (mounted) setTeamFocus({ athleteRows: nextTeamFocusRows });
        } catch {
          if (mounted) {
            setInsights([]);
            setTeamFocus({ athleteRows: [] });
          }
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

  return { loading, insights, teamFocus };
}
