"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { CONTRACTS_CONFIGURED } from "@/config/chains";
import { useBoard, useStats } from "@/lib/hooks/useLeaderboard";
import { useMounted } from "@/lib/hooks/useMounted";
import { formatToken } from "@/lib/format";
import { useRuntimeConfig } from "@/lib/runtime";
import { DEMO_PAINTER } from "@/shared/mock";
import { epochList } from "@/shared/leaderboard";
import { TOKEN_SYMBOL } from "@/shared/palette";
import { BoardTable } from "./BoardTable";
import { Countdown } from "./Countdown";
import { MyRoundCard } from "./MyRoundCard";
import { PastRound } from "./PastRound";

function NotDeployed() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10">
      <div className="pixel-panel-strong p-5 sm:p-8">
        <p className="pixel-font text-[10px] text-accent">PX / LEADERBOARD</p>
        <h1 className="pixel-font mt-3 text-lg leading-relaxed sm:text-2xl">
          NO BOARD
          <br />
          YET
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          The vault is not configured and mock mode is off. Rounds and whitelists appear here once
          the contract is deployed.
        </p>
        <Link href="/" className="pixel-btn mt-5 inline-flex h-9 px-3 text-[10px]">
          Back to canvas
        </Link>
      </div>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-2 py-3 sm:px-3">
      <div className="pixel-panel-strong p-4">
        <div className="h-4 w-40 animate-pulse bg-panel2" />
        <div className="mt-3 h-12 w-64 animate-pulse bg-panel2" />
        <div className="mt-4 h-3 w-80 max-w-full animate-pulse bg-panel2" />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="h-72 animate-pulse border-2 border-line bg-panel" />
        <div className="h-52 animate-pulse border-2 border-line bg-panel" />
      </div>
    </div>
  );
}

export function LeaderboardView() {
  const mounted = useMounted();
  const { mockMode } = useRuntimeConfig();
  const { address } = useAccount();
  const enabled = mockMode || CONTRACTS_CONFIGURED;
  const viewer = address ?? (mockMode ? DEMO_PAINTER : null);
  const statsQuery = useStats(enabled);
  const stats = statsQuery.data;
  const currentEpoch = stats?.currentEpoch ?? null;
  const boardQuery = useBoard(currentEpoch, viewer, true, Boolean(currentEpoch));

  if (!enabled) return <NotDeployed />;

  // Gate live content until after hydration: the server's query state and the
  // client's first render can differ, and React must see the same markup.
  if (!mounted) return <LeaderboardSkeleton />;

  if (!stats && !statsQuery.isError) return <LeaderboardSkeleton />;

  if (!stats) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10">
        <div className="border-2 border-accent bg-panel p-5">
          <h1 className="pixel-font text-[11px] text-accent">BOARD READ FAILED</h1>
          <p className="mt-2 break-words text-[11px] text-muted">
            {statsQuery.error instanceof Error
              ? statsQuery.error.message
              : "Could not read round stats from the chain."}
          </p>
          <button
            type="button"
            onClick={() => void statsQuery.refetch()}
            className="pixel-btn mt-3 h-8 px-3 text-[10px]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const past = epochList(stats.currentEpoch);
  const currentBoard = boardQuery.data;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-2 py-2 sm:px-3 sm:py-3">
      <section className="pixel-panel-strong p-3 sm:p-4">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div>
            <p className="text-[8px] font-bold uppercase tracking-wider text-muted">Leaderboard</p>
            <h1 className="pixel-font mt-1 text-base sm:text-xl">
              ROUND <span className="text-accent">#{stats.currentEpoch}</span>
            </h1>
          </div>

          <div className="order-last w-full sm:order-none sm:ml-auto sm:w-auto">
            <Countdown
              epochEnd={stats.epochEnd}
              ended={stats.epochEnded}
              serverTime={stats.serverTime}
            />
          </div>

          <span
            className={`border-2 px-2 py-1 text-[8px] font-bold uppercase tracking-wider ${
              stats.epochEnded
                ? "border-pfgreen bg-pfgreen/10 text-pfgreen"
                : "border-accent bg-accent/10 text-accent"
            }`}
          >
            {stats.epochEnded ? "Final" : "Live"}
          </span>
        </div>

        <p className="mt-3 border-t-2 border-line pt-2 text-[9px] leading-relaxed text-muted">
          The top <span className="font-bold text-ink">{stats.boardSize}</span> addresses earn a
          whitelist spot. A round&apos;s WL is <span className="font-bold text-ink">provisional</span>{" "}
          until <code className="font-mono">epochEnded</code> is true for that epoch. Past rounds
          are read from their frozen on-chain boards — no indexer.
        </p>
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <div className="mb-1.5 flex items-end justify-between gap-2">
            <h2 className="pixel-font text-[10px]">CURRENT BOARD</h2>
            <span className="font-mono text-[9px] text-muted">
              {currentBoard ? `${currentBoard.board.length} / ${currentBoard.boardSize}` : "—"}
            </span>
          </div>

          {!currentBoard && !boardQuery.error && (
            <div className="space-y-1.5" aria-label="Loading current board">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-7 animate-pulse border border-line bg-panel" />
              ))}
            </div>
          )}

          {boardQuery.error && !currentBoard && (
            <div className="border-2 border-accent bg-panel p-3 text-[10px]">
              <p className="font-bold text-accent">Current board read failed.</p>
              <p className="mt-1 break-words text-muted">
                {boardQuery.error instanceof Error
                  ? boardQuery.error.message
                  : "Unknown RPC error."}
              </p>
              <button
                type="button"
                onClick={() => void boardQuery.refetch()}
                className="pixel-btn mt-2 h-7 px-2 text-[9px]"
              >
                Retry
              </button>
            </div>
          )}

          {currentBoard && (
            <>
              <BoardTable
                board={currentBoard.board}
                boardSize={currentBoard.boardSize}
                ended={currentBoard.ended}
                viewer={viewer}
                emptyNote="No pixels painted in this round yet. Be the first."
              />
              <p className="mt-1 text-[8px] leading-relaxed text-muted">
                {currentBoard.ended
                  ? "Final board. WL entries are locked."
                  : "WL* is provisional: it only becomes final after the round ends and is finalized on-chain."}
              </p>
            </>
          )}
        </section>

        <aside className="space-y-3">
          <MyRoundCard
            stats={stats}
            board={currentBoard}
            isLoading={boardQuery.isLoading}
            viewer={viewer}
            demoViewer={!address && mockMode}
          />

          <div className="pixel-panel p-3 text-[9px] leading-relaxed text-muted">
            <p className="font-bold uppercase tracking-wide text-ink">Round facts</p>
            <dl className="mt-2 space-y-1">
              <div className="flex justify-between gap-2">
                <dt>Min pixels</dt>
                <dd className="font-mono">{stats.minPixels.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>WL spots</dt>
                <dd className="font-mono">{stats.boardSize}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Round length</dt>
                <dd className="font-mono">
                  {Number(stats.epochLength) >= 86_400
                    ? `${Math.round(Number(stats.epochLength) / 86_400)} days`
                    : `${Math.round(Number(stats.epochLength) / 3_600)} hours`}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Price / pixel</dt>
                <dd className="font-mono">
                  {formatToken(BigInt(stats.price), stats.decimals, 4)} {TOKEN_SYMBOL}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      <section className="mt-4">
        <div className="mb-1.5 flex items-end justify-between">
          <h2 className="pixel-font text-[10px]">PAST ROUNDS</h2>
          <span className="font-mono text-[9px] text-muted">{past.length} past</span>
        </div>

        {past.length === 0 ? (
          <div className="border-2 border-line bg-panel p-4 text-[10px] text-muted">
            No past rounds yet. The first board appears when round #{stats.currentEpoch} ends.
          </div>
        ) : (
          <div className="space-y-2">
            {past.map((epoch) => (
              <PastRound key={epoch} epoch={epoch} />
            ))}
          </div>
        )}
        <p className="mt-2 text-[8px] leading-relaxed text-muted">
          Board data is loaded only when a round is expanded, so old rounds do not hammer the RPC.
          Export is enabled only for rounds that report <code className="font-mono">epochEnded = true</code>.
        </p>
      </section>
    </div>
  );
}
