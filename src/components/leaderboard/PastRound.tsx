"use client";

import { useState } from "react";
import { useBoard } from "@/lib/hooks/useLeaderboard";
import { copyText, downloadTextFile } from "@/lib/download";
import { whitelistCsv } from "@/shared/leaderboard";
import { BoardTable } from "./BoardTable";

interface Props {
  epoch: string;
}

export function PastRound({ epoch }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const board = useBoard(expanded ? epoch : null, null, false, expanded);

  const data = board.data;
  const canExport = Boolean(data?.ended && data.board.length > 0);
  const csv = data ? whitelistCsv(data.board) : "";

  async function handleCopy() {
    if (!canExport) return;
    try {
      await copyText(csv);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1_500);
    } catch {
      setCopyState("error");
    }
  }

  return (
    <section className="border-2 border-ink bg-panel">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-panel2"
      >
        <span className="pixel-font text-[10px]">ROUND #{epoch}</span>
        <span
          className={`border px-1 py-0.5 text-[7px] font-bold uppercase ${
            data?.ended
              ? "border-pfgreen bg-pfgreen/10 text-pfgreen"
              : "border-line text-muted"
          }`}
        >
          {data ? (data.ended ? "Final" : "Not final") : "Tap to load"}
        </span>
        <span className="ml-auto font-mono text-[9px] text-muted">
          {expanded && data ? `${data.board.length} painters` : "board"}
        </span>
        <span className="text-xs text-muted" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded && (
        <div className="border-t-2 border-line p-2 sm:p-3">
          {!data && !board.error && (
            <div className="space-y-1.5" aria-label="Loading round board">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-6 animate-pulse bg-panel2" />
              ))}
            </div>
          )}

          {board.error && (
            <div className="border-2 border-accent bg-accent/10 p-3 text-[10px]">
              <p className="font-bold text-accent">Could not read round #{epoch}.</p>
              <p className="mt-1 break-words text-muted">
                {board.error instanceof Error ? board.error.message : String(board.error)}
              </p>
              <button
                type="button"
                onClick={() => void board.refetch()}
                className="pixel-btn mt-2 h-7 px-2 text-[9px]"
              >
                Retry
              </button>
            </div>
          )}

          {data && (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[9px] text-muted">
                  Top {data.boardSize} · {data.ended ? "frozen board" : "still changing"}
                </span>
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile(`pixelfun-round-${epoch}-wl.csv`, csv)
                    }
                    disabled={!canExport}
                    className="pixel-btn h-8 px-2 text-[9px]"
                    title={
                      canExport
                        ? "One lowercase address per line"
                        : "Available after the round is final"
                    }
                  >
                    Download CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    disabled={!canExport}
                    className="pixel-btn h-8 px-2 text-[9px]"
                  >
                    {copyState === "copied" ? "Copied!" : "Copy list"}
                  </button>
                </div>
              </div>

              {!data.ended && (
                <p className="mb-2 border-2 border-accent bg-accent/10 px-2 py-1.5 text-[9px] text-accent">
                  This round is not final yet. Export unlocks when <code className="font-mono">epochEnded</code> is true.
                </p>
              )}
              {copyState === "error" && (
                <p className="mb-2 text-[9px] text-accent">
                  Clipboard access was blocked. Use Download CSV instead.
                </p>
              )}

              <BoardTable
                board={data.board}
                boardSize={data.boardSize}
                ended={data.ended}
                emptyNote="No pixels were painted in this round."
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}
