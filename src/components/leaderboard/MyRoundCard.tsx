"use client";

import { shortenAddress } from "@/lib/format";
import type { BoardResponse, LeaderboardStats } from "@/shared/leaderboard";

interface Props {
  stats: LeaderboardStats;
  board: BoardResponse | undefined;
  isLoading: boolean;
  viewer: string | null;
  demoViewer: boolean;
}

export function MyRoundCard({ stats, board, isLoading, viewer, demoViewer }: Props) {
  if (!viewer) {
    return (
      <section className="pixel-panel p-3">
        <h2 className="pixel-font text-[10px]">MY RANK</h2>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Connect a wallet from the header to see your round rank, pixel count and whitelist
          eligibility.
        </p>
      </section>
    );
  }

  if (isLoading || !board) {
    return (
      <section className="pixel-panel p-3">
        <h2 className="pixel-font text-[10px]">MY RANK</h2>
        <div className="mt-3 space-y-2">
          <div className="h-8 animate-pulse bg-panel2" />
          <div className="h-3 w-2/3 animate-pulse bg-panel2" />
          <div className="h-2 w-full animate-pulse bg-panel2" />
        </div>
      </section>
    );
  }

  const viewerStats = board.viewer;
  const pixels = viewerStats?.pixels ?? 0;
  const rank = viewerStats?.rank ?? null;
  const minPixels = Math.max(1, stats.minPixels);
  const progress = Math.min(100, (pixels / minPixels) * 100);
  const inWhitelist = rank !== null && rank <= board.boardSize;
  const whitelisted = Boolean(viewerStats?.whitelisted);

  let badge = "BELOW MINIMUM";
  let badgeClass = "border-line text-muted";
  if (board.ended) {
    if (whitelisted) {
      badge = "WHITELISTED";
      badgeClass = "border-pfgreen bg-pfgreen/15 text-pfgreen";
    } else if (inWhitelist) {
      badge = "NOT WHITELISTED";
      badgeClass = "border-accent text-accent";
    } else if (rank !== null) {
      badge = `OUTSIDE TOP ${board.boardSize}`;
      badgeClass = "border-accent text-accent";
    } else {
      badge = "NOT ON BOARD";
      badgeClass = "border-line text-muted";
    }
  } else if (inWhitelist) {
    badge = "WL IF ROUND ENDS NOW";
    badgeClass = "border-accent bg-accent/10 text-accent";
  } else if (pixels >= stats.minPixels) {
    badge = "IN CONTENTION";
    badgeClass = "border-glow bg-glow/20 text-ink";
  }

  const missing = Math.max(0, stats.minPixels - pixels);

  return (
    <section className="pixel-panel p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="pixel-font text-[10px]">MY RANK</h2>
          <p className="mt-1 font-mono text-[9px] text-muted" title={viewer}>
            {demoViewer ? "demo painter · " : ""}
            {shortenAddress(viewer, 5)}
          </p>
        </div>
        <span className={`border-2 px-1.5 py-1 text-[7px] font-bold uppercase ${badgeClass}`}>
          {badge}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="border-2 border-ink bg-panel2 p-2">
          <div className="text-[8px] font-bold uppercase tracking-wider text-muted">Rank</div>
          <div className="pixel-font mt-1 text-sm">{rank !== null ? `#${rank}` : "—"}</div>
        </div>
        <div className="border-2 border-line bg-bg p-2">
          <div className="text-[8px] font-bold uppercase tracking-wider text-muted">This round</div>
          <div className="pixel-font mt-1 text-sm">{pixels.toLocaleString()} px</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-[9px]">
          <span className="font-bold uppercase tracking-wide text-muted">Pixels / min</span>
          <span className="font-mono">
            {pixels.toLocaleString()} / {stats.minPixels.toLocaleString()}
          </span>
        </div>
        <div className="mt-1 h-2 border-2 border-ink bg-bg">
          <div
            className={`h-full ${pixels >= stats.minPixels ? "bg-pfgreen" : "bg-accent"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-3 border-t-2 border-line pt-2 text-[9px] leading-relaxed text-muted">
        {missing > 0 ? (
          <p>
            Paint <span className="font-bold text-ink">{missing.toLocaleString()}</span> more
            pixels this round to reach the minimum.
          </p>
        ) : rank === null ? (
          <p>
            Rank below the top {board.boardSize} is not exposed by the contract. An indexer would
            be needed to show it — this app deliberately has none.
          </p>
        ) : !board.ended && inWhitelist ? (
          <p>
            Whitelist is <span className="font-bold text-ink">provisional</span> until the round
            ends and <code className="font-mono">epochEnded</code> is true.
          </p>
        ) : board.ended && whitelisted ? (
          <p>Your address is on this round&apos;s frozen whitelist.</p>
        ) : board.ended ? (
          <p>This round is final and your address is outside the top {board.boardSize}.</p>
        ) : (
          <p>Keep painting to climb into the top {board.boardSize} before the round ends.</p>
        )}
      </div>
    </section>
  );
}
