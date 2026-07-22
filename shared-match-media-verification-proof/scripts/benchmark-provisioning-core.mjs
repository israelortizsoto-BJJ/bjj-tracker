export const CERTIFIED_TRANSPORT_PART_BYTES = 99_000_000;

const PROVISIONING_STRATEGY_VERSION = "transport-safe-99m-v1";
const SUPPORTED_BENCHMARK_GIB = new Set([1, 5, 10, 20]);
const BYTES_PER_GIB = 1024 * 1024 * 1024;
const MIN_MULTIPART_PART_BYTES = 5 * 1024 * 1024;
const MAX_MULTIPART_PARTS = 10_000;

export function createBenchmarkProvisioningPlan(sizeGiB) {
  if (!Number.isSafeInteger(sizeGiB) || !SUPPORTED_BENCHMARK_GIB.has(sizeGiB)) {
    throw new TypeError("sizeGiB must be one of 1, 5, 10, or 20");
  }

  const totalBytes = sizeGiB * BYTES_PER_GIB;
  const partCount = Math.ceil(totalBytes / CERTIFIED_TRANSPORT_PART_BYTES);
  const finalPartBytes = totalBytes - CERTIFIED_TRANSPORT_PART_BYTES * (partCount - 1);
  if (
    !Number.isSafeInteger(totalBytes) ||
    !Number.isSafeInteger(partCount) ||
    !Number.isSafeInteger(finalPartBytes) ||
    partCount < 1 ||
    partCount > MAX_MULTIPART_PARTS ||
    finalPartBytes < MIN_MULTIPART_PART_BYTES ||
    finalPartBytes > CERTIFIED_TRANSPORT_PART_BYTES
  ) {
    throw new RangeError("benchmark provisioning plan is outside safe integer bounds");
  }

  return Object.freeze({
    sizeGiB,
    totalBytes,
    standardPartBytes: CERTIFIED_TRANSPORT_PART_BYTES,
    partCount,
    finalPartBytes,
    provisioningStrategyVersion: PROVISIONING_STRATEGY_VERSION,
  });
}

export function benchmarkPartBytes(plan, partNumber) {
  if (!Number.isSafeInteger(partNumber) || partNumber < 1 || partNumber > plan.partCount) {
    throw new RangeError("partNumber is outside the provisioning plan");
  }
  return partNumber === plan.partCount ? plan.finalPartBytes : plan.standardPartBytes;
}
