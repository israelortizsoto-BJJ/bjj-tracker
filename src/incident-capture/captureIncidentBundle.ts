import type { buildAthleteAuthoritySnapshot } from "../identity/buildAthleteAuthoritySnapshot";
import type { DeviceRole } from "../storage/deviceRoleStore";

import { assembleIncidentBundleEnvelope } from "./assembleIncidentBundleEnvelope";
import type { captureAuthoritySnapshot } from "./captureAuthoritySnapshot";
import type { captureHydrationSnapshot } from "./captureHydrationSnapshot";
import type { captureWorkerSessionSnapshot } from "./captureWorkerSessionSnapshot";
import type { captureTopologySnapshot } from "./captureTopologySnapshot";
import type {
  IncidentBundle,
  IncidentBundlePlatform,
  IncidentBundleV1,
  IncidentBundleV2,
} from "./incidentBundleContract";
import { INCIDENT_BUNDLE_V2_CONTRACT_VERSION } from "./incidentBundleContract";
import type { projectAuthoritySnapshot } from "./projectAuthoritySnapshot";
import type {
  IncidentBundleDeviceContext,
  resolveIncidentBundleDeviceContext,
} from "./resolveIncidentBundleDeviceContext";
import {
  persistIncidentCaptureStage,
  type PersistCaptureStage,
} from "./incidentCaptureDebug";
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
  captureTopologySnapshot: typeof captureTopologySnapshot;
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
  persistCaptureStage?: PersistCaptureStage;
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
  "captureTopologySnapshot",
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
        { captureTopologySnapshot: captureTopology },
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
        import("./captureTopologySnapshot"),
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
        captureTopologySnapshot: captureTopology,
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

async function resolvePersistCaptureStage(
  deps: CaptureIncidentBundleDeps,
): Promise<PersistCaptureStage> {
  if (deps.persistCaptureStage) return deps.persistCaptureStage;
  const { persistIncidentCaptureStage } = await import("./incidentCaptureDebug");
  return async (stage, correlationId) => {
    await persistIncidentCaptureStage(stage, correlationId);
  };
}

async function captureParentArtifacts(
  options: CaptureIncidentBundleOptions,
  capturedAt: string,
  deps: CaptureIncidentBundleDeps,
  persist: PersistCaptureStage,
): Promise<IncidentBundleV1["artifacts"]> {
  const correlationId = options.incidentCorrelationId.trim();

  await persist("pre_authority", correlationId);
  const authority = await deps.captureAuthoritySnapshot({
    deviceRole: "parent",
    sourceTrigger: "export",
    skipCoachWriterSessionRefresh: true,
    capturedAt,
  });
  await persist("post_authority", correlationId);

  await persist("pre_hydration", correlationId);
  const hydration = await deps.captureHydrationSnapshot({
    deviceRole: "parent",
    captureMode: "read_only_state",
    sourceTrigger: "export",
    capturedAt,
  });
  await persist("post_hydration", correlationId);

  await persist("pre_worker", correlationId);
  const workerSession = await deps.captureWorkerSessionSnapshot({
    deviceRole: "parent",
    capturedAt,
  });
  await persist("post_worker", correlationId);

  return { authority, hydration, workerSession };
}

async function captureCoachArtifacts(
  options: CaptureIncidentBundleOptions,
  capturedAt: string,
  deps: CaptureIncidentBundleDeps,
  persist: PersistCaptureStage,
): Promise<IncidentBundleV2["artifacts"]> {
  const correlationId = options.incidentCorrelationId.trim();

  await persist("pre_authority", correlationId);
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
  await persist("post_authority", correlationId);

  await persist("pre_hydration", correlationId);
  const hydration = await deps.captureHydrationSnapshot({
    deviceRole: "coach",
    captureMode: "shared_authority_reconcile",
    writerSessionRefresh: substrate.writerSessionRefresh,
    reconcileAttempted: substrate.reconcileAttempted,
    coachSessionRefreshDegraded: substrate.coachSessionRefreshDegraded,
    sourceTrigger: "export",
    capturedAt,
  });
  await persist("post_hydration", correlationId);

  await persist("pre_worker", correlationId);
  const workerSession = await deps.captureWorkerSessionSnapshot({
    deviceRole: "coach",
    capturedAt,
  });
  await persist("post_worker", correlationId);

  await persist("pre_topology", correlationId);
  const topology = await deps.captureTopologySnapshot({
    authority,
    sourceTrigger: "export",
    capturedAt,
  });
  await persist("post_topology", correlationId);

  return { authority, hydration, workerSession, topology };
}

/**
 * Captures a production-safe Incident Bundle (Tier 0 envelope + Tier 1 artifacts).
 * Parent exports V1; coach exports V2 with topology.
 * Fail-closed: any artifact failure aborts the entire export.
 */
export async function captureIncidentBundle(
  options: CaptureIncidentBundleOptions,
  deps?: Partial<CaptureIncidentBundleDeps>,
): Promise<IncidentBundle> {
  await (deps?.persistCaptureStage ?? persistIncidentCaptureStage)(
    "capture_function_entered",
    options.incidentCorrelationId.trim(),
  );

  assertCaptureInputs(options);

  const resolvedDeps: CaptureIncidentBundleDeps = hasAllDeps(deps)
    ? deps
    : {
        ...(await loadProductionDeps()),
        ...deps,
      };

  const capturedAt = options.capturedAt ?? new Date().toISOString();
  const platform = options.platform ?? resolvedDeps.resolvePlatform();
  const correlationId = options.incidentCorrelationId.trim();
  const persist = await resolvePersistCaptureStage(resolvedDeps);

  const contextDeps = await resolvedDeps.readProductionContextDeps();
  const deviceContext: IncidentBundleDeviceContext = await resolvedDeps.resolveDeviceContext({
    deviceRole: options.deviceRole,
    platform,
    ...contextDeps,
  });

  const envelope = assembleIncidentBundleEnvelope({
    ...deviceContext,
    capturedAt,
    incidentCorrelationId: correlationId,
  });

  if (options.deviceRole === "parent") {
    await persist("capture_before_authority", correlationId);
    const artifacts = await captureParentArtifacts(options, capturedAt, resolvedDeps, persist);

    await persist("pre_bundle_assembly", correlationId);
    const bundle: IncidentBundleV1 = {
      ...envelope,
      artifacts,
    };
    await persist("post_bundle_assembly", correlationId);

    await persist("pre_validation", correlationId);
    resolvedDeps.validateBundle(bundle);
    await persist("post_validation", correlationId);

    await persist("capture_complete", correlationId);
    return bundle;
  }

  await persist("capture_before_authority", correlationId);
  const artifacts = await captureCoachArtifacts(options, capturedAt, resolvedDeps, persist);

  await persist("pre_bundle_assembly", correlationId);
  const bundle: IncidentBundleV2 = {
    ...envelope,
    bundleVersion: INCIDENT_BUNDLE_V2_CONTRACT_VERSION,
    deviceRole: "coach",
    artifacts,
  };
  await persist("post_bundle_assembly", correlationId);

  await persist("pre_validation", correlationId);
  resolvedDeps.validateBundle(bundle);
  await persist("post_validation", correlationId);

  await persist("capture_complete", correlationId);
  return bundle;
}
