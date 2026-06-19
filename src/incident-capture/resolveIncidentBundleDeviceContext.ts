import {
  dedupeActiveCoachWriterLinks,
  parentStrictWeeklyLinkedCoachLinksForUi,
} from "../coachShare/coachLinkBinding";
import type { AppVariant } from "../config/runtime";
import type { CoachLink } from "../types/coachShare";
import type { DeviceRole } from "../storage/deviceRoleStore";

import type { IncidentBundlePlatform } from "./incidentBundleContract";

export type IncidentBundleDeviceContext = {
  deviceRole: DeviceRole;
  platform: IncidentBundlePlatform;
  buildNumber: string;
  appVariant: AppVariant;
  syncConfigured: boolean;
  writerLinkCount: number;
};

export type ResolveIncidentBundleDeviceContextOptions = {
  deviceRole: DeviceRole;
  platform: IncidentBundlePlatform;
  getCoachLinks?: () => Promise<CoachLink[]>;
  isSyncConfigured?: () => boolean;
  getAppVariant?: () => AppVariant;
  readBuildNumber?: () => string;
};

function activeLinksForRole(links: CoachLink[], deviceRole: DeviceRole): CoachLink[] {
  if (deviceRole === "parent") {
    return parentStrictWeeklyLinkedCoachLinksForUi(links);
  }
  return dedupeActiveCoachWriterLinks(links);
}

/** Resolves Tier 0 device context fields for the bundle envelope. */
export async function resolveIncidentBundleDeviceContext(
  options: ResolveIncidentBundleDeviceContextOptions,
): Promise<IncidentBundleDeviceContext> {
  const readLinks = options.getCoachLinks;
  if (!readLinks) {
    throw new Error("resolveIncidentBundleDeviceContext: getCoachLinks is required");
  }
  if (!options.isSyncConfigured) {
    throw new Error("resolveIncidentBundleDeviceContext: isSyncConfigured is required");
  }
  if (!options.getAppVariant) {
    throw new Error("resolveIncidentBundleDeviceContext: getAppVariant is required");
  }
  if (!options.readBuildNumber) {
    throw new Error("resolveIncidentBundleDeviceContext: readBuildNumber is required");
  }

  const links = await readLinks();
  const activeLinks = activeLinksForRole(links, options.deviceRole);

  return {
    deviceRole: options.deviceRole,
    platform: options.platform,
    buildNumber: options.readBuildNumber(),
    appVariant: options.getAppVariant(),
    syncConfigured: options.isSyncConfigured(),
    writerLinkCount: activeLinks.length,
  };
}
