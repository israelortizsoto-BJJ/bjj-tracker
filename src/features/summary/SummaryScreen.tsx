import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import SummaryAthleteSwitcher from "../../components/summary/SummaryAthleteSwitcher";
import SummaryCompetitionCard from "../../components/summary/SummaryCompetitionCard";
import SummaryConsistencyCard from "../../components/summary/SummaryConsistencyCard";
import SummaryHeroCard from "../../components/summary/SummaryHeroCard";
import SummaryPatternsCard from "../../components/summary/SummaryPatternsCard";
import SummaryWeekCard from "../../components/summary/SummaryWeekCard";
import type { CompetitionEntry } from "../../lib/signals/computeSignals";
import { useSignals } from "../../hooks/useSignals";
import { setActiveKidId, useActiveKidId } from "../../state/activeKidStore";
import { getKidsById } from "../../storage/coachKidStore";
import { getCompetitionDetailByEntryId } from "../../storage/competitionStore";
import { getKidCompetitionEntriesForKid } from "../../storage/kidCompetitionStore";
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
          const [allSessions, competitionEntries] = await Promise.all([
            getSessions(),
            getKidCompetitionEntriesForKid(activeKidId),
          ]);

          const nextSessions = allSessions.filter(
            (session) => session.kidId === activeKidId,
          );
          const nextCompetitions = await Promise.all(
            competitionEntries.map(async (competition): Promise<CompetitionEntry> => {
              const detail = await getCompetitionDetailByEntryId(competition.id);

              return {
                ...competition,
                matches: Array.isArray(detail?.matches) ? detail.matches : [],
              };
            }),
          );

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
          record={signals.competition.record}
          submissionRate={signals.competition.submissionRate}
          totalMatches={signals.competition.totalMatches}
          winRate={signals.competition.winRate}
          winStyle={signals.competition.winStyle}
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
