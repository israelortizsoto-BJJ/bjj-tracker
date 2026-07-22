import assert from "node:assert/strict";
import test from "node:test";
import {
  CERTIFIED_TRANSPORT_PART_BYTES,
  benchmarkPartBytes,
  createBenchmarkProvisioningPlan,
} from "./benchmark-provisioning-core.mjs";

const expectedPlans = [
  { sizeGiB: 1, totalBytes: 1_073_741_824, partCount: 11, finalPartBytes: 83_741_824 },
  { sizeGiB: 5, totalBytes: 5_368_709_120, partCount: 55, finalPartBytes: 22_709_120 },
  { sizeGiB: 10, totalBytes: 10_737_418_240, partCount: 109, finalPartBytes: 45_418_240 },
  { sizeGiB: 20, totalBytes: 21_474_836_480, partCount: 217, finalPartBytes: 90_836_480 },
];

test("certified transport plans are exact for every supported benchmark", () => {
  assert.equal(CERTIFIED_TRANSPORT_PART_BYTES, 99_000_000);
  for (const expected of expectedPlans) {
    const plan = createBenchmarkProvisioningPlan(expected.sizeGiB);
    assert.deepEqual(plan, {
      ...expected,
      standardPartBytes: CERTIFIED_TRANSPORT_PART_BYTES,
      provisioningStrategyVersion: "transport-safe-99m-v1",
    });
    assert.equal(Object.isFrozen(plan), true);
    assert.equal(benchmarkPartBytes(plan, 1), CERTIFIED_TRANSPORT_PART_BYTES);
    assert.equal(benchmarkPartBytes(plan, plan.partCount), expected.finalPartBytes);
    assert.equal(
      CERTIFIED_TRANSPORT_PART_BYTES * (plan.partCount - 1) + plan.finalPartBytes,
      plan.totalBytes,
    );
    assert.equal(Number.isSafeInteger(plan.totalBytes), true);
    assert.equal(Number.isSafeInteger(plan.partCount), true);
    assert.equal(Number.isSafeInteger(plan.finalPartBytes), true);
    assert.equal(plan.partCount <= 10_000, true);
    assert.equal(plan.finalPartBytes >= 5 * 1024 * 1024, true);
    assert.equal(plan.finalPartBytes <= CERTIFIED_TRANSPORT_PART_BYTES, true);
  }
});

test("provisioning calculations are deterministic", () => {
  assert.deepEqual(createBenchmarkProvisioningPlan(10), createBenchmarkProvisioningPlan(10));
});

test("unsupported benchmark sizes are rejected", () => {
  for (const value of [0, 2, 10.5, NaN, Infinity, "10", null, undefined]) {
    assert.throws(() => createBenchmarkProvisioningPlan(value), TypeError);
  }
});

test("part lookup rejects numbers outside the plan", () => {
  const plan = createBenchmarkProvisioningPlan(10);
  for (const value of [0, plan.partCount + 1, 1.5, NaN]) {
    assert.throws(() => benchmarkPartBytes(plan, value), RangeError);
  }
});
