import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { CompetitionDetailMatchSnapshot } from "../../storage/competitionStore";
import { labelForSubmissionTypeKey } from "./submissionTypes";

const FEED = {
  panel: "#181b1f",
  panel2: "#20242a",
  line: "rgba(236, 241, 245, 0.12)",
  text: "#f2f4f6",
  muted: "#a9b0b8",
  win: "#eaff9d",
  loss: "#ffc7ca",
  radius: 6,
};

function videoLabel(snapshot: CompetitionDetailMatchSnapshot): string {
  const u = typeof snapshot.videoUri === "string" ? snapshot.videoUri.trim() : "";
  return u.length > 0 ? "Attached" : "None";
}

export function MatchCard({
  snapshot,
  index,
}: {
  snapshot: CompetitionDetailMatchSnapshot;
  index: number;
}) {
  const won = snapshot.matchResult === "win";
  const [coachBreakdownExpanded, setCoachBreakdownExpanded] = useState(false);
  const coachBreakdown = snapshot.coachNote?.trim() ?? "";

  const methodLines: string[] = [];
  if (snapshot.outcome) {
    if (snapshot.outcome === "Submission" && snapshot.submissionTime?.trim()) {
      methodLines.push(`${snapshot.outcome} · ${snapshot.submissionTime.trim()}`);
    } else {
      methodLines.push(snapshot.outcome);
    }
  }
  const subLabel = labelForSubmissionTypeKey(
    typeof snapshot.submissionType === "string" ? snapshot.submissionType : null,
  );

  return (
    <View style={styles.match}>
      <View style={styles.row}>
        <Text style={styles.matchTitle}>Match {index + 1}</Text>
        {snapshot.matchResult === null ? (
          <View style={[styles.pill, styles.pillUnknown]}>
            <Text style={styles.pillText}>—</Text>
          </View>
        ) : (
          <View style={[styles.pill, won ? styles.pillWin : styles.pillLoss]}>
            <Text style={[styles.pillText, won ? styles.pillWinText : styles.pillLossText]}>
              {won ? "Win" : "Loss"}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.matchFields}>
        <View style={styles.matchField}>
          <Text style={styles.label}>How it ended</Text>
          <Text style={styles.value}>{methodLines.length ? methodLines.join("\n") : "None"}</Text>
        </View>
        <View style={styles.matchField}>
          <Text style={styles.label}>Submission type</Text>
          <Text style={styles.value}>
            {snapshot.outcome === "Submission"
              ? subLabel ?? "—"
              : "—"}
          </Text>
        </View>
        <View style={styles.matchField}>
          <Text style={styles.label}>Submission time</Text>
          <Text style={styles.value}>
            {snapshot.outcome === "Submission" ? snapshot.submissionTime?.trim() || "None" : "—"}
          </Text>
        </View>
        <View style={styles.matchField}>
          <Text style={styles.label}>Image</Text>
          <Text style={styles.value}>
            {typeof snapshot.imageUri === "string" && snapshot.imageUri.trim().length > 0
              ? "Attached"
              : "None"}
          </Text>
        </View>
        <View style={styles.matchField}>
          <Text style={styles.label}>Video</Text>
          <Text style={styles.value}>{videoLabel(snapshot)}</Text>
        </View>
      </View>
      {coachBreakdown ? (
        <View style={styles.coachSection}>
          <Text style={styles.coachLabel}>Coach Match Breakdown</Text>
          <Text
            numberOfLines={coachBreakdownExpanded ? undefined : 3}
            style={styles.coachText}
          >
            {coachBreakdown}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${coachBreakdownExpanded ? "Collapse" : "Read more"} coach match breakdown for match ${index + 1}`}
            onPress={() => setCoachBreakdownExpanded((expanded) => !expanded)}
            style={({ pressed }) => [styles.readMore, pressed ? styles.readMorePressed : null]}
          >
            <Text style={styles.readMoreText}>
              {coachBreakdownExpanded ? "Show Less" : "Read More"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  match: {
    padding: 11,
    borderWidth: 1,
    borderColor: FEED.line,
    borderRadius: FEED.radius,
    backgroundColor: FEED.panel2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  matchTitle: {
    color: FEED.text,
    fontSize: 14,
    fontWeight: "900",
  },
  pill: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: FEED.radius,
    borderWidth: 1,
  },
  pillUnknown: {
    borderColor: FEED.line,
  },
  pillWin: {
    borderColor: "rgba(214, 255, 63, 0.32)",
  },
  pillLoss: {
    borderColor: "rgba(216, 77, 85, 0.34)",
  },
  pillText: {
    fontSize: 11,
    fontWeight: "800",
    color: FEED.muted,
  },
  pillWinText: {
    color: FEED.win,
  },
  pillLossText: {
    color: FEED.loss,
  },
  matchFields: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  matchField: {
    width: "48%",
    padding: 8,
    borderWidth: 1,
    borderColor: FEED.line,
    borderRadius: FEED.radius,
    backgroundColor: FEED.panel,
  },
  label: {
    marginTop: 3,
    color: FEED.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  value: {
    marginTop: 4,
    color: FEED.text,
    fontSize: 13,
    fontWeight: "900",
  },
  coachSection: {
    marginTop: 9,
    padding: 10,
    borderWidth: 1,
    borderColor: FEED.line,
    borderRadius: FEED.radius,
    backgroundColor: FEED.panel,
  },
  coachLabel: {
    color: FEED.text,
    fontSize: 12,
    fontWeight: "900",
  },
  coachText: {
    marginTop: 7,
    color: FEED.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  readMore: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 4,
  },
  readMorePressed: {
    opacity: 0.76,
  },
  readMoreText: {
    color: FEED.text,
    fontSize: 12,
    fontWeight: "900",
  },
});
