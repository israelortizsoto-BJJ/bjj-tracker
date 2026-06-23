import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const CAPTURE_INCIDENT_BUNDLE_PATH = resolve(
  process.cwd(),
  "src/incident-capture/captureIncidentBundle.ts",
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

});
