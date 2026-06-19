import type { buildAthleteAuthoritySnapshot } from "../identity/buildAthleteAuthoritySnapshot";
import type { DeviceRole } from "../storage/deviceRoleStore";

import { assembleIncidentBundleEnvelope } from "./assembleIncidentBundleEnvelope";
import type { captureAuthoritySnapshot } from "./captureAuthoritySnapshot";
import type { captureHydrationSnapshot } from "./captureHydrationSnapshot";
import type { captureWorkerSessionSnapshot } from "./captureWorkerSessionSnapshot";
import type {
  IncidentBundlePlatform,
  IncidentBundleV1,
} from "./incidentBundleContract";
import type { projectAuthoritySnapshot } from "./projectAuthoritySnapshot";
import type {
  IncidentBundleDeviceContext,
  resolveIncidentBundleDeviceContext,
} from "./resolveIncidentBundleDeviceContext";
import { validateIncidentBundle } from "./validateIncidentBundle";

export type CaptureIncidentBundleOptions = {
  deviceRole: DeviceRole;
  incidentCorrelationId: string;
  capturedAt?: string;
  platform?: IncidentBundlePlatform;
};

export type CaptureIncidentBundleDeps = {
  captureAuthoritySnapshot: typeof captureAuthoritySnapshot;
  buildAthleteAuthoritySnapshot: typeof buildAthleteAuthoritySnapshot;
  projectAuthoritySnapshot: typeof projectAuthoritySnapshot;
  captureHydrationSnapshot: typeof captureHydrationSnapshot;
  captureWorkerSessionSnapshot: typeof captureWorkerSessionSnapshot;
  resolveDeviceContext: typeof resolveIncidentBundleDeviceContext;
  validateBundle: typeof validateIncidentBundle;
  resolvePlatform: () => IncidentBundlePlatform;
  readProductionContextDeps: () => Promise<{
    getCoachLinks: NonNullable<
      Parameters<typeof resolveIncidentBundleDeviceContext>[0]["getCoachLinks"]
    >;
    isSyncConfigured: NonNullable<
      Parameters<typeof resolveIncidentBundleDeviceContext>[0]["isSyncConfigured"]
    >;
    getAppVariant: NonNullable<
      Parameters<typeof resolveIncidentBundleDeviceContext>[0]["getAppVariant"]
    >;
    readBuildNumber: NonNullable<
      Parameters<typeof resolveIncidentBundleDeviceContext>[0]["readBuildNumber"]
    >;
  }>;
};

function assertCaptureInputs(options: CaptureIncidentBundleOptions): void {
  if (options.deviceRole !== "parent" && options.deviceRole !== "coach") {
    throw new Error("captureIncidentBundle: deviceRole is required");
  }
  if (options.incidentCorrelationId.trim().length < 8) {
    throw new Error("captureIncidentBundle: incidentCorrelationId is required");
  }
}

const REQUIRED_DEP_KEYS: (keyof CaptureIncidentBundleDeps)[] = [
  "captureAuthoritySnapshot",
  "buildAthleteAuthoritySnapshot",
  "projectAuthoritySnapshot",
  "captureHydrationSnapshot",
  "captureWorkerSessionSnapshot",
  "resolveDeviceContext",
  "validateBundle",
  "resolvePlatform",
  "readProductionContextDeps",
];

function hasAllDeps(deps?: Partial<CaptureIncidentBundleDeps>): deps is CaptureIncidentBundleDeps {
  if (!deps) return false;
  return REQUIRED_DEP_KEYS.every((key) => deps[key] !== undefined);
}

let productionDepsPromise: Promise<CaptureIncidentBundleDeps> | null = null;

async function loadProductionDeps(): Promise<CaptureIncidentBundleDeps> {
  if (!productionDepsPromise) {
    productionDepsPromise = (async () => {
      const [
        { Platform },
        Constants,
        { captureAuthoritySnapshot: captureAuthority },
        { buildAthleteAuthoritySnapshot: buildAuthority },
        { projectAuthoritySnapshot: projectAuthority },
        { captureHydrationSnapshot: captureHydration },
        { captureWorkerSessionSnapshot: captureWorkerSession },
        { resolveIncidentBundleDeviceContext: resolveContext },
        { isCoachSyncConfigured },
        { getAppVariant },
        { getCoachLinks },
      ] = await Promise.all([
        import("react-native"),
        import("expo-constants"),
        import("./captureAuthoritySnapshot"),
        import("../identity/buildAthleteAuthoritySnapshot"),
        import("./projectAuthoritySnapshot"),
        import("./captureHydrationSnapshot"),
        import("./captureWorkerSessionSnapshot"),
        import("./resolveIncidentBundleDeviceContext"),
        import("../config/coachSync"),
        import("../config/runtime"),
        import("../storage/coachShareStore"),
      ]);

      function readBuildNumber(): string {
        const expoConfig = Constants.default.expoConfig;
        const iosBuild = expoConfig?.ios?.buildNumber;
        const androidBuild = expoConfig?.android?.versionCode;
        if (iosBuild != null && String(iosBuild).trim()) return String(iosBuild);
        if (androidBuild != null && String(androidBuild).trim()) return String(androidBuild);
        return "unknown";
      }

      function resolvePlatform(): IncidentBundlePlatform {
        if (Platform.OS === "ios") return "ios";
        if (Platform.OS === "android") return "android";
        throw new Error(`captureIncidentBundle: unsupported platform ${Platform.OS}`);
      }

      return {
        captureAuthoritySnapshot: captureAuthority,
        buildAthleteAuthoritySnapshot: buildAuthority,
        projectAuthoritySnapshot: projectAuthority,
        captureHydrationSnapshot: captureHydration,
        captureWorkerSessionSnapshot: captureWorkerSession,
        resolveDeviceContext: resolveContext,
        validateBundle: validateIncidentBundle,
        resolvePlatform,
        readProductionContextDeps: async () => ({
          getCoachLinks,
          isSyncConfigured: isCoachSyncConfigured,
          getAppVariant,
          readBuildNumber,
        }),
      };
    })();
  }
  return productionDepsPromise;
}

async function captureParentArtifacts(
  options: CaptureIncidentBundleOptions,
  capturedAt: string,
  deps: CaptureIncidentBundleDeps,
): Promise<IncidentBundleV1["artifacts"]> {
  const authority = await deps.captureAuthoritySnapshot({
    deviceRole: "parent",
    sourceTrigger: "export",
    skipCoachWriterSessionRefresh: true,
    capturedAt,
  });

  const hydration = await deps.captureHydrationSnapshot({
    deviceRole: "parent",
    captureMode: "read_only_state",
    sourceTrigger: "export",
    capturedAt,
  });

  const workerSession = await deps.captureWorkerSessionSnapshot({
    deviceRole: "parent",
    capturedAt,
  });

  return { authority, hydration, workerSession };
}

async function captureCoachArtifacts(
  options: CaptureIncidentBundleOptions,
  capturedAt: string,
  deps: CaptureIncidentBundleDeps,
): Promise<IncidentBundleV1["artifacts"]> {
  const substrate = await deps.buildAthleteAuthoritySnapshot({
    parentRole: "coach",
    observability: { sourceTrigger: "export", role: "coach" },
    skipCoachWriterSessionRefresh: false,
  });

  const authority = deps.projectAuthoritySnapshot(substrate, {
    deviceRole: "coach",
    capturedAt,
    sourceTrigger: "export",
  });

  const hydration = await deps.captureHydrationSnapshot({
    deviceRole: "coach",
    captureMode: "shared_authority_reconcile",
    writerSessionRefresh: substrate.writerSessionRefresh,
    reconcileAttempted: substrate.reconcileAttempted,
    coachSessionRefreshDegraded: substrate.coachSessionRefreshDegraded,
    sourceTrigger: "export",
    capturedAt,
  });

  const workerSession = await deps.captureWorkerSessionSnapshot({
    deviceRole: "coach",
    capturedAt,
  });

  return { authority, hydration, workerSession };
}

/**
 * Captures a production-safe Incident Bundle V1 (Tier 0 envelope + Tier 1 artifacts).
 * Fail-closed: any artifact failure aborts the entire export.
 */
export async function captureIncidentBundle(
  options: CaptureIncidentBundleOptions,
  deps?: Partial<CaptureIncidentBundleDeps>,
): Promise<IncidentBundleV1> {
  assertCaptureInputs(options);

  const resolvedDeps: CaptureIncidentBundleDeps = hasAllDeps(deps)
    ? deps
    : {
        ...(await loadProductionDeps()),
        ...deps,
      };

  const capturedAt = options.capturedAt ?? new Date().toISOString();
  const platform = options.platform ?? resolvedDeps.resolvePlatform();

  const artifacts =
    options.deviceRole === "parent"
      ? await captureParentArtifacts(options, capturedAt, resolvedDeps)
      : await captureCoachArtifacts(options, capturedAt, resolvedDeps);

  const contextDeps = await resolvedDeps.readProductionContextDeps();
  const deviceContext: IncidentBundleDeviceContext = await resolvedDeps.resolveDeviceContext({
    deviceRole: options.deviceRole,
    platform,
    ...contextDeps,
  });

  const envelope = assembleIncidentBundleEnvelope({
    ...deviceContext,
    capturedAt,
    incidentCorrelationId: options.incidentCorrelationId.trim(),
  });

  const bundle: IncidentBundleV1 = {
    ...envelope,
    artifacts,
  };

  resolvedDeps.validateBundle(bundle);
  return bundle;
}
