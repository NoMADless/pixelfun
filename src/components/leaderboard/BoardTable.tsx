"use client";

import { explorerAddressUrl } from "@/config/chains";
import { shortenAddress } from "@/lib/format";
import type { BoardEntry } from "@/shared/leaderboard";

interface Props {
  board: BoardEntry[];
  boardSize: number;
  ended: boolean;
  viewer?: string | null;
  emptyNote?: string;
}

export function BoardTable({ board, boardSize, ended, viewer, emptyNote }: Props) {
  if (board.length === 0) {
    return (
      <div className="border-2 border-line bg-bg px-3 py-8 text-center text-[11px] text-muted">
        {emptyNote ?? "No pixels painted in this round yet."}
      </div>
    );
  }

  return (
    <div className="max-h-[480px] overflow-y-auto border-2 border-ink bg-panel pf-scroll">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Round leaderboard: rank, painter, pixels and whitelist status.
        </caption>
        <thead className="sticky top-0 z-10 bg-panel2">
          <tr className="text-[8px] font-bold uppercase tracking-wider text-muted">
            <th scope="col" className="w-10 px-2 py-1.5">#</th>
            <th scope="col" className="px-2 py-1.5">Painter</th>
            <th scope="col" className="w-16 px-2 py-1.5 text-right">Pixels</th>
            <th scope="col" className="w-12 px-2 py-1.5 text-center">WL</th>
          </tr>
        </thead>
        <tbody>
          {board.map((entry) => {
            const isViewer = viewer ? entry.address.toLowerCase() === viewer.toLowerCase() : false;
            const inWhitelist = entry.rank <= boardSize;
            return (
              <tr
                key={`${entry.rank}-${entry.address}`}
                className={`border-t border-line/70 text-[10px] ${
                  isViewer ? "bg-glow/25" : entry.rank <= 3 ? "bg-panel2/60" : ""
                }`}
              >
                <td className="px-2 py-1.5 font-mono text-muted">
                  {entry.rank <= 3 ? <span className="text-accent">#{entry.rank}</span> : `#${entry.rank}`}
                </td>
                <td className="max-w-0 px-2 py-1.5">
                  <a
                    href={explorerAddressUrl(entry.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={entry.address}
                    className="block truncate font-mono hover:text-accent hover:underline"
                  >
                    {shortenAddress(entry.address, 5)}
                    {isViewer ? <span className="ml-1 text-[8px] font-bold text-accent">YOU</span> : null}
                  </a>
                </td>
                <td className="px-2 py-1.5 text-right font-mono">{entry.count.toLocaleString()}</td>
                <td className="px-2 py-1.5 text-center">
                  {inWhitelist ? (
                    <span
                      className={`inline-block border px-1 py-0.5 text-[7px] font-bold uppercase ${
                        ended
                          ? "border-pfgreen bg-pfgreen/15 text-pfgreen"
                          : "border-accent bg-accent/10 text-accent"
                      }`}
                      title={
                        ended
                          ? "Final whitelist entry"
                          : "Top 66 right now — final only after epochEnded"
                      }
                    >
                      {ended ? "WL" : "WL*"}
                    </span>
                  ) : (
                    <span className="text-[8px] text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
