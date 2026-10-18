"use client";

import { CONTRACTS_CONFIGURED } from "@/config/chains";
import { useStats } from "@/lib/hooks/useLeaderboard";
import { formatCount, formatToken } from "@/lib/format";
import { useRuntimeConfig } from "@/lib/runtime";
import { TOKEN_SYMBOL } from "@/shared/palette";

export function StatsBar() {
  const { mockMode } = useRuntimeConfig();
  const enabled = mockMode || CONTRACTS_CONFIGURED;
  const stats = useStats(enabled);

  if (!enabled) return null;

  const data = stats.data;
  const painted = data ? BigInt(data.totalPixelsPainted) : undefined;
  const burned = data ? BigInt(data.burned) : undefined;
  const round = data ? BigInt(data.currentEpoch).toString() : null;

  return (
    <div className="border-t-2 border-line bg-panel/85">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5">
        <div className="flex items-baseline gap-1.5" title="Cumulative pixels painted on-chain">
          <span className="text-[8px] font-bold uppercase tracking-wider text-muted">
            Total painted
          </span>
          <span className="pixel-font text-[10px] leading-none sm:text-sm">
            {data ? formatCount(painted) : "—"}
          </span>
          <span className="text-[8px] uppercase text-muted">px</span>
        </div>

        <div className="flex items-baseline gap-1.5" title="Total IMD burned by painting">
          <span className="text-[8px] font-bold uppercase tracking-wider text-muted">
            Burned
          </span>
          <span className="pixel-font text-[10px] leading-none text-accent sm:text-sm">
            {data ? formatToken(burned, data.decimals, 4) : "—"}
          </span>
          <span className="text-[8px] uppercase text-muted">{TOKEN_SYMBOL}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {stats.error && (
            <button
              type="button"
              onClick={() => void stats.refetch()}
              className="text-[8px] font-bold uppercase tracking-wide text-accent underline underline-offset-2"
              title={stats.error instanceof Error ? stats.error.message : "Stats unavailable"}
            >
              Stats offline · retry
            </button>
          )}
          {round !== null && (
            <span className="border-2 border-line px-1.5 py-0.5 font-mono text-[9px] text-muted">
              ROUND #{round}
            </span>
          )}
          {!data && !stats.error && (
            <span className="pf-blink text-[9px] text-muted">SYNC…</span>
          )}
        </div>
      </div>
    </div>
  );
}
