import { Stack, useLocalSearchParams } from "expo-router";

import { FilmRoomScreen } from "../../src/features/filmRoom/FilmRoomScreen";

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return typeof value === "string" ? value.trim() : "";
}

/**
 * PD-FR-001 entry route: Competition → Match Card → Watch Coach Match Breakdown → Film Room.
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
  }>();

  const matchIndex = Number.parseInt(singleParam(params.matchIndex) || "0", 10);
  const durationRaw = singleParam(params.durationMs);
  const durationParsed = Number.parseInt(durationRaw || "", 10);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FilmRoomScreen
        matchLineageKey={singleParam(params.matchLineageKey)}
        matchIndex={Number.isFinite(matchIndex) ? matchIndex : 0}
        sharedAthleteId={singleParam(params.sharedAthleteId)}
        sharedCompetitionId={singleParam(params.sharedCompetitionId)}
        mediaId={singleParam(params.mediaId)}
        coachNote={singleParam(params.coachNote)}
        videoUri={singleParam(params.videoUri) || null}
        durationMs={Number.isFinite(durationParsed) ? durationParsed : undefined}
      />
    </>
  );
}
