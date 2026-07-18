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
import { toDateKey } from "../../_domain/dateKey";
import { hasTrainingProofVisibility } from "../../domain/training/overlayTrainingProofSignals";
import {
  filterSessionsLikeTrainingRefresh,
  normalizeSessionsLikeTraining,
} from "../../domain/sessionUtils";
import {
  getKidsById,
  getLatestKidWeeklyFocusForWeek,
  pickPublishedWeeklyParentFeedbackForSharedAthlete,
  refreshCoachWriterSessionsAndReconcileStores,
  startOfWeekMondayYMD,
  todayYMD,
} from "../../storage/coachKidStore";
import type { SyncedWeeklyParentFeedback } from "../../types/coachWeeklySync";
import {
  getCoachTrainingProof,
  peekCoachTrainingProof,
} from "../../storage/coachTrainingProofStore";
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
  parentFeedback?: SyncedWeeklyParentFeedback | null;
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

function addDaysYMDLocal(ymd: string, delta: number): string {
  const [year, month, dayOfMonth] = ymd.split("-").map(Number);
  if (!year || !month || !dayOfMonth) return "";

  const date = new Date(year, month - 1, dayOfMonth);
  date.setDate(date.getDate() + delta);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function countSessionsInCurrentWeek(
  sessions: readonly Session[],
  referenceYMD: string,
): number {
  const weekStart = startOfWeekMondayYMD(referenceYMD);
  if (!weekStart) return 0;

  const weekEnd = addDaysYMDLocal(weekStart, 6);
  if (!weekEnd) return 0;

  let count = 0;
  for (const session of sessions) {
    const dateKey = toDateKey(session.date);
    if (dateKey && dateKey >= weekStart && dateKey <= weekEnd) count += 1;
  }
  return count;
}

function resolveOperationalSessionsThisWeek(
  scopedSessions: readonly Session[],
  referenceYMD: string,
  operatingAthleteId: string,
): number {
  const localCount = countSessionsInCurrentWeek(scopedSessions, referenceYMD);
  if (!operatingAthleteId) return localCount;

  const proof = peekCoachTrainingProof(operatingAthleteId);
  if (proof && hasTrainingProofVisibility(proof, operatingAthleteId)) {
    return proof.currentWeekSessionCount;
  }
  return localCount;
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

/**
 * Coach Dashboard insight load corridor.
 *
 * Focus and Pull-to-Refresh share this path (same pattern as Kids roster
 * `loadKids` / Compete `runParentCompeteRefresh`): writer-session reconcile,
 * then local insight/team-focus projection. No new sync architecture.
 */
export function useCoachInsights(): {
  loading: boolean;
  refreshing: boolean;
  insights: CoachInsightRow[];
  teamFocus: CoachTeamFocusSnapshot;
  onRefresh: () => void;
} {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState<CoachInsightRow[]>([]);
  const [teamFocus, setTeamFocus] = useState<CoachTeamFocusSnapshot>({ athleteRows: [] });

  const loadInsights = useCallback(async (options?: { isCancelled?: () => boolean }) => {
    const isCancelled = options?.isCancelled ?? (() => false);

    try {
      const { successfulSnapshots } = await refreshCoachWriterSessionsAndReconcileStores();
      if (isCancelled()) return;

      const sessionsInWriterLinkTraversalOrder = successfulSnapshots.flatMap((snap) =>
        snap.session ? [snap.session] : [],
      );
      const [kidsById, rawSessions] = await Promise.all([
        getKidsById(),
        AsyncStorage.getItem(StorageKeys.sessions),
      ]);
      if (isCancelled()) return;

      const allSessions = parseSessions(rawSessions);
      const referenceYMD = todayYMD();
      const weekStart = startOfWeekMondayYMD(referenceYMD);
      const normalizedSessions = normalizeSessionsLikeTraining(
        allSessions as Session[],
      );
      const operatingAthleteIds = new Set(
        Object.values(kidsById)
          .map((kid) => kid.sharedAthleteId?.trim() ?? "")
          .filter(Boolean),
      );
      await Promise.all(
        [...operatingAthleteIds].map((id) => getCoachTrainingProof(id)),
      );
      if (isCancelled()) return;

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
        const operatingAthleteId = athlete.sharedAthleteId?.trim() ?? "";
        const scopedSessions = filterSessionsLikeTrainingRefresh(
          normalizedSessions,
          {
            deviceRole: "coach",
            athleteId: operatingAthleteId,
            linkedKidId: athleteId,
          },
        );
        const sessionsFiltered = sessionsForAthlete(allSessions, athlete);
        const recentCompetitionCount = competitions.length;
        const sessionsThisWeek = resolveOperationalSessionsThisWeek(
          scopedSessions,
          referenceYMD,
          operatingAthleteId,
        );
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
          sessionsThisWeek,
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

        let parentFeedback: SyncedWeeklyParentFeedback | null | undefined;
        if (operatingAthleteId) {
          parentFeedback = pickPublishedWeeklyParentFeedbackForSharedAthlete(
            sessionsInWriterLinkTraversalOrder,
            operatingAthleteId,
          );
          if (__DEV__) {
            const feedbackStatus = parentFeedback?.acknowledgedAt
              ? "acknowledged"
              : parentFeedback?.viewedAt
                ? "viewed"
                : "not_viewed";
            console.log("[COACH_ACK_RENDER]", {
              athleteId,
              feedbackStatus,
              acknowledgedAt: parentFeedback?.acknowledgedAt ?? null,
              viewedAt: parentFeedback?.viewedAt ?? null,
            });
          }
        }

        nextInsights.push({
          athlete,
          insight: {
            ...insight,
            appliedInSparring,
            derivedOutcome,
          },
          ...(operatingAthleteId ? { parentFeedback: parentFeedback ?? null } : {}),
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
      if (isCancelled()) return;
      setInsights(nextInsights);
      setTeamFocus({ athleteRows: nextTeamFocusRows });
    } catch {
      if (isCancelled()) return;
      setInsights([]);
      setTeamFocus({ athleteRows: [] });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void loadInsights({ isCancelled: () => cancelled }).finally(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [loadInsights]),
  );

  // Same PTR lifecycle as Kids roster `onRosterRefresh` / Compete `onCompeteRefresh`:
  // dedicated refreshing flag + shared load corridor (no parallel sync path).
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void (async () => {
      try {
        await loadInsights();
      } finally {
        setRefreshing(false);
      }
    })();
  }, [loadInsights]);

  return { loading, refreshing, insights, teamFocus, onRefresh };
}
