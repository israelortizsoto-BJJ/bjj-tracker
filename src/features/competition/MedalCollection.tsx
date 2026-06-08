import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { isCompetitionMatchUiAvailableForEventDate } from "../../_domain/dateKey";
import { competeMedalTierFromKidEntry, type KidCompetitionMedalTier } from "../../types/coachKid";
import { CompetitionMedalMark, type CompeteKidEntryMerged } from "./MedalGallery";

const FEED = {
  panel: "#181b1f",
  panel2: "#20242a",
  line: "rgba(236, 241, 245, 0.12)",
  text: "#f2f4f6",
  muted: "#a9b0b8",
  accentText: "#eaff9d",
  radius: 6,
} as const;

type MedalYearGroup = {
  year: string;
  entries: CompeteKidEntryMerged[];
};

function isPodiumTier(tier: KidCompetitionMedalTier): boolean {
  return tier === "gold" || tier === "silver" || tier === "bronze";
}

function eventYear(entry: CompeteKidEntryMerged): string {
  const date = entry.eventDate.trim();
  if (/^\d{4}/.test(date)) return date.slice(0, 4);
  return new Date(entry.createdAt).getFullYear().toString();
}

function eventTime(entry: CompeteKidEntryMerged): number {
  const t = new Date(`${entry.eventDate.trim().slice(0, 10)}T12:00:00`).getTime();
  if (Number.isFinite(t)) return t;
  const created = new Date(entry.createdAt).getTime();
  return Number.isFinite(created) ? created : 0;
}

/** Compact date under medal tiles — reinforces chronological flow within each year. */
function formatMedalTileDate(eventDate: string): string {
  const trimmed = eventDate.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, mo, d] = trimmed.split("-").map(Number);
    return new Date(y, mo - 1, d).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }
  const t = trimmed.length > 0 ? trimmed : eventDate.trim();
  return t;
}

function compareEntriesByDateDesc(a: CompeteKidEntryMerged, b: CompeteKidEntryMerged): number {
  const tb = eventTime(b);
  const ta = eventTime(a);
  if (tb !== ta) return tb - ta;
  const cb = new Date(b.createdAt).getTime();
  const ca = new Date(a.createdAt).getTime();
  const fb = Number.isFinite(cb) ? cb : 0;
  const fa = Number.isFinite(ca) ? ca : 0;
  return fb - fa;
}

function buildMedalYearGroups(entries: CompeteKidEntryMerged[]): MedalYearGroup[] {
  const podiumEntries = entries.filter((entry) => {
    if (!isCompetitionMatchUiAvailableForEventDate(entry.eventDate)) return false;
    return isPodiumTier(competeMedalTierFromKidEntry(entry));
  });

  const byYear = new Map<string, CompeteKidEntryMerged[]>();

  for (const entry of podiumEntries) {
    const year = eventYear(entry);
    const existing = byYear.get(year);
    if (existing) existing.push(entry);
    else byYear.set(year, [entry]);
  }

  return Array.from(byYear.entries())
    .sort(([yearA], [yearB]) => {
      const ya = parseInt(yearA, 10);
      const yb = parseInt(yearB, 10);
      if (Number.isFinite(ya) && Number.isFinite(yb)) return yb - ya;
      return yearB.localeCompare(yearA);
    })
    .map(([year, yearEntries]) => ({
      year,
      entries: [...yearEntries].sort(compareEntriesByDateDesc),
    }));
}

export function MedalCollection({
  entries,
  onOpenEntry,
}: {
  entries: CompeteKidEntryMerged[];
  onOpenEntry: (entry: CompeteKidEntryMerged) => void;
}) {
  const yearGroups = useMemo(() => buildMedalYearGroups(entries), [entries]);
  const podiumCount = useMemo(
    () => yearGroups.reduce((n, g) => n + g.entries.length, 0),
    [yearGroups],
  );
  const totalCompetitions = entries.length;
  const hasCompetitions = totalCompetitions > 0;
  const hasPodiumMedals = yearGroups.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>Record archive</Text>
        <Text style={styles.sectionTitle}>Podium record</Text>
        {hasCompetitions ? (
          <Text style={styles.subtitle}>
            {podiumCount} podium {podiumCount === 1 ? "finish" : "finishes"} out of{" "}
            {totalCompetitions}{" "}
            {totalCompetitions === 1 ? "competition" : "competitions"}
          </Text>
        ) : null}
      </View>

      {!hasCompetitions ? (
        <Text style={styles.emptyMessage}>No competitions yet</Text>
      ) : !hasPodiumMedals ? (
        <Text style={styles.emptyMessage}>No podium finishes yet</Text>
      ) : (
        <>
          {yearGroups.map((group) => (
            <View key={group.year} style={styles.yearGroup}>
              <Text style={styles.yearLabel}>{group.year}</Text>
              <View style={styles.grid}>
                {group.entries.map((entry) => {
                  const medal = competeMedalTierFromKidEntry(entry);
                  return (
                    <Pressable
                      key={entry.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${entry.tournamentName}`}
                      onPress={() => onOpenEntry(entry)}
                      style={({ pressed }) => [
                        styles.medalTile,
                        pressed ? styles.medalTilePressed : styles.medalTileIdle,
                      ]}
                    >
                      <CompetitionMedalMark
                        medal={medal}
                        medalImageUri={entry.medalImageUri}
                        size={42}
                      />
                      <Text style={styles.tileDate}>{formatMedalTileDate(entry.eventDate)}</Text>
                      <Text style={styles.tileCaption} numberOfLines={2}>
                        {entry.tournamentName.trim() || "Competition"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          <View style={styles.sourceNote}>
            <Text style={styles.sourceNoteText}>
              Each medal image is tied to a saved competition entry.
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    marginBottom: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: FEED.line,
    borderRadius: FEED.radius,
    backgroundColor: FEED.panel,
  },
  headerBlock: {
    marginBottom: 3,
  },
  eyebrow: {
    color: FEED.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  sectionTitle: {
    marginTop: 5,
    color: FEED.text,
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 0,
  },
  subtitle: {
    marginTop: 4,
    color: FEED.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  emptyMessage: {
    marginTop: 16,
    color: FEED.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  yearGroup: {
    marginTop: 13,
  },
  yearLabel: {
    color: FEED.text,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 15,
  },
  medalTile: {
    width: "23%",
    minHeight: 104,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(236, 241, 245, 0.14)",
    borderRadius: FEED.radius,
    backgroundColor: "#161a1f",
  },
  medalTileIdle: {
    opacity: 1,
    transform: [{ scale: 1 }],
  },
  medalTilePressed: {
    opacity: 0.82,
    transform: [{ scale: 0.94 }],
  },
  tileDate: {
    marginTop: 7,
    color: FEED.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  tileCaption: {
    marginTop: 4,
    color: FEED.muted,
    fontSize: 10,
    lineHeight: 13,
    textAlign: "center",
    fontWeight: "700",
  },
  sourceNote: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: FEED.radius,
  },
  sourceNoteText: {
    color: FEED.muted,
    fontSize: 12,
    fontWeight: "800",
  },
});
