import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "mm:v1:summary:lastAction:";

export async function getLastSummaryAction(
  athleteId: string,
): Promise<string | null> {
  if (!athleteId) return null;
  try {
    return await AsyncStorage.getItem(KEY_PREFIX + athleteId);
  } catch {
    return null;
  }
}

export async function setLastSummaryAction(
  athleteId: string,
  action: string,
): Promise<void> {
  if (!athleteId || !action) return;
  try {
    await AsyncStorage.setItem(KEY_PREFIX + athleteId, action);
  } catch {}
}
