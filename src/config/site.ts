/**
 * Public origin resolution.
 *
 * Order:
 *  1. NEXT_PUBLIC_SITE_URL (must include the protocol, e.g. https://pixelfun.example)
 *  2. https://$VERCEL_PROJECT_PRODUCTION_URL — Vercel injects the host without a protocol
 *  3. http://localhost:3000 — local development
 *
 * There is deliberately no hard-coded production domain: a wrong default would
 * put the wrong origin in canonical, OG, Twitter and share links.
 */

const LOCAL_FALLBACK = "http://localhost:3000";

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Pure resolver so the order can be unit-tested without touching process.env. */
export function resolveSiteUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    const candidate = stripTrailingSlashes(explicit);
    if (isHttpUrl(candidate)) return candidate;
  }

  const vercelHost = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelHost) {
    // The system variable has no protocol; tolerate one if it is ever added.
    const host = stripTrailingSlashes(vercelHost.replace(/^https?:\/\//i, ""));
    if (host) return `https://${host}`;
  }

  return LOCAL_FALLBACK;
}

/** Public origin used for metadata, OG/Twitter images and the SSR share href. */
export const SITE_URL = resolveSiteUrl();

/** Safe URL object for Next metadata. */
export const SITE_ORIGIN = new URL(SITE_URL);

export const SITE_NAME = "PixelFun";
export const SITE_TITLE = "PixelFun — fully on-chain pixel canvas";
export const SITE_DESCRIPTION =
  "Paint pixels on a shared 512×512 canvas on Robinhood Chain. 0.005 IMD per pixel, sent to the dead address. No database, no indexer.";
