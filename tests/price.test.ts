import { describe, expect, it } from "vitest";
import { priceFromDecimals, resolvePrice } from "@/shared/price";

describe("priceFromDecimals", () => {
  it("matches the contract formula for 18 decimals", () => {
    expect(priceFromDecimals(18)).toBe(5_000_000_000_000_000n);
  });

  it("matches the contract formula for 6 decimals", () => {
    expect(priceFromDecimals(6)).toBe(5_000n);
  });

  it("supports the minimum 3 decimals", () => {
    expect(priceFromDecimals(3)).toBe(5n);
  });

  it("returns null below 3 decimals, where the contract reverts", () => {
    expect(priceFromDecimals(2)).toBeNull();
    expect(priceFromDecimals(0)).toBeNull();
    expect(priceFromDecimals(-1)).toBeNull();
  });

  it("rejects non-integer and absurd decimals", () => {
    expect(priceFromDecimals(18.5)).toBeNull();
    expect(priceFromDecimals(78)).toBeNull();
    expect(priceFromDecimals(null)).toBeNull();
    expect(priceFromDecimals(undefined)).toBeNull();
  });
});

describe("resolvePrice", () => {
  it("prefers the contract's PRICE read", () => {
    expect(resolvePrice({ contractPrice: 123n, decimals: 18 })).toEqual({
      price: 123n,
      source: "contract",
    });
  });

  it("falls back to decimals when PRICE reverts", () => {
    expect(resolvePrice({ contractPrice: null, decimals: 6 })).toEqual({
      price: 5_000n,
      source: "decimals",
    });
  });

  it("treats a zero PRICE as a failed read", () => {
    expect(resolvePrice({ contractPrice: 0n, decimals: 18 })).toEqual({
      price: 5_000_000_000_000_000n,
      source: "decimals",
    });
  });

  it("reports unavailable when neither source works", () => {
    expect(resolvePrice({ decimals: 2 })).toEqual({ price: null, source: "unavailable" });
    expect(resolvePrice({})).toEqual({ price: null, source: "unavailable" });
  });
});
