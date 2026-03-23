import type { KidWeeklyFocusEntry } from "../types/coachKid";
import type { CoachWeeklySyncPublishBody } from "../types/coachWeeklySync";

/**
 * Maps a saved weekly focus row to the **family-facing** remote document.
 * Does not include coach check-in notes, outcomes, or reference video URLs (media sync out of scope).
 */
export function kidWeeklyFocusToPublishPayload(
  entry: KidWeeklyFocusEntry,
  weekStartYMD: string,
): CoachWeeklySyncPublishBody {
  const headline = entry.title.trim().slice(0, 200);
  const bodyRaw =
    entry.focusType === "template"
      ? (entry.metadata ?? "").trim()
      : (entry.note ?? "").trim();
  const body =
    bodyRaw ||
    "Your coach highlighted this week’s focus in class. Use the title above as the main cue, and ask your coach if you want more detail.";

  const classLine =
    entry.focusType === "template"
      ? `In class, look for: ${entry.title}${entry.metadata ? ` — ${entry.metadata}` : ""}`.slice(0, 500)
      : `This week’s focus: ${entry.title}`.slice(0, 500);

  return {
    weekStartYMD,
    headline,
    body: body.slice(0, 8000),
    classLine,
  };
}
