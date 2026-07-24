import { Stack, router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FilmRoomScreen } from "../../src/features/filmRoom/FilmRoomScreen";
import {
  parseCoachMatchMediaPlaybackIdentity,
  useCoachMatchMediaPlaybackUri,
} from "../../src/features/filmRoom/useCoachMatchMediaPlaybackUri";

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return typeof value === "string" ? value.trim() : "";
}

const UI = {
  bg: "#08090a",
  text: "#f7f7f8",
  muted: "#92979f",
  line: "rgba(255, 255, 255, 0.10)",
} as const;

/**
 * PD-FR-001 entry route: Competition → Match Card → Watch Coach Match Breakdown → Film Room.
 *
 * Coach Shared Match Media resolve happens here (upstream of FilmRoomScreen).
 * Route params carry identity only — never a signed URL, signature, secret, or object key.
 */
export default function CompetitionFilmRoomRoute() {
  const params = useLocalSearchParams<{
    matchLineageKey?: string;
    matchIndex?: string;
    sharedAthleteId?: string;
    sharedCompetitionId?: string;
    mediaId?: string;
    coachNote?: string;
    videoUri?: string;
    durationMs?: string;
    matchMediaAssetId?: string;
    expectedRevision?: string;
    commentaryStartVideoMs?: string;
    commentaryMatchMediaAssetId?: string;
    commentaryAttachmentRevision?: string;
  }>();

  const matchLineageKey = singleParam(params.matchLineageKey);
  const sharedAthleteId = singleParam(params.sharedAthleteId);
  const sharedCompetitionId = singleParam(params.sharedCompetitionId);
  const matchIndex = Number.parseInt(singleParam(params.matchIndex) || "0", 10);
  const durationRaw = singleParam(params.durationMs);
  const durationParsed = Number.parseInt(durationRaw || "", 10);
  const legacyVideoUri = singleParam(params.videoUri) || null;
  const commentaryStartVideoMs = Number.parseInt(singleParam(params.commentaryStartVideoMs), 10);
  const commentaryAttachmentRevision = Number.parseInt(
    singleParam(params.commentaryAttachmentRevision),
    10,
  );
  const commentaryMatchMediaAssetId = singleParam(params.commentaryMatchMediaAssetId);
  const alignment =
    Number.isSafeInteger(commentaryStartVideoMs) && commentaryStartVideoMs >= 0 &&
    commentaryMatchMediaAssetId &&
    Number.isSafeInteger(commentaryAttachmentRevision) && commentaryAttachmentRevision > 0
      ? { commentaryStartVideoMs, matchMediaAssetId: commentaryMatchMediaAssetId, attachmentRevision: commentaryAttachmentRevision }
      : undefined;

  const coachMediaIdentity = parseCoachMatchMediaPlaybackIdentity({
    sharedAthleteId,
    sharedCompetitionId,
    matchLineageKey,
    matchMediaAssetId: singleParam(params.matchMediaAssetId),
    expectedRevision: singleParam(params.expectedRevision),
  });

  const playback = useCoachMatchMediaPlaybackUri(coachMediaIdentity);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/compete");
  };

  if (coachMediaIdentity) {
    if (playback.status === "loading" || playback.status === "idle") {
      return (
        <>
          <Stack.Screen options={{ headerShown: false }} />
          <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
            <FilmRoomBridgeChrome onBack={goBack} matchIndex={matchIndex} />
            <View style={styles.statusBody}>
              <Text style={styles.statusTitle}>Loading match video…</Text>
              <Text style={styles.statusMuted}>Preparing Film Room playback.</Text>
            </View>
          </SafeAreaView>
        </>
      );
    }

    if (playback.status === "removed") {
      return (
        <>
          <Stack.Screen options={{ headerShown: false }} />
          <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
            <FilmRoomBridgeChrome onBack={goBack} matchIndex={matchIndex} />
            <View style={styles.statusBody}>
              <Text style={styles.statusTitle}>Video removed</Text>
              <Text style={styles.statusMuted}>
                This match video is no longer available.
              </Text>
            </View>
          </SafeAreaView>
        </>
      );
    }

    if (
      playback.status === "missing" ||
      playback.status === "unavailable" ||
      !playback.videoUri
    ) {
      return (
        <>
          <Stack.Screen options={{ headerShown: false }} />
          <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
            <FilmRoomBridgeChrome onBack={goBack} matchIndex={matchIndex} />
            <View style={styles.statusBody}>
              <Text style={styles.statusTitle}>
                {playback.message ?? "Video unavailable"}
              </Text>
              <Text style={styles.statusMuted}>
                Match video could not be loaded for Film Room.
              </Text>
              {playback.canRetry ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading match video"
                  onPress={() => {
                    playback.retry();
                  }}
                  style={({ pressed }) => [
                    styles.retryBtn,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              ) : null}
            </View>
          </SafeAreaView>
        </>
      );
    }
  }

  const videoUri = coachMediaIdentity ? playback.videoUri : legacyVideoUri;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FilmRoomScreen
        matchLineageKey={matchLineageKey}
        matchIndex={Number.isFinite(matchIndex) ? matchIndex : 0}
        sharedAthleteId={sharedAthleteId}
        sharedCompetitionId={sharedCompetitionId}
        mediaId={singleParam(params.mediaId)}
        coachNote={singleParam(params.coachNote)}
        videoUri={videoUri}
        durationMs={Number.isFinite(durationParsed) ? durationParsed : undefined}
        alignment={alignment}
        onDeliveryError={
          coachMediaIdentity
            ? (kind) => {
                playback.reportDeliveryFailure(kind);
              }
            : undefined
        }
      />
    </>
  );
}

function FilmRoomBridgeChrome({
  onBack,
  matchIndex,
}: {
  onBack: () => void;
  matchIndex: number;
}) {
  const label = `Match ${Number.isFinite(matchIndex) ? matchIndex + 1 : 1}`;
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={({ pressed }) => [styles.backBtn, pressed ? styles.pressed : null]}
      >
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>FILM ROOM</Text>
        <Text style={styles.title} numberOfLines={1}>
          Coach Match Breakdown
        </Text>
      </View>
      <Text style={styles.matchLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: UI.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 66,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: UI.bg,
  },
  backBtn: {
    width: 38,
    height: 38,
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
  },
  backText: {
    color: UI.text,
    fontSize: 36,
    lineHeight: 36,
    fontWeight: "300",
  },
  heading: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    color: UI.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    color: UI.text,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  matchLabel: {
    marginLeft: 8,
    color: UI.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  statusBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    gap: 10,
  },
  statusTitle: {
    color: UI.text,
    fontSize: 18,
    fontWeight: "700",
  },
  statusMuted: {
    color: UI.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  retryBtn: {
    alignSelf: "flex-start",
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: UI.line,
  },
  retryText: {
    color: UI.text,
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.76,
  },
});
