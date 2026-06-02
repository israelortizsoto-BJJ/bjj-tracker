import { Pressable, StyleSheet, Text, View } from "react-native";

import { isCompetitionMatchUiAvailableForEventDate } from "../../_domain/dateKey";
import { useDeviceRole } from "../../deviceRole/DeviceRoleProvider";
import { projectCompetitionCompeteView } from "../../domain/competition/projectCompetitionCompeteView";
import { peekCoachCompetitionTopology } from "../../storage/coachCompetitionTopologyStore";
import { competeMedalTierFromKidEntry, type KidCompetitionMedalTier } from "../../types/coachKid";
import { CompetitionMedalMark, type CompeteKidEntryMerged } from "./MedalGallery";
import { MatchCard } from "./MatchCard";
import { getPlacementLabel } from "./placementLabel";

const FEED = {
  panel: "#181b1f",
  line: "rgba(236, 241, 245, 0.12)",
  text: "#f2f4f6",
  muted: "#a9b0b8",
  radius: 6,
};

function cardBorderColor(medal: KidCompetitionMedalTier): string {
  if (medal === "gold") return "rgba(200, 162, 74, 0.24)";
  if (medal === "silver") return "rgba(203, 213, 225, 0.24)";
  if (medal === "bronze") return "rgba(201, 129, 67, 0.24)";
  return FEED.line;
}

export function CompetitionCard({
  entry,
  onOpenEntry,
}: {
  entry: CompeteKidEntryMerged;
  onOpenEntry: (entry: CompeteKidEntryMerged) => void;
}) {
  const { role: deviceRole } = useDeviceRole();
  const projectedEntry =
    deviceRole === "coach"
      ? projectCompetitionCompeteView({
          shell: entry,
          topologyArtifact: peekCoachCompetitionTopology(entry.sharedAthleteId ?? ""),
          overlayAnnotations: entry.matches.map((match) => ({
            matchLineageKey: match.id,
            coachNote: match.coachNote,
          })),
          fallbackMatches: entry.matches,
        })
      : entry;
  const tier = competeMedalTierFromKidEntry(entry);
  const isPastCompetition = isCompetitionMatchUiAvailableForEventDate(entry.eventDate);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${entry.tournamentName}`}
      onPress={() => onOpenEntry(entry)}
      style={({ pressed }) => [
        styles.card,
        { borderColor: cardBorderColor(tier), opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.titleBlock}>
          <Text style={styles.h3}>{entry.tournamentName}</Text>
          <Text style={styles.meta}>
            {[entry.organizationOrPromoter, entry.eventDate].filter(Boolean).join(" • ")}
          </Text>
        </View>
        {isPastCompetition ? (
          <CompetitionMedalMark medal={tier} medalImageUri={entry.medalImageUri} size={38} />
        ) : null}
      </View>

      {isPastCompetition ? (
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>Result: {getPlacementLabel(tier)}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>Saved locally</Text>
          </View>
        </View>
      ) : (
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>Upcoming</Text>
          </View>
        </View>
      )}

      {isPastCompetition ? (
        <View style={styles.matchList}>
          {projectedEntry.matches.map((match, index) => (
            <MatchCard key={match.id} snapshot={match} index={index} />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: FEED.radius,
    backgroundColor: FEED.panel,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  titleBlock: {
    flex: 1,
  },
  h3: {
    color: FEED.text,
    fontSize: 14,
    fontWeight: "900",
  },
  meta: {
    marginTop: 5,
    color: FEED.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  chip: {
    minHeight: 22,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: FEED.line,
    borderRadius: FEED.radius,
  },
  chipText: {
    color: FEED.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  matchList: {
    gap: 9,
    marginTop: 12,
  },
});
