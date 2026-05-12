import { router, type Href } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { localTodayDateKey, toDateKey } from "@/src/_domain/dateKey";
import { CompetitionCard } from "@/src/features/competition/CompetitionCard";
import { MedalCollection } from "@/src/features/competition/MedalCollection";
import type { CompeteKidEntryMerged } from "@/src/features/competition/MedalGallery";
import {
  getKidCompetitionEntriesWithMatchDetailForKid,
  getKidCompetitionEntriesWithMatchDetailForSharedAthlete,
} from "@/src/storage/competitionStore";
import { kidIdForUnlinkedParentAthleteCompetitions } from "@/src/storage/kidCompetitionStore";
import { useActiveAthlete } from "@/src/hooks/useActiveAthlete";
import OperatingHeader from "@/src/components/operating/OperatingHeader";

const FEED = {
  bg: "#111315",
  panel2: "#20242a",
  line: "rgba(236, 241, 245, 0.12)",
  text: "#f2f4f6",
  muted: "#a9b0b8",
  radius: 6,
};

/** Align empty-state card + primary CTA with This Week (`app/(tabs)/this-week/index.tsx` UI tokens). */
const THIS_WEEK = {
  bgCard: "#fefdff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  primaryFill: "#4f46e5",
  primaryFillPressed: "#4338ca",
  primaryTextOnFill: "#ffffff",
  radius: 16,
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
  const { athleteId, linkedKidId, hydrationReady, athlete } = useActiveAthlete();
  const [entries, setEntries] = useState<CompeteKidEntryMerged[]>([]);
  const [expandedMonthKey, setExpandedMonthKey] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);

  const loadCompetitions = useCallback(async () => {
    const gen = ++loadGenerationRef.current;
    const trimmedAthleteId = athleteId.trim();
    if (!trimmedAthleteId) {
      setEntries([]);
      return;
    }
    const lk = linkedKidId;
    const merged = lk
      ? await getKidCompetitionEntriesWithMatchDetailForKid(lk)
      : await getKidCompetitionEntriesWithMatchDetailForSharedAthlete(trimmedAthleteId);
    if (gen !== loadGenerationRef.current) return;
    setEntries(merged);
  }, [athleteId, linkedKidId]);

  useFocusEffect(
    useCallback(() => {
      void loadCompetitions();
    }, [loadCompetitions]),
  );

  const noAthleteSelected = hydrationReady && !athleteId.trim();
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
            <Text style={styles.twEmptySubtitle}>
              Select an athlete in Summary to view competition history
            </Text>
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
            <MedalCollection entries={visibleEntries} />

            <View style={styles.listSection}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Next up</Text>
                <Text style={styles.caption}>{upcomingEntries.length} events</Text>
              </View>
              {upcomingEntries.length === 0 ? (
                <Text style={styles.emptyLine}>No upcoming competitions.</Text>
              ) : (
                upcomingEntries.map((entry) => (
                  <CompetitionCard key={entry.id} entry={entry} />
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
                            <CompetitionCard key={entry.id} entry={entry} />
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
    fontSize: 26,
    fontWeight: "700",
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
    backgroundColor: "#181b1f",
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 11,
    backgroundColor: "#181b1f",
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
