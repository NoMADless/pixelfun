import { describe, expect, it } from "vitest";
import {
  batchCount,
  gasLimitWithBuffer,
  isOutOfGasError,
  paintCost,
  splitPaintBatches,
} from "@/shared/paint";

const PRICE = 5_000_000_000_000_000n; // 0.005 IMD at 18 decimals

describe("paintCost", () => {
  it("multiplies PRICE by the number of pixels", () => {
    expect(paintCost(PRICE, 100)).toBe(500_000_000_000_000_000n);
  });

  it("is zero for an empty draft", () => {
    expect(paintCost(PRICE, 0)).toBe(0n);
  });

  it("rejects fractional and negative counts", () => {
    expect(() => paintCost(PRICE, 1.5)).toThrow(RangeError);
    expect(() => paintCost(PRICE, -1)).toThrow(RangeError);
  });
});

describe("gasLimitWithBuffer", () => {
  it("adds 20% and rounds up", () => {
    expect(gasLimitWithBuffer(2_712_676n)).toBe(3_255_212n);
    expect(gasLimitWithBuffer(100n)).toBe(120n);
    expect(gasLimitWithBuffer(101n)).toBe(122n);
  });

  it("rejects a zero estimate", () => {
    expect(() => gasLimitWithBuffer(0n)).toThrow(RangeError);
  });
});

describe("isOutOfGasError", () => {
  it("detects common node and wallet out-of-gas messages", () => {
    expect(isOutOfGasError(new Error("out of gas"))).toBe(true);
    expect(isOutOfGasError(new Error("intrinsic gas too low"))).toBe(true);
    expect(
      isOutOfGasError(
        Object.assign(new Error("execution reverted"), { details: "gas required exceeds allowance (21000)" }),
      ),
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isOutOfGasError(new Error("InsufficientBalance()"))).toBe(false);
    expect(isOutOfGasError("user rejected the request")).toBe(false);
  });
});

describe("batchCount", () => {
  it("rounds up partial batches", () => {
    expect(batchCount(201, 100)).toBe(3);
    expect(batchCount(200, 100)).toBe(2);
    expect(batchCount(1, 100)).toBe(1);
    expect(batchCount(0, 100)).toBe(0);
  });
});

describe("splitPaintBatches", () => {
  it("splits ids and colors together at MAX_BATCH", () => {
    const ids = [1, 2, 3, 4, 5];
    const colors = [10, 11, 12, 13, 14];
    expect(splitPaintBatches(ids, colors, 2)).toEqual([
      { ids: [1, 2], colors: [10, 11] },
      { ids: [3, 4], colors: [12, 13] },
      { ids: [5], colors: [14] },
    ]);
  });

  it("returns no batches for an empty draft", () => {
    expect(splitPaintBatches([], [], 100)).toEqual([]);
  });

  it("rejects mismatched parallel arrays", () => {
    expect(() => splitPaintBatches([1, 2], [1], 100)).toThrow(/same length/);
  });

  it("rejects an invalid MAX_BATCH", () => {
    expect(() => splitPaintBatches([1], [1], 0)).toThrow(RangeError);
  });
});
