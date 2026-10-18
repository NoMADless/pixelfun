/**
 * PRICE is 0.005 IMD expressed in the token's smallest unit:
 * `5 * 10^(decimals - 3)`.
 *
 * The contract computes this lazily and `PRICE()` is a view, so it is readable
 * before the first deposit/paint. It still reverts when the token exposes fewer
 * than 3 decimals or no decimals() at all, so the app keeps this pure helper as
 * a fallback and for display.
 */
export const PRICE_WHOLE_UNITS = 5n;
export const PRICE_DECIMAL_SHIFT = 3;

export function priceFromDecimals(decimals: number | null | undefined): bigint | null {
  if (decimals === null || decimals === undefined) return null;
  if (!Number.isInteger(decimals) || decimals < PRICE_DECIMAL_SHIFT || decimals > 77) return null;
  return PRICE_WHOLE_UNITS * 10n ** BigInt(decimals - PRICE_DECIMAL_SHIFT);
}

export type PriceSource = "contract" | "decimals" | "unavailable";

export interface ResolvedPrice {
  /** Raw token units per pixel, or null when it cannot be determined. */
  price: bigint | null;
  source: PriceSource;
}

/**
 * Prefer the contract's own PRICE(). When that read fails (or returns zero),
 * fall back to the documented formula using the token decimals.
 */
export function resolvePrice(input: {
  contractPrice?: bigint | null;
  decimals?: number | null;
}): ResolvedPrice {
  if (typeof input.contractPrice === "bigint" && input.contractPrice > 0n) {
    return { price: input.contractPrice, source: "contract" };
  }
  const computed = priceFromDecimals(input.decimals);
  if (computed !== null) return { price: computed, source: "decimals" };
  return { price: null, source: "unavailable" };
}
