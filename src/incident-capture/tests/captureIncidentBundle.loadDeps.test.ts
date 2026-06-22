import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const CAPTURE_INCIDENT_BUNDLE_PATH = resolve(
  process.cwd(),
  "src/incident-capture/captureIncidentBundle.ts",
);

const INCIDENT_CAPTURE_DEBUG_PATH = resolve(
  process.cwd(),
  "src/incident-capture/incidentCaptureDebug.ts",
);

const LOAD_DEPS_STAGE_SEQUENCE = [
  "load_deps_entered",
  "load_deps_before_context",
  "load_deps_after_context",
  "load_deps_before_platform_boundary",
  "load_deps_before_platform",
  "load_deps_after_platform_boundary",
  "load_deps_platform_entered",
  "load_deps_control_import_start",
  "load_deps_control_import_promise_created",
  "load_deps_control_import_resolved",
  "load_deps_before_platform_react_native",
  "load_deps_react_native_import_start",
  "load_deps_react_native_before_import_expression",
  "load_deps_react_native_after_import_expression",
  "load_deps_react_native_import_promise_created",
  "load_deps_react_native_after_import_promise_created_await_resumed",
  "load_deps_react_native_after_import_promise_created_persist",
  "load_deps_react_native_before_microtask_marker_call",
  "load_deps_react_native_before_microtask_yield",
  "load_deps_react_native_after_microtask_yield",
  "load_deps_react_native_after_microtask_marker_call",
  "load_deps_react_native_after_promise_variable_assignment",
  "load_deps_react_native_before_before_import_await_persist",
  "load_deps_react_native_before_import_await",
  "load_deps_react_native_after_before_import_await_persist",
  "load_deps_react_native_import_fulfilled",
  "load_deps_react_native_import_rejected",
  "load_deps_react_native_after_import_await",
  "load_deps_react_native_before_module_assignment",
  "load_deps_react_native_after_module_assignment",
  "load_deps_react_native_module_received",
  "load_deps_after_platform_react_native",
  "load_deps_before_platform_expo_constants",
  "load_deps_after_platform_expo_constants",
  "load_deps_after_platform",
  "load_deps_before_authority",
  "load_deps_after_authority",
  "load_deps_before_hydration",
  "load_deps_after_hydration",
  "load_deps_before_worker",
  "load_deps_after_worker",
  "load_deps_complete",
] as const;

const PERSIST_BOUNDARY_STAGE_SEQUENCE = [
  "load_deps_react_native_before_get_storage",
  "load_deps_react_native_before_get_storage_call",
  "load_deps_react_native_after_get_storage_call",
  "load_deps_react_native_get_storage_function_entered",
  "load_deps_react_native_entered_get_storage",
  "load_deps_react_native_before_async_storage_import",
  "load_deps_react_native_after_async_storage_import",
  "load_deps_react_native_before_storage_resolution",
  "load_deps_react_native_after_storage_resolution",
  "load_deps_react_native_before_return_storage",
  "load_deps_react_native_after_return_storage_resumed",
  "load_deps_react_native_after_get_storage",
  "load_deps_react_native_import_promise_created_persist_entered",
  "load_deps_react_native_import_promise_created_before_storage_write",
  "load_deps_react_native_import_promise_created_after_storage_write",
  "load_deps_react_native_import_promise_created_before_return",
] as const;

describe("captureIncidentBundle production dependency load stages", () => {
  it("persists loadProductionDeps localization stages in order", () => {
    const source = readFileSync(CAPTURE_INCIDENT_BUNDLE_PATH, "utf8");

    const stagePositions = LOAD_DEPS_STAGE_SEQUENCE.map((stage) => ({
      stage,
      index: source.indexOf(`"${stage}"`),
    }));

    for (const { stage, index } of stagePositions) {
      assert.ok(index >= 0, `${stage} marker must exist`);
    }

    for (let i = 1; i < stagePositions.length; i += 1) {
      assert.ok(
        stagePositions[i - 1].index < stagePositions[i].index,
        `${stagePositions[i - 1].stage} must precede ${stagePositions[i].stage}`,
      );
    }
  });

  it("persists react-native promise-created storage boundary markers in order", () => {
    const source = readFileSync(INCIDENT_CAPTURE_DEBUG_PATH, "utf8");

    const stagePositions = PERSIST_BOUNDARY_STAGE_SEQUENCE.map((stage) => ({
      stage,
      index: source.indexOf(`"${stage}"`),
    }));

    for (const { stage, index } of stagePositions) {
      assert.ok(index >= 0, `${stage} marker must exist`);
    }

    for (let i = 1; i < stagePositions.length; i += 1) {
      assert.ok(
        stagePositions[i - 1].index < stagePositions[i].index,
        `${stagePositions[i - 1].stage} must precede ${stagePositions[i].stage}`,
      );
    }
  });
});
