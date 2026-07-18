import * as FileSystem from "expo-file-system/legacy";

const COACH_VOICE_SUBDIR = "media/coach-voice/";

function coachVoiceDirAbsolute(): string | null {
  if (!FileSystem.documentDirectory) return null;
  return `${FileSystem.documentDirectory}${COACH_VOICE_SUBDIR}`;
}

/**
 * Ensures `documentDirectory/media/coach-voice/` exists.
 * Returns absolute path ending with `/` or null when document storage is unavailable.
 */
export async function ensureCoachVoiceDir(): Promise<string | null> {
  const dir = coachVoiceDirAbsolute();
  if (!dir) return null;

  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

/**
 * Copy a temporary recording URI into durable coach-voice storage.
 * Returns the durable URI when copy succeeds; falls back to the source URI otherwise.
 */
export async function persistCoachVoiceAudio(uri: string): Promise<string> {
  const source = uri.trim();
  if (!source) return source;

  const dir = await ensureCoachVoiceDir();
  if (!dir) return source;

  const prefix = coachVoiceDirAbsolute();
  if (prefix && source.startsWith(prefix)) return source;

  const ext = source.split(".").pop()?.split("?")[0] || "m4a";
  const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  const dest = `${dir}${filename}`;

  await FileSystem.copyAsync({ from: source, to: dest });
  return dest;
}

/**
 * Best-effort delete for files under the coach-voice folder (ignore failures).
 */
export async function bestEffortDeletePersistedCoachVoice(
  uri: string | null | undefined,
): Promise<void> {
  if (!uri || !FileSystem.documentDirectory) return;
  const prefix = `${FileSystem.documentDirectory}${COACH_VOICE_SUBDIR}`;
  if (!uri.startsWith(prefix)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore
  }
}
