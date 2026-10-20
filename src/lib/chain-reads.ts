import type { Address } from "viem";
import {
  getLatestBlockNumber,
  getReadClient,
  readBoard,
  readBoardSize,
  readCanvasFromRpc,
  readCurrentEpoch,
  readEpochEnd,
  readEpochEnded,
  readEpochLength,
  readEpochStart,
  readIsWhitelisted,
  readMinPixels,
  readPixelsPaintedIn,
  readPriceWithFallback,
  readTokenDecimals,
  readTotalBurned,
  readTotalPixelsPainted,
} from "@/lib/contract";
import type { BoardEntry, BoardResponse, LeaderboardStats } from "@/shared/leaderboard";

/**
 * Browser-side equivalents of the payloads the old `/api/*` routes served.
 *
 * The app ships as a static export, so there is no Node runtime: every read
 * below goes straight to the public RPC from the browser. The RPC answers
 * `access-control-allow-origin: *`, which a static host needs.
 */

export async function fetchStats(): Promise<LeaderboardStats> {
  const client = getReadClient();
  const [totalPixelsPainted, priceRead, decimals, currentEpoch, minPixels, boardSize, epochLength] =
    await Promise.all([
      readTotalPixelsPainted(client),
      readPriceWithFallback(client),
      readTokenDecimals(client),
      readCurrentEpoch(client),
      readMinPixels(client),
      readBoardSize(client),
      readEpochLength(client),
    ]);
  const [epochStart, epochEnd, epochEnded] = await Promise.all([
    readEpochStart(currentEpoch, client),
    readEpochEnd(currentEpoch, client),
    readEpochEnded(currentEpoch, client),
  ]);

  // totalBurned() is the contract's own counter. Keep the painted × PRICE math
  // as a fallback for RPC builds without it.
  let totalBurned: bigint | null = null;
  try {
    totalBurned = await readTotalBurned(client);
  } catch {
    totalBurned = null;
  }
  const price = priceRead.price ?? 0n;
  const burned = totalBurned ?? totalPixelsPainted * price;

  return {
    mock: false,
    totalPixelsPainted: totalPixelsPainted.toString(),
    price: price.toString(),
    burned: burned.toString(),
    decimals,
    currentEpoch: currentEpoch.toString(),
    epochStart: epochStart.toString(),
    epochEnd: epochEnd.toString(),
    epochEnded,
    epochLength: epochLength.toString(),
    minPixels,
    boardSize,
    serverTime: Date.now(),
  };
}

export async function fetchBoard(epoch: bigint, viewer: Address | null): Promise<BoardResponse> {
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
    const index = board.findIndex((entry) => entry.address === viewer.toLowerCase());
    viewerStats = {
      address: viewer,
      pixels,
      rank: index >= 0 ? index + 1 : null,
      whitelisted,
    };
  }

  return {
    mock: false,
    epoch: epoch.toString(),
    ended,
    boardSize,
    board,
    viewer: viewerStats,
    serverTime: Date.now(),
  };
}

/**
 * Read the whole canvas. The block number is captured before the chunks so a
 * paint that lands mid-read is replayed from Painted logs instead of dropped.
 */
export async function fetchCanvas(): Promise<{
  bytes: Uint8Array;
  blockNumber: bigint | null;
}> {
  const client = getReadClient();
  const blockNumber = await getLatestBlockNumber(client);
  const bytes = await readCanvasFromRpc({ client, concurrency: 4, retries: 2 });
  return { bytes, blockNumber };
}
