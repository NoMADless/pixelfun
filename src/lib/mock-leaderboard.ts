import { keccak256, stringToHex, type Address } from "viem";
import { DEMO_PAINTER, MOCK_PRICE_RAW } from "@/shared/mock";
import type {
  BoardEntry,
  BoardResponse,
  LeaderboardStats,
  ViewerBoardStats,
} from "@/shared/leaderboard";

const EPOCH_LENGTH = 3 * 24 * 60 * 60; // 3 days
const BOARD_SIZE = 66;
const MIN_PIXELS = 20;
const DECIMALS = 18;
const BASE_TOTAL_PAINTED = 241_500;

interface MockLeaderboardState {
  /** Unix seconds for the start of epoch 0. */
  origin: number;
  totalPainted: number;
  /** Mock paints grouped by epoch, on top of the deterministic base boards. */
  deltas: Map<number, Map<string, number>>;
}

const globalForMock = globalThis as unknown as { __pixelfunMockBoard?: MockLeaderboardState };

function state(): MockLeaderboardState {
  if (!globalForMock.__pixelfunMockBoard) {
    const now = Math.floor(Date.now() / 1000);
    // Start far enough back that there are two completed rounds and the
    // current round still has about 1.5 days on its clock.
    globalForMock.__pixelfunMockBoard = {
      origin: now - 2 * EPOCH_LENGTH - Math.floor(EPOCH_LENGTH * 0.5),
      totalPainted: BASE_TOTAL_PAINTED,
      deltas: new Map(),
    };
  }
  return globalForMock.__pixelfunMockBoard;
}

function currentEpochAt(now: number): number {
  const current = state();
  return Math.max(0, Math.floor((now - current.origin) / EPOCH_LENGTH));
}

function epochStart(epoch: number): number {
  return state().origin + epoch * EPOCH_LENGTH;
}

function epochEnd(epoch: number): number {
  return epochStart(epoch) + EPOCH_LENGTH;
}

function endedAt(epoch: number, now: number): boolean {
  return now >= epochEnd(epoch);
}

function deriveAddress(seed: string): Address {
  return keccak256(stringToHex(seed)).slice(0, 42).toLowerCase() as Address;
}

function baseBoard(epoch: number): BoardEntry[] {
  const entries: Array<{ address: string; count: number }> = [];
  const demoAddress = DEMO_PAINTER.toLowerCase();
  for (let index = 0; index < BOARD_SIZE; index++) {
    const address =
      index === 11 ? demoAddress : deriveAddress(`pixelfun-mock-${epoch}-${index}`);
    const bump = index === 11 ? -30 : 0;
    entries.push({
      address,
      count: 1_800 - index * 23 + (epoch % 7) * 11 + bump,
    });
  }
  return entries
    .sort((a, b) => b.count - a.count)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function currentCounts(epoch: number): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of baseBoard(epoch)) counts.set(entry.address, entry.count);
  const deltas = state().deltas.get(epoch);
  if (deltas) {
    for (const [address, delta] of deltas) {
      counts.set(address, (counts.get(address) ?? 0) + delta);
    }
  }
  return counts;
}

export function getMockStats(): LeaderboardStats {
  const now = Math.floor(Date.now() / 1000);
  const current = currentEpochAt(now);
  return {
    mock: true,
    totalPixelsPainted: String(state().totalPainted),
    price: String(MOCK_PRICE_RAW),
    burned: (BigInt(state().totalPainted) * MOCK_PRICE_RAW).toString(),
    decimals: DECIMALS,
    currentEpoch: String(current),
    epochStart: String(epochStart(current)),
    epochEnd: String(epochEnd(current)),
    epochEnded: endedAt(current, now),
    epochLength: String(EPOCH_LENGTH),
    minPixels: MIN_PIXELS,
    boardSize: BOARD_SIZE,
    serverTime: Date.now(),
  };
}

export function getMockBoard(
  epoch: number,
  viewer?: string,
): BoardResponse | null {
  const now = Math.floor(Date.now() / 1000);
  const current = currentEpochAt(now);
  if (!Number.isSafeInteger(epoch) || epoch < 0 || epoch > current) return null;

  const counts = currentCounts(epoch);
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const board: BoardEntry[] = sorted.slice(0, BOARD_SIZE).map(([address, count], index) => ({
    address,
    count,
    rank: index + 1,
  }));
  const ended = endedAt(epoch, now);

  let viewerStats: ViewerBoardStats | null = null;
  if (viewer) {
    const address = viewer.toLowerCase();
    const pixels = counts.get(address) ?? 0;
    const index = sorted.findIndex(([candidate]) => candidate === address);
    const rank = index >= 0 ? index + 1 : null;
    viewerStats = {
      address,
      pixels,
      rank,
      whitelisted: ended && rank !== null && rank <= BOARD_SIZE,
    };
  }

  return {
    mock: true,
    epoch: String(epoch),
    ended,
    boardSize: BOARD_SIZE,
    board,
    viewer: viewerStats,
    serverTime: Date.now(),
  };
}

export function recordMockPaint(painter: string, pixelCount: number): void {
  if (!Number.isInteger(pixelCount) || pixelCount <= 0) return;
  const current = state();
  const epoch = currentEpochAt(Math.floor(Date.now() / 1000));
  const address = painter.toLowerCase();
  const deltas = current.deltas.get(epoch) ?? new Map<string, number>();
  deltas.set(address, (deltas.get(address) ?? 0) + pixelCount);
  current.deltas.set(epoch, deltas);
  current.totalPainted += pixelCount;
}
