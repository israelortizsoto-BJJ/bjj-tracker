export const INCIDENT_CAPTURE_DEBUG_STORAGE_KEY = "mm:v1:incidentCaptureDebug";

export const INCIDENT_CAPTURE_CRASH_ALERT_WINDOW_MS = 5 * 60 * 1000;

export type IncidentCaptureStage =
  | "capture_function_entered"
  | "capture_before_assert_inputs"
  | "capture_after_assert_inputs"
  | "capture_before_resolve_deps"
  | "capture_after_resolve_deps"
  | "capture_before_timestamp"
  | "capture_after_timestamp"
  | "capture_before_authority"
  | "load_deps_entered"
  | "load_deps_before_context"
  | "load_deps_after_context"
  | "load_deps_before_platform_boundary"
  | "load_deps_before_platform"
  | "load_deps_after_platform_boundary"
  | "load_deps_platform_entered"
  | "load_deps_control_import_start"
  | "load_deps_control_import_promise_created"
  | "load_deps_control_import_resolved"
  | "load_deps_before_platform_react_native"
  | "load_deps_react_native_import_start"
  | "load_deps_react_native_before_import_expression"
  | "load_deps_react_native_after_import_expression"
  | "load_deps_react_native_import_promise_created"
  | "load_deps_react_native_before_get_storage"
  | "load_deps_react_native_after_storage_reference_read"
  | "load_deps_react_native_after_correlation_reference_read"
  | "load_deps_react_native_after_active_trace_assignment"
  | "load_deps_react_native_before_get_storage_call"
  | "load_deps_react_native_get_storage_call_gap_marker_1"
  | "load_deps_react_native_get_storage_call_gap_marker_2"
  | "load_deps_react_native_get_storage_call_gap_marker_3"
  | "load_deps_react_native_after_get_storage_call"
  | "load_deps_react_native_get_storage_function_entered"
  | "load_deps_react_native_entered_get_storage"
  | "load_deps_react_native_before_async_storage_import"
  | "load_deps_react_native_after_async_storage_import"
  | "load_deps_react_native_before_storage_resolution"
  | "load_deps_react_native_after_storage_resolution"
  | "load_deps_react_native_before_return_storage"
  | "load_deps_react_native_after_return_storage_resumed"
  | "load_deps_react_native_after_get_storage"
  | "load_deps_react_native_import_promise_created_persist_entered"
  | "load_deps_react_native_import_promise_created_before_storage_write"
  | "load_deps_react_native_import_promise_created_after_storage_write"
  | "load_deps_react_native_import_promise_created_before_return"
  | "load_deps_react_native_after_import_promise_created_await_resumed"
  | "load_deps_react_native_after_import_promise_created_persist"
  | "load_deps_react_native_before_microtask_marker_call"
  | "load_deps_react_native_before_microtask_yield"
  | "load_deps_react_native_after_microtask_yield"
  | "load_deps_react_native_after_microtask_marker_call"
  | "load_deps_react_native_after_promise_variable_assignment"
  | "load_deps_react_native_before_before_import_await_persist"
  | "load_deps_react_native_before_import_await"
  | "load_deps_react_native_after_before_import_await_persist"
  | "load_deps_react_native_import_fulfilled"
  | "load_deps_react_native_import_rejected"
  | "load_deps_react_native_after_import_await"
  | "load_deps_react_native_before_module_assignment"
  | "load_deps_react_native_after_module_assignment"
  | "load_deps_react_native_module_received"
  | "load_deps_after_platform_react_native"
  | "load_deps_before_platform_expo_constants"
  | "load_deps_after_platform_expo_constants"
  | "load_deps_after_platform"
  | "load_deps_before_authority"
  | "load_deps_after_authority"
  | "load_deps_before_hydration"
  | "load_deps_after_hydration"
  | "load_deps_before_worker"
  | "load_deps_after_worker"
  | "load_deps_complete"
  | "pre_authority"
  | "post_authority"
  | "pre_hydration"
  | "post_hydration"
  | "pre_worker"
  | "post_worker"
  | "pre_topology"
  | "post_topology"
  | "pre_bundle_assembly"
  | "post_bundle_assembly"
  | "pre_validation"
  | "post_validation"
  | "capture_complete";

export type IncidentCaptureDebugRecord = {
  stage: IncidentCaptureStage;
  at: string;
  correlationId: string;
};

export type PersistCaptureStage = (
  stage: IncidentCaptureStage,
  correlationId: string,
) => Promise<void>;

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

let storageOverride: StorageAdapter | null = null;
let lastResolvedStorage: StorageAdapter | null = null;
let activeGetStorageTraceCorrelationId: string | null = null;

/** Test-only hook to avoid AsyncStorage in unit tests. */
export function __setIncidentCaptureDebugStorageForTests(
  adapter: StorageAdapter | null,
): void {
  storageOverride = adapter;
}

async function getStorage(): Promise<StorageAdapter> {
  if (activeGetStorageTraceCorrelationId && lastResolvedStorage) {
    await writeRawCaptureStage(
      lastResolvedStorage,
      "load_deps_react_native_get_storage_function_entered",
      activeGetStorageTraceCorrelationId,
    );
  }
  if (storageOverride) {
    if (activeGetStorageTraceCorrelationId) {
      await writeRawCaptureStage(
        storageOverride,
        "load_deps_react_native_entered_get_storage",
        activeGetStorageTraceCorrelationId,
      );
      await writeRawCaptureStage(
        storageOverride,
        "load_deps_react_native_before_storage_resolution",
        activeGetStorageTraceCorrelationId,
      );
    }
    lastResolvedStorage = storageOverride;
    if (activeGetStorageTraceCorrelationId) {
      await writeRawCaptureStage(
        storageOverride,
        "load_deps_react_native_after_storage_resolution",
        activeGetStorageTraceCorrelationId,
      );
      await writeRawCaptureStage(
        storageOverride,
        "load_deps_react_native_before_return_storage",
        activeGetStorageTraceCorrelationId,
      );
    }
    return storageOverride;
  }
  if (activeGetStorageTraceCorrelationId && lastResolvedStorage) {
    await writeRawCaptureStage(
      lastResolvedStorage,
      "load_deps_react_native_entered_get_storage",
      activeGetStorageTraceCorrelationId,
    );
    await writeRawCaptureStage(
      lastResolvedStorage,
      "load_deps_react_native_before_async_storage_import",
      activeGetStorageTraceCorrelationId,
    );
  }
  const AsyncStorageModule = await import("@react-native-async-storage/async-storage");
  if (activeGetStorageTraceCorrelationId && lastResolvedStorage) {
    await writeRawCaptureStage(
      lastResolvedStorage,
      "load_deps_react_native_after_async_storage_import",
      activeGetStorageTraceCorrelationId,
    );
    await writeRawCaptureStage(
      lastResolvedStorage,
      "load_deps_react_native_before_storage_resolution",
      activeGetStorageTraceCorrelationId,
    );
  }
  const AsyncStorage = AsyncStorageModule.default;
  lastResolvedStorage = AsyncStorage;
  if (activeGetStorageTraceCorrelationId) {
    await writeRawCaptureStage(
      AsyncStorage,
      "load_deps_react_native_after_storage_resolution",
      activeGetStorageTraceCorrelationId,
    );
    await writeRawCaptureStage(
      AsyncStorage,
      "load_deps_react_native_before_return_storage",
      activeGetStorageTraceCorrelationId,
    );
  }
  return AsyncStorage;
}

async function writeRawCaptureStage(
  storage: StorageAdapter,
  stage: IncidentCaptureStage,
  correlationId: string,
): Promise<void> {
  await storage.setItem(
    INCIDENT_CAPTURE_DEBUG_STORAGE_KEY,
    JSON.stringify({
      stage,
      at: new Date().toISOString(),
      correlationId,
    } satisfies IncidentCaptureDebugRecord),
  );
}

export async function loadIncidentCaptureDebugRecord(): Promise<IncidentCaptureDebugRecord | null> {
  try {
    const storage = await getStorage();
    const raw = await storage.getItem(INCIDENT_CAPTURE_DEBUG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IncidentCaptureDebugRecord>;
    if (typeof parsed.stage !== "string" || typeof parsed.at !== "string") return null;
    return {
      stage: parsed.stage as IncidentCaptureStage,
      at: parsed.at,
      correlationId: typeof parsed.correlationId === "string" ? parsed.correlationId : "",
    };
  } catch {
    return null;
  }
}

export async function persistIncidentCaptureStage(
  stage: IncidentCaptureStage,
  correlationId: string,
): Promise<IncidentCaptureDebugRecord> {
  const record: IncidentCaptureDebugRecord = {
    stage,
    at: new Date().toISOString(),
    correlationId,
  };
  const traceReactNativeImportPromiseCreated =
    stage === "load_deps_react_native_import_promise_created";
  if (traceReactNativeImportPromiseCreated && lastResolvedStorage) {
    await writeRawCaptureStage(
      lastResolvedStorage,
      "load_deps_react_native_before_get_storage",
      correlationId,
    );
    const traceStorageReference = lastResolvedStorage;
    await writeRawCaptureStage(
      traceStorageReference,
      "load_deps_react_native_after_storage_reference_read",
      correlationId,
    );
    const traceCorrelationReference = correlationId;
    await writeRawCaptureStage(
      traceStorageReference,
      "load_deps_react_native_after_correlation_reference_read",
      traceCorrelationReference,
    );
  }
  if (traceReactNativeImportPromiseCreated) {
    activeGetStorageTraceCorrelationId = correlationId;
    if (lastResolvedStorage) {
      await writeRawCaptureStage(
        lastResolvedStorage,
        "load_deps_react_native_after_active_trace_assignment",
        correlationId,
      );
      await writeRawCaptureStage(
        lastResolvedStorage,
        "load_deps_react_native_before_get_storage_call",
        correlationId,
      );
      await writeRawCaptureStage(
        lastResolvedStorage,
        "load_deps_react_native_get_storage_call_gap_marker_1",
        correlationId,
      );
      await writeRawCaptureStage(
        lastResolvedStorage,
        "load_deps_react_native_get_storage_call_gap_marker_2",
        correlationId,
      );
      await writeRawCaptureStage(
        lastResolvedStorage,
        "load_deps_react_native_get_storage_call_gap_marker_3",
        correlationId,
      );
      await writeRawCaptureStage(
        lastResolvedStorage,
        "load_deps_react_native_after_get_storage_call",
        correlationId,
      );
    }
  }
  const storage = await getStorage();
  if (traceReactNativeImportPromiseCreated) {
    activeGetStorageTraceCorrelationId = null;
    await writeRawCaptureStage(
      storage,
      "load_deps_react_native_after_return_storage_resumed",
      correlationId,
    );
    await writeRawCaptureStage(
      storage,
      "load_deps_react_native_after_get_storage",
      correlationId,
    );
    await writeRawCaptureStage(
      storage,
      "load_deps_react_native_import_promise_created_persist_entered",
      correlationId,
    );
    await writeRawCaptureStage(
      storage,
      "load_deps_react_native_import_promise_created_before_storage_write",
      correlationId,
    );
  }
  await storage.setItem(INCIDENT_CAPTURE_DEBUG_STORAGE_KEY, JSON.stringify(record));
  if (traceReactNativeImportPromiseCreated) {
    await writeRawCaptureStage(
      storage,
      "load_deps_react_native_import_promise_created_after_storage_write",
      correlationId,
    );
    await writeRawCaptureStage(
      storage,
      "load_deps_react_native_import_promise_created_before_return",
      correlationId,
    );
  }
  return record;
}

export function formatIncidentCaptureStageReadout(
  record: IncidentCaptureDebugRecord | null,
): string {
  if (!record) return "none";
  return `${record.stage} (${record.at})`;
}

export function isRecentIncompleteCapture(
  record: IncidentCaptureDebugRecord,
): boolean {
  if (record.stage === "capture_complete") return false;
  const atMs = Date.parse(record.at);
  if (Number.isNaN(atMs)) return false;
  return Date.now() - atMs < INCIDENT_CAPTURE_CRASH_ALERT_WINDOW_MS;
}
