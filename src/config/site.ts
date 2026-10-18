function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

const DEFAULT_SITE_URL = "https://pixelfun.xyz";

/** Public production origin. Override per deployment with NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL);

/** Safe URL object for Next metadata; invalid env values fall back to the default. */
export const SITE_ORIGIN = (() => {
  try {
    return new URL(SITE_URL);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
})();

export const SITE_NAME = "PixelFun";
export const SITE_TITLE = "PixelFun — fully on-chain pixel canvas";
export const SITE_DESCRIPTION =
  "Paint pixels on a shared 512×512 canvas on Robinhood Chain. 0.005 IMD per pixel, sent to the dead address. No database, no indexer.";
