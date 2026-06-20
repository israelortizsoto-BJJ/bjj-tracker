import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const DEV_SETTINGS_PATH = resolve(
  process.cwd(),
  "app/(tabs)/profile/dev-settings.tsx",
);

describe("developer settings incident export boundary", () => {
  it("persists capture_call_boundary after pre_capture before captureIncidentBundle", () => {
    const source = readFileSync(DEV_SETTINGS_PATH, "utf8");

    const preCaptureIndex = source.indexOf('persistIncidentExportStage("pre_capture"');
    const boundaryIndex = source.indexOf('persistIncidentExportStage("capture_call_boundary"');
    const captureIndex = source.indexOf("captureIncidentBundle({");

    assert.ok(preCaptureIndex >= 0, "pre_capture marker must exist");
    assert.ok(boundaryIndex >= 0, "capture_call_boundary marker must exist");
    assert.ok(captureIndex >= 0, "captureIncidentBundle call must exist");
    assert.ok(preCaptureIndex < boundaryIndex);
    assert.ok(boundaryIndex < captureIndex);
  });
});
