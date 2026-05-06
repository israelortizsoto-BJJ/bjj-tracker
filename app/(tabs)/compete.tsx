import { router, type Href } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { localTodayDateKey, toDateKey } from "@/src/_domain/dateKey";
import { CompetitionCard } from "@/src/features/competition/CompetitionCard";
import { MedalCollection } from "@/src/features/competition/MedalCollection";
import type { CompeteKidEntryMerged } from "@/src/features/competition/MedalGallery";
import { getKidCompetitionEntriesWithMatchDetailForKid } from "@/src/storage/competitionStore";
import { getKidsById } from "@/src/storage/coachKidStore";
import type { KidsById } from "@/src/types/coachKid";
import { useDerivedActiveAthleteKidId } from "@/src/state/derivedActiveAthleteKid";

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
  const [kidsById, setKidsById] = useState<KidsById>({});
  const [entries, setEntries] = useState<CompeteKidEntryMerged[]>([]);
  const [expandedMonthKey, setExpandedMonthKey] = useState<string | null>(null);
  const { kidId, persistenceHydrated } = useDerivedActiveAthleteKidId(kidsById, null);

  const loadKids = useCallback(async () => {
    setKidsById(await getKidsById());
  }, []);

  const loadCompetitions = useCallback(async () => {
    if (!kidId) {
      setEntries([]);
      return;
    }
    const merged = await getKidCompetitionEntriesWithMatchDetailForKid(kidId);
    setEntries(merged);
  }, [kidId]);

  useFocusEffect(
    useCallback(() => {
      void loadKids();
    }, [loadKids]),
  );

  useFocusEffect(
    useCallback(() => {
      void loadCompetitions();
    }, [loadCompetitions]),
  );

  const noKidSelected = persistenceHydrated && !kidId;
  const visibleEntries = useMemo(
    () => entries.filter((entry) => entry.kidId === kidId),
    [entries, kidId],
  );
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
        <View style={styles.status}>
          <Text style={styles.statusText}>9:41</Text>
          <Text style={styles.statusText}>5G 82%</Text>
        </View>
        <View style={styles.appTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>MM</Text>
          </View>
          <View style={styles.iconRow}>
            <View style={styles.iconBtn}>
              <Text style={styles.iconText}>▣</Text>
            </View>
            <Pressable
              style={styles.iconBtn}
              disabled={!kidId}
              onPress={() => {
                if (!kidId) return;
                router.push(
                  `/this-week/kid/${kidId}/competition/edit?openNonce=${Date.now()}` as Href,
                );
              }}
            >
              <Text style={styles.iconText}>＋</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.screenTitle}>
          <Text style={styles.caption}>Competition</Text>
          <Text style={styles.h2}>Events and matches</Text>
        </View>

        {noKidSelected ? (
          <View style={styles.twEmptyCard}>
            <Text style={styles.twEmptyTitle}>No athlete selected</Text>
            <Text style={styles.twEmptySubtitle}>Select an athlete to view competition history</Text>
            <Pressable
              onPress={() => router.push("/this-week/kids")}
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
              <Text style={styles.twEmptyButtonLabel}>Select Athlete</Text>
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
