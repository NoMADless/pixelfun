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

export function epochList(currentEpoch: string | bigint): string[] {
  const current = typeof currentEpoch === "bigint" ? currentEpoch : BigInt(currentEpoch);
  if (current <= 0n) return [];
  const epochs: string[] = [];
  for (let epoch = current - 1n; epoch >= 0n; epoch--) {
    epochs.push(epoch.toString());
  }
  return epochs;
}
