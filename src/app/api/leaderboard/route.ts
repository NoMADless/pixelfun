import { connection } from "next/server";
import { isAddress, type Address } from "viem";
import { CONTRACTS_CONFIGURED, VAULT_ADDRESS } from "@/config/chains";
import { isMockMode } from "@/config/server";
import {
  getReadClient,
  readBoard,
  readBoardSize,
  readEpochEnded,
  readIsWhitelisted,
  readPixelsPaintedIn,
} from "@/lib/contract";
import { getMockBoard } from "@/server/mock-leaderboard";
import type { BoardEntry, BoardResponse } from "@/shared/leaderboard";

function publicHeaders(ended: boolean): Record<string, string> {
  return ended
    ? { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" }
    : { "Cache-Control": "public, s-maxage=4, stale-while-revalidate=30" };
}

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const epochParam = url.searchParams.get("epoch");
  if (!epochParam || !/^\d+$/.test(epochParam) || epochParam.length > 20) {
    return Response.json(
      { error: "invalid_epoch", message: "epoch must be a non-negative integer." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const viewerParam = url.searchParams.get("viewer");
  if (viewerParam && !isAddress(viewerParam)) {
    return Response.json(
      { error: "invalid_viewer", message: "viewer must be an EVM address." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const viewer = viewerParam ? (viewerParam.toLowerCase() as Address) : null;
  const epoch = BigInt(epochParam);

  if (isMockMode()) {
    const board = getMockBoard(Number(epochParam), viewer ?? undefined);
    if (!board) {
      return Response.json(
        { error: "unknown_epoch", message: "That round has not started yet." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(board, {
      headers: viewer ? PRIVATE_HEADERS : publicHeaders(board.ended),
    });
  }

  if (!VAULT_ADDRESS || !CONTRACTS_CONFIGURED) {
    return Response.json(
      {
        error: "not_deployed",
        message:
          "PixelFunVault is not configured. Set NEXT_PUBLIC_VAULT_ADDRESS and NEXT_PUBLIC_IMD_ADDRESS, or run with MOCK_MODE=true.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const client = getReadClient();
    const [rawBoard, ended, boardSize] = await Promise.all([
      readBoard(epoch, client),
      readEpochEnded(epoch, client),
      readBoardSize(client),
    ]);

    const board: BoardEntry[] = rawBoard.painters.map((address, index) => ({
      rank: index + 1,
      address: address.toLowerCase(),
      count: rawBoard.counts[index] ?? 0,
    }));

    let viewerStats: BoardResponse["viewer"] = null;
    if (viewer) {
      const [pixels, whitelisted] = await Promise.all([
        readPixelsPaintedIn(epoch, viewer, client),
        readIsWhitelisted(epoch, viewer, client),
      ]);
      const index = board.findIndex((entry) => entry.address === viewer);
      viewerStats = {
        address: viewer,
        pixels,
        rank: index >= 0 ? index + 1 : null,
        whitelisted,
      };
    }

    const response: BoardResponse = {
      mock: false,
      epoch: epoch.toString(),
      ended,
      boardSize,
      board,
      viewer: viewerStats,
      serverTime: Date.now(),
    };
    return Response.json(response, {
      headers: viewer ? PRIVATE_HEADERS : publicHeaders(ended),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: "rpc_failed", message },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
