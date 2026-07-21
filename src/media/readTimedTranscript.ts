import * as FileSystem from "expo-file-system/legacy";

import {
  parseTimedTranscript,
  type TimedTranscript,
} from "../types/timedTranscript";
import { coachTimedTranscriptJsonUriForAudioUri } from "./persistTimedTranscript";

/**
 * Read coach-local TimedTranscript evidence for an audio reference.
 *
 * Evidence Domain Activation — READ corridor only:
 * - Input: audio URI (same keying as persist)
 * - Output: TimedTranscript | null
 * - Missing file, corrupt JSON, or invalid schema → null (never throws)
 *
 * No playback, Session, Parent, sync, or Following.
 */
export async function readTimedTranscript(
  audioUri: string,
): Promise<TimedTranscript | null> {
  const path = coachTimedTranscriptJsonUriForAudioUri(audioUri);
  if (!path) return null;

  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists || info.isDirectory) return null;

    const raw = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return parseTimedTranscript(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}
