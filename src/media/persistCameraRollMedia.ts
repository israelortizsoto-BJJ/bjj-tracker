import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";

const MEDIA_SUBDIR = "media/";

function mediaDirAbsolute(): string | null {
  if (!FileSystem.documentDirectory) return null;
  return `${FileSystem.documentDirectory}${MEDIA_SUBDIR}`;
}

/**
 * Ensures `documentDirectory/media/` exists. Returns absolute path ending with `/` or null.
 */
export async function ensureMediaDir(): Promise<string | null> {
  const dir = mediaDirAbsolute();
  if (!dir) return null;

  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

/**
 * Copy a camera-roll asset into app document storage (same pattern as Training sessions).
 */
export async function persistMediaFromCameraRoll(
  uri: string,
  kind: "image" | "video",
): Promise<string> {
  const dir = await ensureMediaDir();
  if (!dir) return uri;

  const ext =
    uri.split(".").pop()?.split("?")[0] ||
    (kind === "image" ? "jpg" : "mp4");

  const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  const dest = `${dir}${filename}`;

  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function requestMediaLibraryPermission(): Promise<boolean> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return perm.granted;
}

/**
 * Best-effort delete for files under our persisted media folder (ignore failures).
 */
export async function bestEffortDeletePersistedMedia(
  uri: string | null | undefined,
): Promise<void> {
  if (!uri || !FileSystem.documentDirectory) return;
  const prefix = `${FileSystem.documentDirectory}${MEDIA_SUBDIR}`;
  if (!uri.startsWith(prefix)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore
  }
}
