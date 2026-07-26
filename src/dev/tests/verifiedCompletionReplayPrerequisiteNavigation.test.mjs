import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const devSettings = readFileSync(
  resolve(process.cwd(), "app/(tabs)/profile/dev-settings.tsx"),
  "utf8",
);

describe("verified completion prerequisite DEV navigation", () => {
  it("uses the existing DEV-only router helper for exactly the local inspector route", () => {
    const headingIndex = devSettings.indexOf("VERIFIED COMPLETION");
    const section = devSettings.slice(
      devSettings.lastIndexOf("{__DEV__ ? (", headingIndex),
      devSettings.indexOf("<View style={{ marginTop: 18 }}>", headingIndex + 1),
    );
    assert.match(section, /\{__DEV__ \? \(/);
    assert.match(section, /title="Verified Completion Prerequisites"/);
    assert.match(section, /path=\{"\/dev\/verified-completion-replay-prerequisites" as Href\}/);
    assert.doesNotMatch(section, /Competition State Auditor|dumpCompetitionAuditorTrail/);
    assert.match(devSettings, /onPress=\{\(\) => router\.push\(path\)\}/);
  });
});
