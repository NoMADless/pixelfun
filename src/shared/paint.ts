export interface PaintBatch {
  ids: number[];
  colors: number[];
}

/** 20% buffer used for the explicit gas limit on paint transactions. */
export const GAS_BUFFER_NUMERATOR = 120n;
export const GAS_BUFFER_DENOMINATOR = 100n;

/**
 * Paint writes 100 storage slots, so a node's estimate can be close to the
 * actual cost. Send an explicit limit with 20% headroom (rounded up).
 */
export function gasLimitWithBuffer(
  estimate: bigint,
  numerator = GAS_BUFFER_NUMERATOR,
  denominator = GAS_BUFFER_DENOMINATOR,
): bigint {
  if (estimate <= 0n) throw new RangeError("gas estimate must be positive.");
  if (numerator <= 0n || denominator <= 0n) {
    throw new RangeError("gas buffer must be positive.");
  }
  return (estimate * numerator + denominator - 1n) / denominator;
}

/** Detect the common node/wallet out-of-gas errors for a clear UI message. */
export function isOutOfGasError(error: unknown): boolean {
  const message = (
    error instanceof Error
      ? `${error.message} ${(error as Error & { details?: string }).details ?? ""} ${
          (error as Error & { shortMessage?: string }).shortMessage ?? ""
        }`
      : String(error)
  ).toLowerCase();
  return [
    "out of gas",
    "intrinsic gas too low",
    "gas required exceeds allowance",
    "exceeds block gas limit",
    "gas limit reached",
  ].some((needle) => message.includes(needle));
}

/**
 * Cost of a paint in the token's smallest unit. The contract charges PRICE per
 * pixel, and the full amount is burned at paint time.
 */
export function paintCost(price: bigint, pixelCount: number): bigint {
  if (!Number.isInteger(pixelCount) || pixelCount < 0) {
    throw new RangeError("pixelCount must be a non-negative integer.");
  }
  if (price < 0n) throw new RangeError("price must not be negative.");
  return price * BigInt(pixelCount);
}

/** Number of transactions needed for a paint, given the contract MAX_BATCH. */
export function batchCount(pixelCount: number, maxBatch: number): number {
  if (!Number.isInteger(pixelCount) || pixelCount < 0) {
    throw new RangeError("pixelCount must be a non-negative integer.");
  }
  if (!Number.isInteger(maxBatch) || maxBatch < 1) {
    throw new RangeError("maxBatch must be a positive integer.");
  }
  return Math.ceil(pixelCount / maxBatch);
}

/**
 * Split ids/colors into contract-sized batches. The contract takes ids and
 * colors as parallel arrays, so both sides are always sliced together.
 */
export function splitPaintBatches(
  ids: readonly number[],
  colors: readonly number[],
  maxBatch: number,
): PaintBatch[] {
  if (ids.length !== colors.length) {
    throw new Error("ids and colors must have the same length.");
  }
  if (!Number.isInteger(maxBatch) || maxBatch < 1) {
    throw new RangeError("maxBatch must be a positive integer.");
  }

  const batches: PaintBatch[] = [];
  for (let offset = 0; offset < ids.length; offset += maxBatch) {
    batches.push({
      ids: ids.slice(offset, offset + maxBatch),
      colors: colors.slice(offset, offset + maxBatch),
    });
  }
  return batches;
}
