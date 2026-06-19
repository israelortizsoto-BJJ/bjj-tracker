import {
  dedupeActiveCoachWriterLinks,
  parentStrictWeeklyLinkedCoachLinksForUi,
} from "../coachShare/coachLinkBinding";
import { isCoachSyncConfigured } from "../config/coachSync";
import {
  CoachWeeklySyncApiError,
  coachSyncFetchSession,
} from "../services/coachWeeklySyncApi";
import type { CoachLink } from "../types/coachShare";
import type { CoachWeeklySyncSessionResponse } from "../types/coachWeeklySync";
import type { DeviceRole } from "../storage/deviceRoleStore";
import {
  getCachedWeeklyForLinkToken,
  type CoachWeeklySyncCacheEntry,
} from "../storage/coachWeeklySyncCacheStore";
import { getCoachLinks } from "../storage/coachShareStore";

import type { WorkerSessionSnapshot } from "./workerSessionSnapshotContract";
import {
  projectWorkerSessionSnapshot,
  sanitizeFetchFailureReason,
  type ProjectWorkerSessionLinkInput,
} from "./projectWorkerSessionSnapshot";

export type CaptureWorkerSessionSnapshotOptions = {
  deviceRole: DeviceRole | null;
  /** Test hook — defaults to `new Date().toISOString()`. */
  capturedAt?: string;
  getCoachLinks?: () => Promise<CoachLink[]>;
  fetchSession?: (
    linkToken: string,
    apiBaseUrl?: string | null,
  ) => Promise<CoachWeeklySyncSessionResponse>;
  getCachedSession?: (linkToken: string) => Promise<CoachWeeklySyncCacheEntry | null>;
  isSyncConfigured?: () => boolean;
};

function activeLinksForRole(links: CoachLink[], deviceRole: DeviceRole | null): CoachLink[] {
  if (deviceRole === "parent") {
    return parentStrictWeeklyLinkedCoachLinksForUi(links);
  }
  return dedupeActiveCoachWriterLinks(links);
}

function weeklySyncLinkToken(link: CoachLink): string {
  return typeof link.weeklySync?.linkToken === "string" ? link.weeklySync.linkToken.trim() : "";
}

async function captureLinkEvidence(
  link: CoachLink,
  options: Required<
    Pick<
      CaptureWorkerSessionSnapshotOptions,
      "capturedAt" | "fetchSession" | "getCachedSession"
    >
  > & { syncConfigured: boolean },
): Promise<ProjectWorkerSessionLinkInput> {
  const linkToken = weeklySyncLinkToken(link);
  const apiBaseUrl = link.weeklySync?.apiBaseUrl ?? null;

  if (!options.syncConfigured) {
    return {
      linkToken,
      fetchSuccess: false,
      fetchFailureReason: "coach_sync_not_configured",
      httpStatus: null,
      dataSource: "none",
    };
  }

  if (!linkToken) {
    return {
      linkToken,
      fetchSuccess: false,
      fetchFailureReason: "missing_link_token",
      httpStatus: null,
      dataSource: "none",
    };
  }

  try {
    const session = await options.fetchSession(linkToken, apiBaseUrl);
    return {
      linkToken,
      fetchSuccess: true,
      dataSource: "network",
      sessionFetchedAt: options.capturedAt,
      httpStatus: 200,
      session,
    };
  } catch (error) {
    const httpStatus = error instanceof CoachWeeklySyncApiError ? error.status : 0;
    const fetchFailureReason = sanitizeFetchFailureReason(
      error instanceof Error ? error.message : String(error),
    );

    const cached = await options.getCachedSession(linkToken);
    if (cached?.session) {
      return {
        linkToken,
        fetchSuccess: true,
        dataSource: "cache",
        sessionFetchedAt: cached.fetchedAt,
        httpStatus: httpStatus || null,
        session: cached.session,
      };
    }

    return {
      linkToken,
      fetchSuccess: false,
      fetchFailureReason,
      httpStatus: httpStatus || null,
      dataSource: "none",
    };
  }
}

/**
 * Generates a production-safe Worker Session Snapshot via GET-only worker reads.
 * Observational capture — does not reconcile, hydrate, or mutate local stores.
 */
export async function captureWorkerSessionSnapshot(
  options: CaptureWorkerSessionSnapshotOptions,
): Promise<WorkerSessionSnapshot> {
  const capturedAt = options.capturedAt ?? new Date().toISOString();
  const syncConfigured = (options.isSyncConfigured ?? isCoachSyncConfigured)();
  const readLinks = options.getCoachLinks ?? getCoachLinks;
  const fetchSession = options.fetchSession ?? coachSyncFetchSession;
  const getCachedSession = options.getCachedSession ?? getCachedWeeklyForLinkToken;

  const links = await readLinks();
  const activeLinks = activeLinksForRole(links, options.deviceRole);

  const linkInputs = await Promise.all(
    activeLinks.map((link) =>
      captureLinkEvidence(link, {
        capturedAt,
        fetchSession,
        getCachedSession,
        syncConfigured,
      }),
    ),
  );

  return projectWorkerSessionSnapshot(linkInputs, {
    deviceRole: options.deviceRole,
    capturedAt,
    syncConfigured,
  });
}
