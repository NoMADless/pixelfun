import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "@/config/site";

describe("resolveSiteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL and strips trailing slashes", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "https://canvas.example/",
        VERCEL_PROJECT_PRODUCTION_URL: "pixelfun.vercel.app",
      }),
    ).toBe("https://canvas.example");
  });

  it("uses the Vercel production host when the explicit URL is unset", () => {
    expect(
      resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "pixelfun.vercel.app" }),
    ).toBe("https://pixelfun.vercel.app");
  });

  it("tolerates a protocol or trailing slash in the Vercel host", () => {
    expect(
      resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "https://pixelfun.vercel.app/" }),
    ).toBe("https://pixelfun.vercel.app");
  });

  it("falls back to localhost when neither variable is set", () => {
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
  });

  it("ignores an explicit value that is not an http(s) URL", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "pixelfun.example",
        VERCEL_PROJECT_PRODUCTION_URL: "preview.vercel.app",
      }),
    ).toBe("https://preview.vercel.app");
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" })).toBe(
      "http://localhost:3000",
    );
  });

  it("never invents the old pixelfun.xyz domain", () => {
    expect(resolveSiteUrl({})).not.toContain("pixelfun.xyz");
    expect(
      resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "pixelfun.vercel.app" }),
    ).not.toContain("pixelfun.xyz");
  });
});
