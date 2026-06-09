import { router, type Href } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { useCoachSyncHydrationVersion } from "@/src/storage/coachSyncHydrationStore";
import { peekCoachMatchBreakdownArtifactSet } from "@/src/storage/coachMatchBreakdownArtifactStore";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { localTodayDateKey, toDateKey } from "@/src/_domain/dateKey";
import { CompetitionCard } from "@/src/features/competition/CompetitionCard";
import { logSaveLifecycleTrace } from "@/src/features/competition/saveLifecycleTrace";
import { MedalCollection } from "@/src/features/competition/MedalCollection";
import type { CompeteKidEntryMerged } from "@/src/features/competition/MedalGallery";
import {
  getKidCompetitionEntriesWithMatchDetailForKid,
  getKidCompetitionEntriesWithMatchDetailForSharedAthlete,
} from "@/src/storage/competitionStore";
import {
  getCompetitionVersion,
  kidIdForUnlinkedParentAthleteCompetitions,
  subscribeCompetition,
} from "@/src/storage/kidCompetitionStore";
import { logCoachHydrationResolveTrace } from "@/src/identity/coachHydrationResolveTrace";
import { useActiveAthlete } from "@/src/hooks/useActiveAthlete";
import { useDeviceRole } from "@/src/deviceRole/DeviceRoleProvider";
import OperatingHeader from "@/src/components/operating/OperatingHeader";

const FEED = {
  bg: "#111315",
  panel2: "#20242a",
  line: "rgba(236, 241, 245, 0.12)",
  text: "#f2f4f6",
  muted: "#a9b0b8",
  radius: 6,
};

const THIS_WEEK = {
  bgCard: "#181b1f",
  border: "rgba(236, 241, 245, 0.12)",
  textPrimary: "#f2f4f6",
  textSecondary: "#a9b0b8",
  primaryFill: "#d6ff3f",
  primaryFillPressed: "#c7f11f",
  primaryTextOnFill: "#111315",
  radius: 8,
};

type MonthGroup = {
  monthKey: string;
  label: string;
  entries: CompeteKidEntryMerged[];
};

function eventKey(entry: CompeteKidEntryMerged): string {
  return toDateKey(entry.eventDate);
}

function eventTime(entry: CompeteKidEntryMerged): number {
  const key = eventKey(entry);
  const t = new Date(`${key}T12:00:00`).getTime();
  if (Number.isFinite(t)) return t;
  const created = new Date(entry.createdAt).getTime();
  return Number.isFinite(created) ? created : 0;
}

function monthKeyForEntry(entry: CompeteKidEntryMerged): string {
  const key = eventKey(entry);
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return key.slice(0, 7);
  return "unknown";
}

function monthLabel(monthKey: string): string {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return "Unknown";
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function matchSignature(entry: CompeteKidEntryMerged): string {
  return entry.matches
    .map((match) =>
      [
        match.id,
        match.matchResult ?? "",
        match.outcome ?? "",
        match.submissionTime ?? "",
        match.submissionType ?? "",
        match.coachNote ?? "",
        match.imageUri ?? "",
        match.videoUri ?? "",
      ].join(":"),
    )
    .join("|");
}

/** Avoid `setEntries` only when shell ids and hydrated match payloads are unchanged. */
function competeEntriesSameProjection(
  prev: readonly CompeteKidEntryMerged[],
  next: readonly CompeteKidEntryMerged[],
): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (prev[i]?.id !== next[i]?.id) return false;
    if (prev[i]?.updatedAt !== next[i]?.updatedAt) return false;
    if (prev[i]?.matches.length !== next[i]?.matches.length) return false;
    if (matchSignature(prev[i]) !== matchSignature(next[i])) return false;
  }
  return true;
}

function buildPastMonthGroups(entries: CompeteKidEntryMerged[]): MonthGroup[] {
  const byMonth = new Map<string, CompeteKidEntryMerged[]>();

  for (const entry of entries) {
    const key = monthKeyForEntry(entry);
    const existing = byMonth.get(key);
    if (existing) existing.push(entry);
    else byMonth.set(key, [entry]);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, monthEntries]) => ({
      monthKey,
      label: monthLabel(monthKey),
      entries: [...monthEntries].sort((a, b) => eventTime(b) - eventTime(a)),
    }));
}

export default function CompetitionTab() {
  const { role: deviceRole } = useDeviceRole();
  const {
    athleteId,
    linkedKidId,
    hydrationReady,
    athlete,
    authorityBootstrapState,
    operatingAthleteRoster,
  } = useActiveAthlete();
  const [entries, setEntries] = useState<CompeteKidEntryMerged[]>([]);
  const [expandedMonthKey, setExpandedMonthKey] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);
  const coachSyncHydrationVersion = useCoachSyncHydrationVersion();
  const competitionVersion = useSyncExternalStore(
    subscribeCompetition,
    getCompetitionVersion,
    getCompetitionVersion,
  );
  const devTraceRef = useRef({
    deviceRole,
    authorityBootstrapState,
    operatingAthleteRoster,
  });
  devTraceRef.current = {
    deviceRole,
    authorityBootstrapState,
    operatingAthleteRoster,
  };

  const loadCompetitions = useCallback(async () => {
    const gen = ++loadGenerationRef.current;
    if (__DEV__) {
      console.log("[COMPETE_RENDER_LOOP_TRACE] loadCompetitions_entered", {
        gen,
        athleteId: athleteId.trim() || null,
        linkedKidId: linkedKidId ?? null,
        coachSyncHydrationVersion,
        competitionVersion,
      });
    }
    const trimmedAthleteId = athleteId.trim();
    if (!trimmedAthleteId) {
      if (__DEV__) {
        console.log("[COMPETE_RENDER_LOOP_TRACE] setEntries_skip_empty_athlete", { gen });
      }
      setEntries((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const lk = linkedKidId;
    const merged = lk
      ? await getKidCompetitionEntriesWithMatchDetailForKid(lk)
      : await getKidCompetitionEntriesWithMatchDetailForSharedAthlete(trimmedAthleteId);
    console.log("[COMP_SYNC_TRACE] compete.tsx loadCompetitions", {
      linkedKidId: lk ?? null,
      athleteId: trimmedAthleteId,
      entriesLoaded: merged.length,
    });
    if (__DEV__) {
      console.log("[COMPETE_REFRESH_TRACE]", {
        stage: "entry_array_refresh",
        gen,
        athleteId: trimmedAthleteId,
        linkedKidId: lk ?? null,
        competitionVersion,
        coachSyncHydrationVersion,
        entryCount: merged.length,
        matchCounts: merged.map((entry) => ({
          entryId: entry.id,
          sharedCompetitionId: entry.sharedCompetitionId ?? null,
          matchCount: entry.matches.length,
          matchIds: entry.matches.map((match) => match.id),
        })),
      });
      console.log("[COACH_COMPETE_DETAIL_TRACE]", {
        stage: "entry_array_refresh",
        gen,
        athleteId: trimmedAthleteId,
        linkedKidId: lk ?? null,
        competitionVersion,
        coachSyncHydrationVersion,
        projectedEntries: merged.map((entry) => ({
          entryId: entry.id,
          sharedCompetitionId: entry.sharedCompetitionId ?? null,
          matchCount: entry.matches.length,
          matchIds: entry.matches.map((match) => match.id),
        })),
      });
    }
    for (const row of merged) {
      const sharedAthleteId = (row.sharedAthleteId ?? trimmedAthleteId).trim();
      const sharedCompetitionId = (row.sharedCompetitionId ?? "").trim();
      const artifactSet = sharedAthleteId ? peekCoachMatchBreakdownArtifactSet(sharedAthleteId) : null;
      const compArtifacts =
        artifactSet?.artifacts.filter(
          (a) => a.sharedCompetitionId.trim() === sharedCompetitionId,
        ) ?? [];
      const entryMatchIds = row.matches.map((m) => m.id);
      const entryCoachNoteCount = row.matches.filter((m) => (m.coachNote ?? "").trim()).length;
      console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
        stage: "compete_entries_loaded",
        entryId: row.id,
        sharedAthleteId: sharedAthleteId || null,
        sharedCompetitionId: sharedCompetitionId || null,
        entryUpdatedAt: row.updatedAt ?? null,
        entryMatchCount: row.matches.length,
        entryMatchIds,
        entryCoachNoteCount,
        artifactSetPresent: Boolean(artifactSet),
        artifactSetUpdatedAt: artifactSet?.updatedAt ?? null,
        artifactCountForComp: compArtifacts.length,
        artifactLineageKeys: compArtifacts.map((a) => a.matchLineageKey.trim()),
        readingStaleCompetitionEntry: compArtifacts.length > 0 && entryCoachNoteCount === 0,
        lineageJoinEligibleCount: compArtifacts.filter((a) =>
          entryMatchIds.includes(a.matchLineageKey.trim()),
        ).length,
      });
    }
    if (__DEV__ && devTraceRef.current.deviceRole === "coach") {
      const trace = devTraceRef.current;
      logCoachHydrationResolveTrace("competition_resolve", {
        sharedAthleteId: trimmedAthleteId || null,
        resolvedAthleteId: trimmedAthleteId || null,
        linkedKidId: lk ?? null,
        authorityBootstrapState: trace.authorityBootstrapState ?? null,
        projectionExists: trace.operatingAthleteRoster.some(
          (a) => a.id.trim() === trimmedAthleteId,
        ),
        coachProjectionExists: trace.operatingAthleteRoster.length > 0,
        nullReturnReason: !trimmedAthleteId
          ? "no_operating_athlete_id"
          : merged.length === 0
            ? "competition_store_empty_for_scope"
            : null,
        extra: { entriesLoaded: merged.length, loadPath: lk ? "by_kid" : "by_shared_athlete" },
      });
    }
    if (gen !== loadGenerationRef.current) return;
    setEntries((prev) => {
      const prevTotalMatches = prev.reduce((sum, entry) => sum + entry.matches.length, 0);
      const nextTotalMatches = merged.reduce((sum, entry) => sum + entry.matches.length, 0);
      if (competeEntriesSameProjection(prev, merged)) {
        if (__DEV__) {
          console.log("[COMPETE_RENDER_LOOP_TRACE] setEntries_unchanged", {
            gen,
            count: merged.length,
          });
          console.log("[COMPETE_REFRESH_TRACE]", {
            stage: "set_entries_unchanged",
            gen,
            competitionVersion,
            prevEntryCount: prev.length,
            nextEntryCount: merged.length,
            matchCountBefore: prevTotalMatches,
            matchCountAfter: nextTotalMatches,
            rerenderCause: "projection_unchanged",
          });
          console.log("[COACH_COMPETE_DETAIL_TRACE]", {
            stage: "stale_projection_skipped",
            gen,
            competitionVersion,
            rerenderReason: "projection_unchanged",
            matchCountBefore: prevTotalMatches,
            matchCountAfter: nextTotalMatches,
          });
        }
        return prev;
      }
      if (__DEV__) {
        console.log("[COMPETE_RENDER_LOOP_TRACE] setEntries_apply", {
          gen,
          prevCount: prev.length,
          nextCount: merged.length,
        });
        console.log("[COMPETE_REFRESH_TRACE]", {
          stage: "set_entries_apply",
          gen,
          competitionVersion,
          prevEntryCount: prev.length,
          nextEntryCount: merged.length,
          matchCountBefore: prevTotalMatches,
          matchCountAfter: nextTotalMatches,
          rerenderCause:
            prev.length === merged.length ? "detail_projection_changed" : "entry_array_changed",
        });
        console.log("[COACH_COMPETE_DETAIL_TRACE]", {
          stage: "stale_projection_applied",
          gen,
          competitionVersion,
          rerenderReason:
            prev.length === merged.length ? "detail_projection_changed" : "entry_array_changed",
          matchCountBefore: prevTotalMatches,
          matchCountAfter: nextTotalMatches,
        });
      }
      return merged;
    });
  }, [athleteId, linkedKidId, coachSyncHydrationVersion, competitionVersion]);

  const loadCompetitionsRef = useRef(loadCompetitions);
  loadCompetitionsRef.current = loadCompetitions;

  useFocusEffect(
    useCallback(() => {
      logSaveLifecycleTrace("compete_screen_focus", {
        competitionId: null,
        sharedCompetitionId: null,
        athleteId: athleteId.trim() || null,
        linkedKidId: linkedKidId ?? null,
      });
      console.log("[COMP_FOCUS_RELOAD]", {
        ts: Date.now(),
        linkedKidId: linkedKidId ?? null,
        athleteId: athleteId.trim() || null,
      });
      if (__DEV__) {
        console.log("[COMPETE_RENDER_LOOP_TRACE] focus_effect_entered", {
          athleteId: athleteId.trim() || null,
          linkedKidId: linkedKidId ?? null,
          coachSyncHydrationVersion,
          competitionVersion,
        });
      }
      void loadCompetitionsRef.current();
      return () => {
        if (__DEV__) {
          console.log("[COMPETE_RENDER_LOOP_TRACE] focus_effect_cleanup");
        }
      };
    }, [athleteId, linkedKidId, coachSyncHydrationVersion, competitionVersion]),
  );

  const noAthleteSelected = hydrationReady && !athleteId.trim();
  const competeNoAthleteSubtitle =
    authorityBootstrapState === "coach_unresolved" ||
    authorityBootstrapState === "coach_disconnected"
      ? "Choose an athlete on Summary when several athletes are linked or roster sync could not refresh."
      : "Select an athlete in Summary to view competition history";
  const athleteName = (athlete?.name ?? "").trim();
  const athleteInitials = initialsFromName(athleteName || "?");
  const visibleEntries = useMemo(() => {
    const aid = athleteId.trim();
    if (!aid) return [];
    if (linkedKidId) return entries.filter((entry) => entry.kidId === linkedKidId);
    return entries.filter((entry) => (entry.sharedAthleteId ?? "").trim() === aid);
  }, [entries, athleteId, linkedKidId]);
  const todayKey = useMemo(() => localTodayDateKey(), []);
  const upcomingEntries = useMemo(
    () =>
      visibleEntries
        .filter((entry) => {
          const key = eventKey(entry);
          return /^\d{4}-\d{2}-\d{2}$/.test(key) && key > todayKey;
        })
        .sort((a, b) => eventTime(a) - eventTime(b)),
    [todayKey, visibleEntries],
  );
  const pastEntries = useMemo(
    () =>
      visibleEntries
        .filter((entry) => {
          const key = eventKey(entry);
          return !/^\d{4}-\d{2}-\d{2}$/.test(key) || key <= todayKey;
        })
        .sort((a, b) => eventTime(b) - eventTime(a)),
    [todayKey, visibleEntries],
  );
  const monthGroups = useMemo(() => buildPastMonthGroups(pastEntries), [pastEntries]);

  const toggleMonth = useCallback((monthKey: string) => {
    setExpandedMonthKey((prev) => (prev === monthKey ? null : monthKey));
  }, []);

  const openCompetitionEntry = useCallback(
    (entry: CompeteKidEntryMerged) => {
      if (deviceRole !== "parent" && deviceRole !== "coach") return;
      const lane = deviceRole === "coach" ? "coach" : "this-week";
      router.push(
        `/${lane}/kid/${encodeURIComponent(entry.kidId)}/competition/edit?entryId=${encodeURIComponent(entry.id)}` as Href,
      );
    },
    [deviceRole],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <OperatingHeader
          mode="athlete"
          eyebrow="Competition / Proof"
          title="Events and matches"
          athlete={{
            name: noAthleteSelected ? "No athlete selected" : athleteName || "Athlete",
            initials: athleteInitials,
            meta: linkedKidId ? "Linked athlete" : "Competition history",
          }}
          actions={[
            {
              label: "Competition view",
              icon: "▣",
              selected: true,
            },
            {
              label: "Add competition",
              icon: "+",
              disabled: !hydrationReady || !athleteId.trim(),
              onPress: () => {
                if (!hydrationReady || !athleteId.trim()) return;
                const aid = athleteId.trim();
                if (linkedKidId) {
                  router.push(
                    `/this-week/kid/${linkedKidId}/competition/edit?openNonce=${Date.now()}` as Href,
                  );
                  return;
                }
                if (!aid) return;
                const bucket = kidIdForUnlinkedParentAthleteCompetitions(aid);
                router.push(
                  `/this-week/kid/${encodeURIComponent(bucket)}/competition/edit?openNonce=${Date.now()}` as Href,
                );
              },
            },
            {
              label: "Device profile and settings",
              icon: "⚙",
              accessibilityLabel: "Device profile and settings",
              onPress: () => router.push("/profile"),
            },
          ]}
        />

        {noAthleteSelected ? (
          <View style={styles.twEmptyCard}>
            <Text style={styles.twEmptyTitle}>No athlete selected</Text>
            <Text style={styles.twEmptySubtitle}>{competeNoAthleteSubtitle}</Text>
            <Pressable
              onPress={() => router.push("/summary")}
              style={({ pressed }) => ({
                marginTop: 22,
                paddingVertical: 14,
                paddingHorizontal: 18,
                borderRadius: THIS_WEEK.radius,
                borderWidth: 1,
                borderColor: THIS_WEEK.primaryFill,
                backgroundColor: pressed ? THIS_WEEK.primaryFillPressed : THIS_WEEK.primaryFill,
                alignSelf: "stretch",
                alignItems: "center",
              })}
            >
              <Text style={styles.twEmptyButtonLabel}>Open Summary</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <MedalCollection entries={visibleEntries} onOpenEntry={openCompetitionEntry} />

            <View style={styles.listSection}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Next up</Text>
                <Text style={styles.caption}>{upcomingEntries.length} events</Text>
              </View>
              {upcomingEntries.length === 0 ? (
                <Text style={styles.emptyLine}>No upcoming competitions.</Text>
              ) : (
                upcomingEntries.map((entry) => (
                  <CompetitionCard
                    key={`${entry.id}@${competitionVersion}`}
                    entry={entry}
                    onOpenEntry={openCompetitionEntry}
                  />
                ))
              )}
            </View>

            <View style={styles.listSection}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Past</Text>
                <Text style={styles.caption}>{pastEntries.length} events</Text>
              </View>
              {monthGroups.length === 0 ? (
                <Text style={styles.emptyLine}>No past competitions yet.</Text>
              ) : (
                monthGroups.map((group) => {
                  const expanded = expandedMonthKey === group.monthKey;
                  return (
                    <View key={group.monthKey} style={styles.monthGroup}>
                      <Pressable
                        onPress={() => toggleMonth(group.monthKey)}
                        style={({ pressed }) => [
                          styles.monthHeader,
                          pressed ? styles.monthHeaderPressed : null,
                        ]}
                      >
                        <Text style={styles.monthChevron}>{expanded ? "▼" : "▶"}</Text>
                        <View style={styles.monthHeaderText}>
                          <Text style={styles.monthLabel}>{group.label}</Text>
                          <Text style={styles.monthCount}>
                            {group.entries.length} {group.entries.length === 1 ? "event" : "events"}
                          </Text>
                        </View>
                      </Pressable>
                      {expanded ? (
                        <View style={styles.monthBody}>
                          {group.entries.map((entry) => (
                            <CompetitionCard
                              key={`${entry.id}@${competitionVersion}`}
                              entry={entry}
                              onOpenEntry={openCompetitionEntry}
                            />
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: FEED.bg,
  },
  screen: {
    flex: 1,
    backgroundColor: FEED.bg,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
  },
  status: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statusText: {
    color: "#ecf1f6",
    fontSize: 12,
    fontWeight: "800",
  },
  appTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    gap: 12,
  },
  appTopLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  athleteNameBlock: {
    flex: 1,
    minWidth: 0,
  },
  athleteNameLabel: {
    color: FEED.text,
    fontSize: 16,
    fontWeight: "800",
  },
  avatar: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FEED.line,
    borderRadius: 10,
    backgroundColor: FEED.panel2,
  },
  avatarText: {
    color: FEED.text,
    fontSize: 12,
    fontWeight: "900",
  },
  iconRow: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FEED.line,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.045)",
  },
  iconText: {
    color: FEED.text,
    fontSize: 15,
  },
  screenTitle: {
    marginTop: 22,
  },
  caption: {
    color: FEED.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  h2: {
    color: FEED.text,
    fontSize: 29,
    fontWeight: "900",
  },
  twEmptyCard: {
    marginTop: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: THIS_WEEK.border,
    borderRadius: THIS_WEEK.radius,
    backgroundColor: THIS_WEEK.bgCard,
  },
  twEmptyTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: THIS_WEEK.textPrimary,
  },
  twEmptySubtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: THIS_WEEK.textSecondary,
  },
  twEmptyButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: THIS_WEEK.primaryTextOnFill,
  },
  listSection: {
    marginTop: 22,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 2,
  },
  sectionTitle: {
    color: FEED.text,
    fontSize: 15,
    fontWeight: "900",
  },
  emptyLine: {
    marginTop: 12,
    color: FEED.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  monthGroup: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: FEED.line,
    borderRadius: FEED.radius,
    overflow: "hidden",
    backgroundColor: FEED.bg,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 11,
    backgroundColor: FEED.bg,
  },
  monthHeaderPressed: {
    backgroundColor: FEED.panel2,
  },
  monthChevron: {
    width: 20,
    color: FEED.muted,
    fontSize: 13,
  },
  monthHeaderText: {
    flex: 1,
  },
  monthLabel: {
    color: FEED.text,
    fontSize: 14,
    fontWeight: "900",
  },
  monthCount: {
    marginTop: 1,
    color: FEED.muted,
    fontSize: 11,
  },
  monthBody: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
});
