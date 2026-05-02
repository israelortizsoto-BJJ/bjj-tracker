import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import SummaryCompetitionCard from "../../components/summary/SummaryCompetitionCard";
import SummaryConsistencyCard from "../../components/summary/SummaryConsistencyCard";
import SummaryHeroCard from "../../components/summary/SummaryHeroCard";
import SummaryPatternsCard from "../../components/summary/SummaryPatternsCard";
import SummaryWeekCard from "../../components/summary/SummaryWeekCard";
import type { CompetitionEntry } from "../../lib/signals/computeSignals";
import { useSignals } from "../../hooks/useSignals";
import { useActiveKidId } from "../../state/activeKidStore";
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

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadFallbackAthlete() {
        const kidsById = await getKidsById();
        const firstKid = Object.values(kidsById)
          .filter((kid) => kid.name.trim().length > 0)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))[0];

        if (mounted) setFallbackKidId(firstKid?.id ?? "");
      }

      void loadFallbackAthlete();

      return () => {
        mounted = false;
      };
    }, []),
  );

  const activeKidId = activeKidIdFromStore ?? fallbackKidId;
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
      <View style={styles.section}>
        <SummaryHeroCard
          alignment={signals.alignment}
          confidence={signals.confidence}
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
          totalMatches={signals.competition.totalMatches}
          winRate={signals.competition.winRate}
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
  section: {
    marginBottom: 30,
  },
  lastSection: {
    marginBottom: 0,
  },
});
