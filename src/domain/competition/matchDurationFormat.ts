export function formatSecondsAsMmSs(totalSeconds: number | null): string | null {
  if (totalSeconds === null || !Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return null;
  }
  const rounded = Math.round(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatSubmissionTimeDisplay(value: string | number | null | undefined): string | null {
  if (typeof value === "number") return formatSecondsAsMmSs(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const rawSeconds = Number(trimmed);
  if (Number.isFinite(rawSeconds) && rawSeconds >= 0 && /^\d+(?:\.\d+)?$/.test(trimmed)) {
    return formatSecondsAsMmSs(rawSeconds);
  }

  const mmssMatch = /^(\d+):([0-5]\d)$/.exec(trimmed);
  if (mmssMatch) {
    const minutes = Number(mmssMatch[1]);
    const seconds = Number(mmssMatch[2]);
    return formatSecondsAsMmSs(minutes * 60 + seconds);
  }

  return trimmed;
}
