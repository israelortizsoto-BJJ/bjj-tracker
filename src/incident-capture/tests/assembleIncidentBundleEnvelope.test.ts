import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assembleIncidentBundleEnvelope } from "../assembleIncidentBundleEnvelope";
import { INCIDENT_BUNDLE_CONTRACT_VERSION } from "../incidentBundleContract";

const CAPTURED_AT = "2026-06-19T12:00:00.000Z";
const CORRELATION_ID = "corr-parent-001";

describe("assembleIncidentBundleEnvelope", () => {
  it("maps device context and correlation fields into Tier 0 envelope", () => {
    const envelope = assembleIncidentBundleEnvelope({
      deviceRole: "parent",
      platform: "ios",
      buildNumber: "42",
      appVariant: "dev",
      syncConfigured: true,
      writerLinkCount: 2,
      capturedAt: CAPTURED_AT,
      incidentCorrelationId: CORRELATION_ID,
    });

    assert.equal(envelope.bundleVersion, INCIDENT_BUNDLE_CONTRACT_VERSION);
    assert.equal(envelope.capturedAt, CAPTURED_AT);
    assert.equal(envelope.deviceRole, "parent");
    assert.equal(envelope.platform, "ios");
    assert.equal(envelope.buildNumber, "42");
    assert.equal(envelope.appVariant, "dev");
    assert.equal(envelope.syncConfigured, true);
    assert.equal(envelope.writerLinkCount, 2);
    assert.equal(envelope.incidentCorrelationId, CORRELATION_ID);
    assert.equal(envelope.exportSource, "developer_tools");
  });

  it("preserves coach role and android platform", () => {
    const envelope = assembleIncidentBundleEnvelope({
      deviceRole: "coach",
      platform: "android",
      buildNumber: "unknown",
      appVariant: "prod",
      syncConfigured: false,
      writerLinkCount: 0,
      capturedAt: CAPTURED_AT,
      incidentCorrelationId: CORRELATION_ID,
    });

    assert.equal(envelope.deviceRole, "coach");
    assert.equal(envelope.platform, "android");
    assert.equal(envelope.writerLinkCount, 0);
  });
});
