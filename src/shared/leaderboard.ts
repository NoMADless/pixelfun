export interface LeaderboardStats {
  mock: boolean;
  totalPixelsPainted: string;
  price: string;
  burned: string;
  decimals: number;
  currentEpoch: string;
  epochStart: string;
  epochEnd: string;
  epochEnded: boolean;
  epochLength: string;
  minPixels: number;
  boardSize: number;
  /** Server clock in ms, used to avoid a client clock skew in the countdown. */
  serverTime: number;
}

export interface BoardEntry {
  rank: number;
  address: string;
  count: number;
}

export interface ViewerBoardStats {
  address: string;
  pixels: number;
  rank: number | null;
  /** Authoritative `isWhitelisted(epoch, viewer)` result from the contract. */
  whitelisted: boolean;
}

export interface BoardResponse {
  mock: boolean;
  epoch: string;
  ended: boolean;
  boardSize: number;
  board: BoardEntry[];
  viewer: ViewerBoardStats | null;
  serverTime: number;
}

/**
 * OpenSea allowlist friendly: one lowercase address per line, no header and no
 * commas. A trailing newline keeps text editors and CLI tools happy.
 */
export function whitelistCsv(board: readonly Pick<BoardEntry, "address">[]): string {
  if (board.length === 0) return "";
  return `${board.map((entry) => entry.address.toLowerCase()).join("\n")}\n`;
}

export interface TopGapInput {
  /** Pixels the viewer has painted in this round. */
  myPixels: number;
  minPixels: number;
  boardSize: number;
  /** Board counts, sorted descending, as returned by getBoard. */
  boardCounts: readonly number[];
  /** 1-based rank when the viewer is on the returned board, otherwise null. */
  myRank?: number | null;
}

/**
 * Pixels still needed to secure a top-66 spot.
 *
 * A full board requires strictly more than the lowest entry because the
 * contract rejects ties. A non-full board only requires MIN_PIXELS. Returning
 * 0 means the viewer is already on the board (or has already cleared the bar).
 */
export function pixelsToEnterTop({
  myPixels,
  minPixels,
  boardSize,
  boardCounts,
  myRank,
}: TopGapInput): number {
  const pixels = Math.max(0, Math.floor(Number.isFinite(myPixels) ? myPixels : 0));
  const minimum = Math.max(0, Math.floor(Number.isFinite(minPixels) ? minPixels : 0));
  const size = Math.max(1, Math.floor(Number.isFinite(boardSize) ? boardSize : 1));

  if (typeof myRank === "number" && myRank >= 1 && myRank <= size) return 0;

  const counts = boardCounts
    .filter((count) => Number.isFinite(count))
    .map((count) => Math.max(0, Math.floor(count)));
  const full = counts.length >= size;
  const threshold = full ? Math.max(minimum, Math.min(...counts) + 1) : minimum;

  return Math.max(0, threshold - pixels);
}

export function epochList(currentEpoch: string | bigint): string[] {
  const current = typeof currentEpoch === "bigint" ? currentEpoch : BigInt(currentEpoch);
  if (current <= 0n) return [];
  const epochs: string[] = [];
  for (let epoch = current - 1n; epoch >= 0n; epoch--) {
    epochs.push(epoch.toString());
  }
  return epochs;
}
