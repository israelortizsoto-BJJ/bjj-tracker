import {
  dedupeActiveCoachWriterLinks,
  parentStrictWeeklyLinkedCoachLinksForUi,
} from "../coachShare/coachLinkBinding";
import { inviteLinkTokenTail } from "../coachShare/inviteLinkToken";
import { isCoachSyncConfigured } from "../config/coachSync";
import type { AuthoritySnapshotSourceTrigger } from "../identity/types";
import type { CoachWriterSessionRefreshResult } from "../storage/coachKidStore";
import { getCoachLinks } from "../storage/coachShareStore";
import { getCoachSyncHydrationBumpState } from "../storage/coachSyncHydrationStore";
import { getAllCoachAnalysisReadiness } from "../storage/coachAnalysisReadinessStore";
import { getCoachMatchBreakdownArtifactSet } from "../storage/coachMatchBreakdownArtifactStore";
import type { CoachLink } from "../types/coachShare";
import type { DeviceRole } from "../storage/deviceRoleStore";
import {
  getCachedWeeklyForLinkToken,
  type CoachWeeklySyncCacheEntry,
} from "../storage/coachWeeklySyncCacheStore";

import type {
  HydrationCacheLinkEvidence,
  HydrationSnapshot,
  HydrationSnapshotCaptureMode,
} from "./hydrationSnapshotContract";
import { projectHydrationSnapshot } from "./projectHydrationSnapshot";

export type CaptureHydrationSnapshotOptions = {
  deviceRole: DeviceRole | null;
  captureMode: HydrationSnapshotCaptureMode;
  /** Rule B: required when `captureMode` is `shared_authority_reconcile`. */
  writerSessionRefresh?: CoachWriterSessionRefreshResult | null;
  reconcileAttempted?: boolean;
  coachSessionRefreshDegraded?: boolean;
  sourceTrigger?: AuthoritySnapshotSourceTrigger;
  /** Test hook — defaults to `new Date().toISOString()`. */
  capturedAt?: string;
  getCoachLinks?: () => Promise<CoachLink[]>;
  getCachedSession?: (linkToken: string) => Promise<CoachWeeklySyncCacheEntry | null>;
  isSyncConfigured?: () => boolean;
  getHydrationBumpState?: () => ReturnType<typeof getCoachSyncHydrationBumpState>;
  getAnalysisReadiness?: typeof getAllCoachAnalysisReadiness;
  getArtifactSet?: typeof getCoachMatchBreakdownArtifactSet;
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

function isValidWeeklyDoc(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.weekStartYMD === "string" &&
    typeof o.headline === "string" &&
    typeof o.body === "string" &&
    typeof o.updatedAt === "string"
  );
}

function cacheLinkEvidenceFromEntry(
  linkToken: string,
  entry: CoachWeeklySyncCacheEntry | null,
): HydrationCacheLinkEvidence {
  const sessionPresent = Boolean(entry?.session);
  return {
    linkTokenTail: inviteLinkTokenTail(linkToken) ?? "",
    fetchedAt: entry?.fetchedAt ?? null,
    sessionPresent,
    dataSource: sessionPresent ? "cache" : "none",
  };
}

function parentWeeklyFetchSourceFromCache(
  entries: (CoachWeeklySyncCacheEntry | null)[],
): "cache" | "none" {
  for (const entry of entries) {
    if (!entry) continue;
    if (isValidWeeklyDoc(entry.weekly)) return "cache";
    const weeklyByAthleteId = entry.weeklyByAthleteId ?? {};
    if (Object.values(weeklyByAthleteId).some((doc) => isValidWeeklyDoc(doc))) {
      return "cache";
    }
  }
  return "none";
}

function parentOverlayArtifactsPresentFromCache(
  entries: (CoachWeeklySyncCacheEntry | null)[],
): boolean {
  for (const entry of entries) {
    const artifacts = entry?.session?.coachMatchBreakdownArtifacts;
    if (!artifacts || typeof artifacts !== "object") continue;
    if (Object.keys(artifacts).length > 0) return true;
  }
  return false;
}

/**
 * Generates a production-safe Hydration Snapshot from hydration truth.
 * Rule B: when `captureMode` is `shared_authority_reconcile`, consumes Authority reconcile
 * output and MUST NOT invoke `refreshCoachWriterSessionsAndReconcileStores`.
 */
export async function captureHydrationSnapshot(
  options: CaptureHydrationSnapshotOptions,
): Promise<HydrationSnapshot> {
  if (
    options.captureMode === "shared_authority_reconcile" &&
    !options.writerSessionRefresh
  ) {
    throw new Error(
      "captureHydrationSnapshot: writerSessionRefresh is required for shared_authority_reconcile",
    );
  }

  const capturedAt = options.capturedAt ?? new Date().toISOString();
  const syncConfigured = (options.isSyncConfigured ?? isCoachSyncConfigured)();
  const bumpState = (options.getHydrationBumpState ?? getCoachSyncHydrationBumpState)();
  const readLinks = options.getCoachLinks ?? getCoachLinks;
  const getCachedSession = options.getCachedSession ?? getCachedWeeklyForLinkToken;
  const analysisReadiness = await (
    options.getAnalysisReadiness ?? getAllCoachAnalysisReadiness
  )();
  const readArtifactSet =
    options.getArtifactSet ?? getCoachMatchBreakdownArtifactSet;
  const currentArtifactStoreUpdatedAtByAthleteId = Object.fromEntries(
    await Promise.all(
      Object.keys(analysisReadiness).map(async (sharedAthleteId) => [
        sharedAthleteId,
        (await readArtifactSet(sharedAthleteId))?.updatedAt ?? null,
      ]),
    ),
  );

  const needsCacheReads =
    options.deviceRole === "parent" ||
    options.captureMode === "read_only_state";

  let cacheLinks: HydrationCacheLinkEvidence[] | undefined;
  let activeLinkCount: number | undefined;
  let sessionCachePresentCount: number | undefined;
  let parentWeeklyFetchSource: "cache" | "network" | "none" | undefined;
  let parentOverlayArtifactsPresent: boolean | undefined;
  let readOnlyCoachWriterLinkCount: number | undefined;
  let readOnlyCoachSessionsFetchedOkCount: number | undefined;
  let cachedEntries: (CoachWeeklySyncCacheEntry | null)[] = [];

  if (needsCacheReads) {
    const links = await readLinks();
    const activeLinks = activeLinksForRole(links, options.deviceRole);
    cachedEntries = await Promise.all(
      activeLinks.map(async (link) => {
        const linkToken = weeklySyncLinkToken(link);
        if (!linkToken) return null;
        return getCachedSession(linkToken);
      }),
    );
    cacheLinks = activeLinks.map((link, index) =>
      cacheLinkEvidenceFromEntry(weeklySyncLinkToken(link), cachedEntries[index] ?? null),
    );
    const presentCount = cacheLinks.filter((link) => link.sessionPresent).length;

    if (options.deviceRole === "parent") {
      activeLinkCount = activeLinks.length;
      sessionCachePresentCount = presentCount;
      parentWeeklyFetchSource = parentWeeklyFetchSourceFromCache(cachedEntries);
      parentOverlayArtifactsPresent = parentOverlayArtifactsPresentFromCache(cachedEntries);
    }

    if (options.deviceRole === "coach" && options.captureMode === "read_only_state") {
      readOnlyCoachWriterLinkCount = activeLinks.length;
      readOnlyCoachSessionsFetchedOkCount = presentCount;
    }
  }

  return projectHydrationSnapshot({
    deviceRole: options.deviceRole,
    syncConfigured,
    captureMode: options.captureMode,
    hydrationVersion: bumpState.hydrationVersion,
    lastBumpReason: bumpState.lastBumpReason,
    lastBumpAt: bumpState.lastBumpAt,
    sourceTrigger: options.sourceTrigger,
    capturedAt,
    writerSessionRefresh: options.writerSessionRefresh,
    reconcileAttempted:
      options.captureMode === "read_only_state" ? false : options.reconcileAttempted,
    coachSessionRefreshDegraded: options.coachSessionRefreshDegraded,
    cacheLinks,
    activeLinkCount,
    sessionCachePresentCount,
    parentWeeklyFetchSource,
    parentOverlayArtifactsPresent,
    readOnlyCoachWriterLinkCount,
    readOnlyCoachSessionsFetchedOkCount,
    analysisReadiness: Object.values(analysisReadiness),
    currentArtifactStoreUpdatedAtByAthleteId,
  });
}
