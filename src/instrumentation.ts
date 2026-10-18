import { collectEnvIssues, formatEnvIssues } from "@/config/env";

/**
 * Runs once before a server instance accepts requests. Development and the
 * static build stay usable without a deployed contract so the UI can show its
 * explicit “not deployed” state; a production server fails fast instead.
 */
export function register() {
  const issues = collectEnvIssues();
  if (issues.length === 0) return;

  const message = [
    "PixelFun environment validation failed:",
    formatEnvIssues(issues),
    "",
    "Set these variables in .env.local or your deploy environment, or set MOCK_MODE=true for a demo.",
    "Set PIXELFUN_ALLOW_UNDEPLOYED=1 only if you intentionally want to run the preview without a vault.",
  ].join("\n");

  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  const allowUndeployed = process.env.PIXELFUN_ALLOW_UNDEPLOYED === "1";
  if (process.env.NODE_ENV === "production" && !isBuild && !allowUndeployed) {
    throw new Error(message);
  }
  console.error(message);
}
