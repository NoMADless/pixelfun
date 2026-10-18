import { formatUnits } from "viem";

export function shortenAddress(address: string | null | undefined, size = 4): string {
  if (!address) return "";
  return `${address.slice(0, 2 + size)}…${address.slice(-size)}`;
}

export function formatToken(
  raw: bigint | undefined,
  decimals: number | undefined,
  maxFraction = 4,
): string {
  if (raw === undefined || decimals === undefined) return "—";
  const value = formatUnits(raw, decimals);
  const [whole, fraction = ""] = value.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (!fraction) return grouped;
  const trimmed = fraction.slice(0, maxFraction).replace(/0+$/, "");
  return trimmed ? `${grouped}.${trimmed}` : grouped;
}

export function formatCount(value: bigint | number | undefined): string {
  if (value === undefined) return "—";
  return Number(value).toLocaleString();
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const candidate = error as Error & { shortMessage?: string; details?: string };
    return candidate.shortMessage || candidate.details || error.message;
  }
  return String(error);
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "never";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}
