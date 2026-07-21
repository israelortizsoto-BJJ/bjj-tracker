import * as FileSystem from "expo-file-system/legacy";

import type { TimedTranscript } from "../types/timedTranscript";

const COACH_TIMED_TRANSCRIPT_SUBDIR = "media/coach-timed-transcript/";

function coachTimedTranscriptDirAbsolute(): string | null {
  if (!FileSystem.documentDirectory) return null;
  return `${FileSystem.documentDirectory}${COACH_TIMED_TRANSCRIPT_SUBDIR}`;
}

/**
 * Ensures `documentDirectory/media/coach-timed-transcript/` exists.
 * Returns absolute path ending with `/` or null when document storage is unavailable.
 */
export async function ensureCoachTimedTranscriptDir(): Promise<string | null> {
  const dir = coachTimedTranscriptDirAbsolute();
  if (!dir) return null;

  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

function filenameForAudioUri(audioUri: string): string {
  const leaf = audioUri.trim().split("/").pop()?.split("?")[0] || "";
  const stem = leaf.replace(/\.[^.]+$/, "") || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${stem}.timed-transcript.json`;
}

/**
 * Absolute sidecar JSON URI for an audio reference, or null when storage is unavailable.
 * Shared by persist + read so both corridors use the same keying.
 */
export function coachTimedTranscriptJsonUriForAudioUri(audioUri: string): string | null {
  const dir = coachTimedTranscriptDirAbsolute();
  if (!dir) return null;
  const trimmed = audioUri.trim();
  if (!trimmed) return null;
  return `${dir}${filenameForAudioUri(trimmed)}`;
}

/**
 * Persist a coach-local TimedTranscript JSON sidecar.
 * Keyed by audio URI basename under coach-timed-transcript storage.
 * Returns the durable JSON URI when write succeeds.
 */
export async function persistTimedTranscript(transcript: TimedTranscript): Promise<string> {
  const dest = coachTimedTranscriptJsonUriForAudioUri(transcript.audioUri);
  if (!dest) {
    throw new Error("Coach timed-transcript storage unavailable");
  }

  const dir = await ensureCoachTimedTranscriptDir();
  if (!dir) {
    throw new Error("Coach timed-transcript storage unavailable");
  }

  await FileSystem.writeAsStringAsync(dest, JSON.stringify(transcript), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return dest;
}
