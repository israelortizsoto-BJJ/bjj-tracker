import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  activeCoachWriterInviteTokenNorms,
  kidVisibleOnCoachRoster,
} from "../../coachShare/coachLinkBinding";
import { isCoachSyncConfigured } from "../../config/coachSync";
import {
  getKidsById,
  getLatestKidWeeklyFocusForWeek,
  refreshCoachWriterSessionsAndReconcileStores,
  startOfWeekMondayYMD,
  todayYMD,
} from "../../storage/coachKidStore";
import { getKidCompetitionEntriesForKid } from "../../storage/kidCompetitionStore";
import { StorageKeys } from "../../storage/storageKeys";
import type { CoachLink } from "../../types/coachShare";
import { kidExcludedFromCoachActiveRoster, type Kid, type KidsById } from "../../types/coachKid";
import { computeCoachInsight, type CoachInsight } from "./computeCoachInsight";
import {
  deriveOutcomeFromSparring,
  insightOutcomeFromDerivedOutcome,
} from "./useCoachInsights";

const UI = {
  border: "#26303a",
  rowBg: "#10151a",
  rowBgPressed: "#171b20",
  textPrimary: "#ffffff",
  textSecondary: "#9ca3af",
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

export default function CoachRoster() {
  const [ready, setReady] = useState(false);
  /** True once `loadKids` has completed at least one full pass (avoids empty flicker before first hydrate). */
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);
  const [kidsById, setKidsByIdState] = useState<KidsById>({});
  const [insightsByAthleteId, setInsightsByAthleteId] = useState<
    Record<string, CoachInsight>
  >({});
  const [activeWriterAthleteIds, setActiveWriterAthleteIds] = useState<Set<string>>(new Set());
  const [writerLinks, setWriterLinks] = useState<CoachLink[]>([]);
  const [lastWriterRefresh, setLastWriterRefresh] = useState({ writers: 0, sessionOk: 0 });
  const syncConfigured = isCoachSyncConfigured();
  const coachKidNavLockRef = useRef(false);

  const loadKids = useCallback(async () => {
    setReady(false);

    try {
      const { successfulSnapshots, writerLinks } = await refreshCoachWriterSessionsAndReconcileStores();
      setWriterLinks(writerLinks);
      setLastWriterRefresh({
        writers: writerLinks.length,
        sessionOk: successfulSnapshots.length,
      });

      if (syncConfigured && writerLinks.length > 0 && successfulSnapshots.length > 0) {
        const nextActiveWriterAthleteIds = new Set<string>();

        for (const snapshot of successfulSnapshots) {
          for (const athlete of snapshot.athletes) {
            const athleteId = typeof athlete.id === "string" ? athlete.id.trim() : "";
            if (athleteId) nextActiveWriterAthleteIds.add(athleteId);
          }
        }

        setActiveWriterAthleteIds(nextActiveWriterAthleteIds);
      } else {
        setActiveWriterAthleteIds(new Set());
      }

      const kids = await getKidsById();
      const rawSessions = await AsyncStorage.getItem(StorageKeys.sessions);
      const allSessions = parseSessions(rawSessions);
      const weekStart = startOfWeekMondayYMD(todayYMD());
      const nextInsights: Record<string, CoachInsight> = {};

      for (const kid of Object.values(kids)) {
        const athleteId = kid.id.trim();
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
          sessions: sessionsForAthlete(allSessions, kid),
          competitions,
          weeklyFocus,
          outcome: insightOutcomeFromDerivedOutcome(derivedOutcome),
        });

        console.log("[COACH INSIGHT ROSTER]", {
          athleteId,
          attentionLevel: insight.attentionLevel,
          reason: insight.reason,
        });

        nextInsights[athleteId] = insight;
      }

      setKidsByIdState(kids);
      setInsightsByAthleteId(nextInsights);
    } finally {
      setReady(true);
      setHasCompletedInitialLoad(true);
    }
  }, [syncConfigured]);

  useFocusEffect(
    useCallback(() => {
      void loadKids();
    }, [loadKids]),
  );

  const activeWriterTokenNorms = useMemo(
    () => activeCoachWriterInviteTokenNorms(writerLinks),
    [writerLinks],
  );

  const kids = useMemo(() => {
    const visible = Object.values(kidsById).filter(
      (kid) =>
        !kidExcludedFromCoachActiveRoster(kid) &&
        kidVisibleOnCoachRoster(kid, activeWriterTokenNorms, activeWriterAthleteIds),
    );
    return visible.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [activeWriterAthleteIds, activeWriterTokenNorms, kidsById]);

  const rosterDisconnected =
    syncConfigured &&
    lastWriterRefresh.writers > 0 &&
    lastWriterRefresh.sessionOk === 0 &&
    hasCompletedInitialLoad;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Athletes</Text>

      {!ready ? (
        <Text style={styles.loadingText}>Loading athletes…</Text>
      ) : kids.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            {rosterDisconnected ? "Couldn’t refresh roster" : "No athletes yet"}
          </Text>
          <Text style={styles.emptyText}>
            {rosterDisconnected
              ? "Coach sync is configured but the server session did not load. Check your connection and pull to revisit this tab."
              : "Add an athlete to start managing weekly coaching."}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {kids.map((kid) => {
            const insight = insightsByAthleteId[kid.id];

            return (
              <Pressable
                key={kid.id}
                onPress={() => {
                  if (coachKidNavLockRef.current) return;
                  coachKidNavLockRef.current = true;
                  console.log("[NAV TEST] pushing coach route", kid.id);
                  router.push({
                    pathname: "/coach/kid/[kidId]",
                    params: { kidId: kid.id },
                  });
                  setTimeout(() => {
                    coachKidNavLockRef.current = false;
                  }, 800);
                }}
                style={({ pressed }) => [
                  styles.row,
                  pressed ? styles.rowPressed : null,
                ]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.name}>{kid.name}</Text>
                  {insight ? (
                    <>
                      <Text style={styles.loadingText}>{insight.attentionLevel}</Text>
                      <Text style={styles.emptyText}>{insight.reason}</Text>
                    </>
                  ) : null}
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  sectionLabel: {
    color: UI.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  loadingText: {
    color: UI.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    borderColor: UI.border,
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
  },
  emptyTitle: {
    color: UI.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  emptyText: {
    color: UI.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    borderColor: UI.border,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    alignItems: "center",
    backgroundColor: UI.rowBg,
    borderBottomColor: UI.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowPressed: {
    backgroundColor: UI.rowBgPressed,
  },
  rowText: {
    flex: 1,
    paddingRight: 12,
  },
  name: {
    color: UI.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  chevron: {
    color: UI.textSecondary,
    fontSize: 26,
    fontWeight: "400",
    lineHeight: 28,
  },
});
