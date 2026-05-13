import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
import {
  competeMedalTierFromKidEntry,
  type KidCompetitionEntry,
  type KidCompetitionMedalTier,
} from "../../types/coachKid";

import { getPlacementLabel } from "./placementLabel";

const FEED = {
  panel: "#181b1f",
  panel2: "#20242a",
  line: "rgba(236, 241, 245, 0.12)",
  text: "#f2f4f6",
  muted: "#a9b0b8",
  accentText: "#eaff9d",
  radius: 6,
};

export type CompeteKidEntryMerged = KidCompetitionEntry & {
  matches: CompetitionDetailMatchSnapshot[];
};

export const SYSTEM_MEDAL_BACKGROUND: Record<KidCompetitionMedalTier, string> = {
  gold: "#8a6a2b",
  silver: "#64748b",
  bronze: "#7c4a2c",
  participated: "#334155",
};

/** Short placement label when no photo (colors still encode tier). */
export function competitionMedalFallbackLabel(medal: KidCompetitionMedalTier): string {
  return getPlacementLabel(medal);
}

function fallbackMedalBorderColor(medal: KidCompetitionMedalTier): string {
  if (medal === "gold") return "rgba(200, 162, 74, 0.65)";
  if (medal === "silver") return "rgba(203, 213, 225, 0.55)";
  if (medal === "bronze") return "rgba(201, 129, 67, 0.65)";
  return "rgba(148, 163, 184, 0.35)";
}

export function normalizedCompetitionMedalImageUri(uri: string | undefined): string | undefined {
  if (typeof uri !== "string") return undefined;
  const trimmed = uri.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function systemLetterColor(medal: KidCompetitionMedalTier): string {
  if (medal === "participated") return FEED.text;
  return FEED.text;
}

/** Shared medal visuals: user photo preserves natural aspect (no circular mask); fallback uses tier badge. */
export function CompetitionMedalMark({
  medal,
  medalImageUri,
  size,
}: {
  medal: KidCompetitionMedalTier;
  medalImageUri?: string;
  size: number;
}) {
  const uri = normalizedCompetitionMedalImageUri(medalImageUri);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        resizeMode="contain"
        style={{
          width: size,
          height: size,
          borderRadius: FEED.radius,
        }}
      />
    );
  }

  const backgroundColor = SYSTEM_MEDAL_BACKGROUND[medal];
  const label = competitionMedalFallbackLabel(medal);
  const fontSize = Math.max(9, Math.round(size * (medal === "participated" ? 0.22 : 0.25)));

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: FEED.radius,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor,
        borderWidth: 1,
        borderColor: fallbackMedalBorderColor(medal),
        paddingHorizontal: 4,
      }}
    >
      <Text
        style={{
          fontWeight: "900",
          fontSize,
          lineHeight: Math.round(fontSize * 1.15),
          color: systemLetterColor(medal),
          textAlign: "center",
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {label}
      </Text>
    </View>
  );
}

function competeEntrySortTime(entry: KidCompetitionEntry): number {
  const iso = `${entry.eventDate.trim()}T12:00:00`;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function sortedCompeteEntries(entries: CompeteKidEntryMerged[]): CompeteKidEntryMerged[] {
  return [...entries].sort((a, b) => {
    const ta = competeEntrySortTime(a);
    const tb = competeEntrySortTime(b);
    if (tb !== ta) return tb - ta;
    const ca = new Date(a.createdAt).getTime();
    const cb = new Date(b.createdAt).getTime();
    const fa = Number.isFinite(ca) ? ca : 0;
    const fb = Number.isFinite(cb) ? cb : 0;
    return fb - fa;
  });
}

export function MedalGallery({ entries }: { entries: CompeteKidEntryMerged[] }) {
  const medalItems = sortedCompeteEntries(entries);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.h3}>Medal Gallery</Text>
        <Text style={styles.caption}>Motivation layer</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.medalScroll}>
        {medalItems.map((entry) => {
          const medal = competeMedalTierFromKidEntry(entry);
          const key = entry.id;
          return (
            <View key={key} style={styles.medalTile}>
              <CompetitionMedalMark medal={medal} medalImageUri={entry.medalImageUri} size={34} />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: FEED.line,
    borderRadius: FEED.radius,
    backgroundColor: FEED.panel,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  h3: {
    color: FEED.text,
    fontSize: 15,
    fontWeight: "900",
  },
  caption: {
    color: FEED.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  medalScroll: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingRight: 8,
  },
  medalTile: {
    width: 72,
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FEED.line,
    borderRadius: FEED.radius,
    backgroundColor: FEED.panel2,
    flexShrink: 0,
  },
});
