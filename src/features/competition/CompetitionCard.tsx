import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { isCompetitionMatchUiAvailableForEventDate } from "../../_domain/dateKey";
import { useDeviceRole } from "../../deviceRole/DeviceRoleProvider";
import { hydrateCompetitionMatchOverlayAnnotations } from "../../domain/competition/hydrateCompetitionMatchOverlayAnnotations";
import {
  mergeCoachBreakdownIntoMatches,
  overlayAnnotationsFromCoachMatchBreakdownArtifactSet,
} from "../../domain/competition/mergeCoachBreakdownIntoMatches";
import {
  projectCompetitionCompeteView,
  type CompetitionMatchOverlayAnnotation,
} from "../../domain/competition/projectCompetitionCompeteView";
import { getCoachMatchBreakdownArtifactSet } from "../../storage/coachMatchBreakdownArtifactStore";
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
  const sharedAthleteId = entry.sharedAthleteId ?? "";
  const sharedCompetitionId = entry.sharedCompetitionId ?? "";
  const topologyArtifact = peekCoachCompetitionTopology(sharedAthleteId);
  const topology = topologyArtifact?.competitions.find(
    (competition) => competition.sharedCompetitionId === sharedCompetitionId,
  );
  const entryMatchLineageKeys = entry.matches.map((match) => match.id);
  const matchLineageKeys =
    topology?.matches.map((match) => match.matchLineageKey) ?? entryMatchLineageKeys;
  const matchLineageSignature = matchLineageKeys.join("\u0000");
  const overlayHydrationKey = JSON.stringify([
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageSignature,
  ]);
  const [hydratedOverlayState, setHydratedOverlayState] = useState<{
    key: string;
    annotations: CompetitionMatchOverlayAnnotation[];
  } | null>(null);

  console.log("[COACH_OVERLAY_SYNC_TRACE]", {
    stage: "competition_card_render_gate",
    deviceRole,
    sharedAthleteId: sharedAthleteId || null,
    sharedCompetitionId: sharedCompetitionId || null,
    lineageIds: matchLineageKeys,
    hydrateEligible: deviceRole === "coach" || deviceRole === "parent",
    topologyMatchCount: matchLineageKeys.length,
    entryMatchCount: entry.matches.length,
    parentRenderCount: entry.matches.filter((match) => (match.coachNote ?? "").trim().length > 0)
      .length,
    gate:
      deviceRole === "coach"
        ? "coach_local_hydrate_enabled"
        : deviceRole === "parent"
          ? "parent_remote_hydrate_enabled"
          : "unsupported_role",
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setHydratedOverlayState(null);
      if (deviceRole === "parent") {
        void getCoachMatchBreakdownArtifactSet(sharedAthleteId)
          .then((artifactSet) => {
            const annotations = overlayAnnotationsFromCoachMatchBreakdownArtifactSet({
              artifactSet,
              sharedAthleteId,
              sharedCompetitionId,
              matchLineageKeys: matchLineageSignature ? matchLineageSignature.split("\u0000") : [],
            });
            console.log("[COACH_OVERLAY_SYNC_TRACE]", {
              stage: "competition_card_parent_hydrate_complete",
              deviceRole,
              sharedAthleteId: sharedAthleteId || null,
              sharedCompetitionId: sharedCompetitionId || null,
              lineageIds: matchLineageSignature ? matchLineageSignature.split("\u0000") : [],
              hydrateCount: annotations.length,
            });
            if (active) setHydratedOverlayState({ key: overlayHydrationKey, annotations });
          })
          .catch(() => {
            console.log("[COACH_OVERLAY_SYNC_TRACE]", {
              stage: "competition_card_parent_hydrate_failed",
              deviceRole,
              sharedAthleteId: sharedAthleteId || null,
              sharedCompetitionId: sharedCompetitionId || null,
              lineageIds: matchLineageSignature ? matchLineageSignature.split("\u0000") : [],
              hydrateCount: 0,
            });
            if (active) setHydratedOverlayState({ key: overlayHydrationKey, annotations: [] });
          });
        return () => {
          active = false;
        };
      }
      if (deviceRole !== "coach") {
        console.log("[COACH_OVERLAY_SYNC_TRACE]", {
          stage: "competition_card_hydrate_gated",
          deviceRole,
          sharedAthleteId: sharedAthleteId || null,
          sharedCompetitionId: sharedCompetitionId || null,
          lineageIds: matchLineageSignature ? matchLineageSignature.split("\u0000") : [],
          hydrateCount: 0,
          reason: "device_role_not_supported",
        });
        return () => {};
      }
      void hydrateCompetitionMatchOverlayAnnotations({
        sharedAthleteId,
        sharedCompetitionId,
        matchLineageKeys: matchLineageSignature ? matchLineageSignature.split("\u0000") : [],
      })
        .then((annotations) => {
          console.log("[COACH_OVERLAY_SYNC_TRACE]", {
            stage: "competition_card_hydrate_complete",
            deviceRole,
            sharedAthleteId: sharedAthleteId || null,
            sharedCompetitionId: sharedCompetitionId || null,
            lineageIds: matchLineageSignature ? matchLineageSignature.split("\u0000") : [],
            hydrateCount: annotations.length,
          });
          if (active) setHydratedOverlayState({ key: overlayHydrationKey, annotations });
        })
        .catch(() => {
          console.log("[COACH_OVERLAY_SYNC_TRACE]", {
            stage: "competition_card_hydrate_failed",
            deviceRole,
            sharedAthleteId: sharedAthleteId || null,
            sharedCompetitionId: sharedCompetitionId || null,
            lineageIds: matchLineageSignature ? matchLineageSignature.split("\u0000") : [],
            hydrateCount: 0,
          });
          if (active) setHydratedOverlayState({ key: overlayHydrationKey, annotations: [] });
        });
      return () => {
        active = false;
      };
    }, [
      deviceRole,
      matchLineageSignature,
      overlayHydrationKey,
      sharedAthleteId,
      sharedCompetitionId,
    ]),
  );

  const legacyOverlayAnnotations = entry.matches.map((match) => ({
    matchLineageKey: match.id,
    coachNote: match.coachNote,
  }));
  const hydratedOverlayAnnotations =
    hydratedOverlayState?.key === overlayHydrationKey ? hydratedOverlayState.annotations : null;
  const projectedEntry =
    deviceRole === "coach"
      ? projectCompetitionCompeteView({
          shell: entry,
          topologyArtifact,
          overlayAnnotations:
            hydratedOverlayAnnotations?.length ? hydratedOverlayAnnotations : legacyOverlayAnnotations,
          fallbackMatches: entry.matches,
        })
      : deviceRole === "parent"
        ? {
            ...entry,
            matches: mergeCoachBreakdownIntoMatches({
              matches: entry.matches,
              overlayAnnotations: hydratedOverlayAnnotations ?? [],
              sharedAthleteId,
              sharedCompetitionId,
            }),
          }
      : entry;
  console.log("[COACH_OVERLAY_SYNC_TRACE]", {
    stage: "competition_card_projected_render",
    deviceRole,
    sharedAthleteId: sharedAthleteId || null,
    sharedCompetitionId: sharedCompetitionId || null,
    artifactCount:
      deviceRole === "coach"
        ? (hydratedOverlayAnnotations?.length ?? legacyOverlayAnnotations.filter((a) => a.coachNote?.trim()).length)
        : deviceRole === "parent"
          ? (hydratedOverlayAnnotations?.length ?? 0)
        : 0,
    mergeCount: projectedEntry.matches.filter((match) => (match.coachNote ?? "").trim().length > 0)
      .length,
    parentRenderCount:
      deviceRole === "parent"
        ? projectedEntry.matches.filter((match) => (match.coachNote ?? "").trim().length > 0).length
        : 0,
  });
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
