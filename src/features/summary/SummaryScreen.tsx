import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import SummaryAthleteSwitcher from "../../components/summary/SummaryAthleteSwitcher";
import SummaryCompetitionCard from "../../components/summary/SummaryCompetitionCard";
import SummaryConsistencyCard from "../../components/summary/SummaryConsistencyCard";
import SummaryHeroCard from "../../components/summary/SummaryHeroCard";
import SummaryPatternsCard from "../../components/summary/SummaryPatternsCard";
import SummaryWeekCard from "../../components/summary/SummaryWeekCard";
import {
  deriveCompetitionTrainingSkillFocus,
  principalTrainingSkillBucketFromDerivedFocus,
} from "../../ai-coach/competitionTrainingSkillFocus";
import { resolvePrincipalBucketEvidenceLine } from "../../lib/signals/competitionBucketHistory";
import type { CompetitionEntry } from "../../lib/signals/computeSignals";
import { useSignals } from "../../hooks/useSignals";
import { setActiveKidId, useActiveKidId } from "../../state/activeKidStore";
import { getKidsById } from "../../storage/coachKidStore";
import { getKidCompetitionEntriesWithMatchDetailForKid } from "../../storage/competitionStore";
import { getSessions } from "../../storage/sessionsStore";
import type { Session } from "../../types";

type AthleteData = {
  sessions: Session[];
  competitions: CompetitionEntry[];
  loading: boolean;
};

type SummaryAthlete = {
  id: string;
  name: string;
};

function useAthleteData(activeKidId: string): AthleteData {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [competitions, setCompetitions] = useState<CompetitionEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadAthleteData() {
        if (!activeKidId) {
          setSessions([]);
          setCompetitions([]);
          setLoading(false);
          return;
        }

        setLoading(true);

        try {
          const allSessions = await getSessions();

          const nextSessions = allSessions.filter(
            (session) => session.kidId === activeKidId,
          );
          const nextCompetitions = await getKidCompetitionEntriesWithMatchDetailForKid(activeKidId);

          if (!mounted) return;

          setSessions(nextSessions);
          setCompetitions(nextCompetitions);
        } finally {
          if (mounted) setLoading(false);
        }
      }

      void loadAthleteData();

      return () => {
        mounted = false;
      };
    }, [activeKidId]),
  );

  return { sessions, competitions, loading };
}

export default function SummaryScreen() {
  const activeKidIdFromStore = useActiveKidId();
  const [fallbackKidId, setFallbackKidId] = useState("");
  const [athletes, setAthletes] = useState<SummaryAthlete[]>([]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadFallbackAthlete() {
        const kidsById = await getKidsById();
        const nextAthletes = Object.values(kidsById)
          .map((kid) => ({
            id: kid.id,
            name: kid.name.trim() || "Athlete",
          }))
          .sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
          );

        if (mounted) {
          setAthletes(nextAthletes);
          setFallbackKidId(nextAthletes[0]?.id ?? "");
        }
      }

      void loadFallbackAthlete();

      return () => {
        mounted = false;
      };
    }, []),
  );

  const activeKidExists = athletes.some(
    (athlete) => athlete.id === activeKidIdFromStore,
  );
  const activeKidId =
    activeKidIdFromStore && activeKidExists ? activeKidIdFromStore : fallbackKidId;
  const handleSelectAthlete = useCallback((kidId: string) => {
    setActiveKidId(kidId);
  }, []);
  const { sessions, competitions } = useAthleteData(activeKidId);
  const signals = useSignals({
    sessions,
    competitions,
  });

  const competitionSkillFocus = useMemo(
    () =>
      activeKidId
        ? deriveCompetitionTrainingSkillFocus({
            competitionsWithMatches: competitions,
            sessions,
          })
        : null,
    [activeKidId, competitions, sessions],
  );

  const competitionSkillFocusHint =
    competitionSkillFocus?.eligibleForSummaryLine &&
    competitionSkillFocus.highConfidence &&
    competitionSkillFocus.summaryLabel
      ? competitionSkillFocus.summaryLabel
      : undefined;

  const principalFocusBucket = useMemo(
    () => principalTrainingSkillBucketFromDerivedFocus(competitionSkillFocus),
    [competitionSkillFocus],
  );

  const bucketFocusEvidenceLine = useMemo(
    () =>
      resolvePrincipalBucketEvidenceLine(
        principalFocusBucket,
        signals.competition.bucketOutcomeTrends,
      ),
    [principalFocusBucket, signals.competition.bucketOutcomeTrends],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {athletes.length > 0 ? (
        <View style={styles.selectorSection}>
          <SummaryAthleteSwitcher
            activeAthleteId={activeKidId}
            athletes={athletes}
            onChange={handleSelectAthlete}
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <SummaryHeroCard
          alignment={signals.alignment}
          confidence={signals.confidence}
          hasData={signals.hasData}
          topSystem={signals.patterns.topSystem}
          topTechnique={signals.patterns.topTechnique}
        />
      </View>

      <View style={styles.section}>
        <SummaryWeekCard
          weeklySessionCount={signals.frequency.weeklySessionCount}
          topTechniques={signals.techniques.topTechniques}
        />
      </View>

      <View style={styles.section}>
        <SummaryPatternsCard
          gear={signals.gear}
          topSystem={signals.patterns.topSystem}
          topTechnique={signals.patterns.topTechnique}
          topTechniques={signals.techniques.topTechniques}
        />
      </View>

      <View style={styles.section}>
        <SummaryConsistencyCard
          weeklySessionCount={signals.consistency.currentWeekCount}
          streak={signals.consistency.streak}
        />
      </View>

      <View style={styles.lastSection}>
        <SummaryCompetitionCard
          averageMatchTime={signals.competition.averageMatchTime}
          competitionCount={signals.competition.competitionCount}
          fastestSubmission={signals.competition.fastestSubmission}
          lastCompetitionDate={signals.competition.lastCompetitionDate}
          lastCompetitionResult={signals.competition.lastCompetitionResult}
          lastCompetitionLosses={signals.competition.lastCompetitionLosses}
          lastCompetitionMatchCount={signals.competition.lastCompetitionMatchCount}
          lastCompetitionName={signals.competition.lastCompetitionName}
          lastCompetitionWins={signals.competition.lastCompetitionWins}
          podiumCountLast30Days={signals.competition.podiumCountLast30Days}
          podiumCountLast90Days={signals.competition.podiumCountLast90Days}
          record={signals.competition.record}
          submissionRate={signals.competition.submissionRate}
          totalMatches={signals.competition.totalMatches}
          winRate={signals.competition.winRate}
          winStyle={signals.competition.winStyle}
          placementTrend={signals.competition.placementTrend}
          skillFocusHint={competitionSkillFocusHint}
          bucketFocusEvidenceLine={bucketFocusEvidenceLine ?? undefined}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0b0f12",
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  selectorSection: {
    marginBottom: 24,
  },
  section: {
    marginBottom: 30,
  },
  lastSection: {
    marginBottom: 0,
  },
});
