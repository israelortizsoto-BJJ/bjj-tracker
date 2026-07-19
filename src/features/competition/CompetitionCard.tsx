import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { isCompetitionMatchUiAvailableForEventDate } from "../../_domain/dateKey";
import { useDeviceRole } from "../../deviceRole/DeviceRoleProvider";
import { hydrateCompetitionMatchOverlayAnnotations } from "../../domain/competition/hydrateCompetitionMatchOverlayAnnotations";
import {
  mergeCoachBreakdownIntoMatches,
  overlayAnnotationsFromCoachMatchBreakdownArtifactSet,
} from "../../domain/competition/mergeCoachBreakdownIntoMatches";
import {
  competitionOverlayAnnotationsFromEmbeddedMatches,
  projectCompetitionCompeteView,
  selectCompetitionOverlayAnnotations,
  type CompetitionMatchOverlayAnnotation,
} from "../../domain/competition/projectCompetitionCompeteView";
import { getCoachMatchBreakdownArtifactSet } from "../../storage/coachMatchBreakdownArtifactStore";
import { useCoachSyncHydrationVersion } from "../../storage/coachSyncHydrationStore";
import { peekCoachCompetitionTopology } from "../../storage/coachCompetitionTopologyStore";
import {
  getCompetitionVersion,
  subscribeCompetition,
} from "../../storage/kidCompetitionStore";
import { competeMedalTierFromKidEntry, type KidCompetitionMedalTier } from "../../types/coachKid";
import { logBreakdownPropagationForMatch } from "../../domain/competition/competitionProjectionBreakdownTrace";
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
  const coachSyncHydrationVersion = useCoachSyncHydrationVersion();
  const competitionVersion = useSyncExternalStore(
    subscribeCompetition,
    getCompetitionVersion,
    getCompetitionVersion,
  );
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
      coachSyncHydrationVersion,
      competitionVersion,
      deviceRole,
      matchLineageSignature,
      overlayHydrationKey,
      sharedAthleteId,
      sharedCompetitionId,
    ]),
  );

  const hydratedOverlayAnnotations =
    hydratedOverlayState?.key === overlayHydrationKey ? hydratedOverlayState.annotations : null;
  const legacyOverlayAnnotations =
    competitionOverlayAnnotationsFromEmbeddedMatches(entry.matches);
  const coachOverlaySelection = selectCompetitionOverlayAnnotations({
    hydratedAnnotations: hydratedOverlayAnnotations,
    embeddedAnnotations: legacyOverlayAnnotations,
  });
  const hydrationKeyMismatch =
    hydratedOverlayState !== null && hydratedOverlayState.key !== overlayHydrationKey;
  const hydrationPending = hydratedOverlayState === null;
  const staleEntryCoachNotesInShell = entry.matches.filter(
    (match) => (match.coachNote ?? "").trim().length > 0,
  ).length;

  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: "competition_detail_render_selector",
    deviceRole,
    entryId: entry.id,
    sharedAthleteId: sharedAthleteId || null,
    sharedCompetitionId: sharedCompetitionId || null,
    entryUpdatedAt: entry.updatedAt ?? null,
    hydrationKey: overlayHydrationKey,
    hydratedStateKey: hydratedOverlayState?.key ?? null,
    hydrationKeyMismatch,
    hydrationPending: hydratedOverlayState === null,
    hydrateEligible: deviceRole === "coach" || deviceRole === "parent",
    topologyPresent: Boolean(topology),
    topologyMatchCount: topology?.matches.length ?? 0,
    entryMatchCount: entry.matches.length,
    matchLineageKeys,
    slotKeys: matchLineageKeys.map((key) => {
      const slotMatch = /-slot-(\d+)$/.exec(key.trim());
      return slotMatch ? `slot-${slotMatch[1]}` : null;
    }),
    entryMatchIds: entry.matches.map((match) => match.id),
    staleShellCoachNoteCount: staleEntryCoachNotesInShell,
    hydratedOverlayCount: hydratedOverlayAnnotations?.length ?? null,
    legacyOverlayCount: legacyOverlayAnnotations.filter((a) => a.coachNote?.trim()).length,
    readingStaleCompetitionShell:
      staleEntryCoachNotesInShell > 0 &&
      deviceRole === "parent" &&
      (hydratedOverlayAnnotations?.length ?? 0) === 0,
  });

  const projectedEntry =
    deviceRole === "coach"
      ? projectCompetitionCompeteView({
          shell: entry,
          topologyArtifact,
          overlayAnnotations: coachOverlaySelection.annotations,
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
  console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
    stage: "competition_detail_render_projected",
    deviceRole,
    entryId: entry.id,
    sharedAthleteId: sharedAthleteId || null,
    sharedCompetitionId: sharedCompetitionId || null,
    projectedMatchCount: projectedEntry.matches.length,
    projectedCoachNoteCount: projectedEntry.matches.filter((m) => (m.coachNote ?? "").trim()).length,
    projectedMatchIds: projectedEntry.matches.map((m) => m.id),
    projectedCoachNoteMatchIds: projectedEntry.matches
      .filter((m) => (m.coachNote ?? "").trim())
      .map((m) => m.id),
    overlaySource:
      deviceRole === "parent"
        ? hydratedOverlayAnnotations
          ? "hydrated_artifacts"
          : hydrationPending
            ? "hydration_pending"
            : "empty_hydration"
        : deviceRole === "coach"
          ? hydratedOverlayAnnotations?.length
            ? "hydrated_overlays"
            : legacyOverlayAnnotations.some((a) => a.coachNote?.trim())
              ? "legacy_shell_coach_notes"
              : hydrationPending
                ? "hydration_pending"
                : "empty_hydration"
          : "unsupported_role",
    overlaysSkippedReason:
      deviceRole === "parent" && !hydratedOverlayAnnotations?.length
        ? hydrationPending
          ? "awaiting_async_hydration"
          : hydrationKeyMismatch
            ? "hydration_key_mismatch"
            : "no_matching_artifacts_for_competition"
        : null,
  });
  console.log("[COACH_COMPETE_DETAIL_TRACE]", {
    stage: "card_projected_render",
    deviceRole,
    entryId: entry.id,
    sharedAthleteId: sharedAthleteId || null,
    sharedCompetitionId: sharedCompetitionId || null,
    topologyPresent: Boolean(topology),
    topologyUpdatedAt: topologyArtifact?.updatedAt ?? null,
    topologyMatchCount: topology?.matches.length ?? 0,
    fallbackMatchCount: entry.matches.length,
    projectedMatchCount: projectedEntry.matches.length,
    projectedMatchIds: projectedEntry.matches.map((match) => match.id),
    projectionSource:
      deviceRole === "coach" && topology ? "coach_topology" : "fallback_detail",
  });
  console.log("[COACH_TOPOLOGY_MATCH_TRACE]", {
    stage: "coach_compete_render",
    sharedCompetitionId: sharedCompetitionId || null,
    updatedAt: topologyArtifact?.updatedAt ?? null,
    matchCount: projectedEntry.matches.length,
    firstFiveMatchIds: projectedEntry.matches.slice(0, 5).map((match) => match.id),
    firstFiveMatchResults: projectedEntry.matches
      .slice(0, 5)
      .map((match) => match.matchResult),
    accepted: deviceRole === "coach" ? Boolean(topology) : true,
    overwriteReason:
      deviceRole === "coach" && topology ? "topology_rendered" : "fallback_or_parent_render",
  });
  for (const match of projectedEntry.matches) {
    const coachNote = match.coachNote?.trim();
    console.log("[COACH_OVERLAY_PIPELINE_TRACE]", {
      stage: coachNote ? "competition_detail_match_overlay_present" : "competition_detail_match_overlay_absent",
      sharedAthleteId: sharedAthleteId || null,
      sharedCompetitionId: sharedCompetitionId || null,
      matchLineageKey: match.id,
      matchId: match.id,
      hasCoachNote: Boolean(coachNote),
      deviceRole,
      entryId: entry.id,
    });
  }
  const tier = competeMedalTierFromKidEntry(entry);
  const isPastCompetition = isCompetitionMatchUiAvailableForEventDate(entry.eventDate);
  const breakdownOverlaySource =
    deviceRole === "parent"
      ? hydratedOverlayAnnotations
        ? "hydrated_artifacts"
        : hydrationPending
          ? "hydration_pending"
          : "empty_hydration"
      : deviceRole === "coach"
        ? coachOverlaySelection.source === "hydrated_annotations"
          ? "hydrated_overlays"
          : coachOverlaySelection.source === "embedded_compatibility"
            ? "legacy_shell_coach_notes"
            : hydrationPending
              ? "hydration_pending"
              : "empty_hydration"
        : "unsupported_role";

  if (isPastCompetition) {
    for (const match of projectedEntry.matches) {
      logBreakdownPropagationForMatch({
        stage: "detail_screen_input",
        sharedCompetitionId,
        matchLineageKey: match.id,
        overlaySource: breakdownOverlaySource,
        source: match,
      });
    }
    console.log("COMPETITION_PENDING_VALIDATION", {
      sharedCompetitionId,
      matchLineageKeys,
      hydrationPending,
      hydratedAnnotationCount: hydratedOverlayAnnotations?.length ?? 0,
      legacyAnnotationCount: legacyOverlayAnnotations.length,
      overlaySource: breakdownOverlaySource,
      coachSyncHydrationVersion,
      competitionVersion,
    });
  }

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
            <MatchCard
              key={match.id}
              snapshot={match}
              index={index}
              sharedAthleteId={sharedAthleteId}
              sharedCompetitionId={sharedCompetitionId}
              overlaySource={breakdownOverlaySource}
            />
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
