import type { SyncedWeeklyMessagePayload } from "../../types/coachWeeklySync";

export function markWeeklyViewed<T extends SyncedWeeklyMessagePayload>(weekly: T): T {
  if (!weekly.parentFeedback?.viewedAt) {
    weekly.parentFeedback = {
      ...weekly.parentFeedback,
      viewedAt: new Date().toISOString(),
    };
  }
  return weekly;
}

export function markWeeklyAcknowledged<T extends SyncedWeeklyMessagePayload>(weekly: T): T {
  weekly.parentFeedback = {
    ...weekly.parentFeedback,
    acknowledgedAt: new Date().toISOString(),
  };
  return weekly;
}
