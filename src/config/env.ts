import { isAddress } from "viem";

export interface EnvIssue {
  variable: string;
  problem: string;
}

type Env = Record<string, string | undefined>;

function truthy(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function looksLikeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Collect every configuration problem at once so a deployment failure names all
 * of the missing variables, rather than only the first one it hits.
 */
export function collectEnvIssues(env: Env = process.env): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const mockValue = env.MOCK_MODE?.trim();
  if (mockValue && !["0", "1", "true", "false", "yes", "no", "on", "off"].includes(mockValue.toLowerCase())) {
    issues.push({ variable: "MOCK_MODE", problem: "must be true or false" });
  }

  const mock = truthy(env.MOCK_MODE) || truthy(env.NEXT_PUBLIC_MOCK_MODE);
  if (mock) return issues;

  const vault = env.NEXT_PUBLIC_VAULT_ADDRESS?.trim();
  if (!vault) {
    issues.push({ variable: "NEXT_PUBLIC_VAULT_ADDRESS", problem: "is required when MOCK_MODE=false" });
  } else if (!isAddress(vault)) {
    issues.push({ variable: "NEXT_PUBLIC_VAULT_ADDRESS", problem: "must be a valid EVM address" });
  }

  const imd = env.NEXT_PUBLIC_IMD_ADDRESS?.trim();
  if (!imd) {
    issues.push({ variable: "NEXT_PUBLIC_IMD_ADDRESS", problem: "is required when MOCK_MODE=false" });
  } else if (!isAddress(imd)) {
    issues.push({ variable: "NEXT_PUBLIC_IMD_ADDRESS", problem: "must be a valid EVM address" });
  }

  const chainId = env.NEXT_PUBLIC_CHAIN_ID?.trim();
  if (chainId && (!/^\d+$/.test(chainId) || Number(chainId) <= 0)) {
    issues.push({ variable: "NEXT_PUBLIC_CHAIN_ID", problem: "must be a positive integer" });
  }

  for (const variable of ["NEXT_PUBLIC_RPC_URL", "NEXT_PUBLIC_EXPLORER_URL", "NEXT_PUBLIC_SITE_URL"]) {
    const value = env[variable]?.trim();
    if (value && !looksLikeHttpUrl(value)) {
      issues.push({ variable, problem: "must be an http(s) URL" });
    }
  }

  return issues;
}

export function formatEnvIssues(issues: readonly EnvIssue[]): string {
  return issues.map((issue) => `  - ${issue.variable}: ${issue.problem}`).join("\n");
}

export function deploymentEnvHint(env: Env = process.env): string {
  const issues = collectEnvIssues(env);
  if (issues.length === 0) return "";
  return `Missing or invalid environment:\n${formatEnvIssues(issues)}`;
}
