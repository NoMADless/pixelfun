import type { Checker } from "../assert";
import {
  deployFresh,
  fundPainter,
  sameAddress,
  type ChainContext,
  type Wallet,
} from "../chain";
import { pixelsToEnterTop } from "../../../src/shared/leaderboard";

const COLORS = (count: number) => Array.from({ length: count }, () => 7);
const IDS = (count: number) => Array.from({ length: count }, (_, i) => i);

function contains(board: { painters: string[] }, wallet: Wallet): boolean {
  return board.painters.some((address) => sameAddress(address, wallet.address));
}

function rankOf(board: { painters: string[] }, wallet: Wallet): number {
  return board.painters.findIndex((address) => sameAddress(address, wallet.address)) + 1;
}

export async function runBoardScenario(
  chain: ChainContext,
  artifacts: Parameters<typeof deployFresh>[1],
  check: Checker,
  decimals: number,
): Promise<void> {
  check.section(`top-66 board (${decimals} decimals)`);
  const deployment = await deployFresh(chain, artifacts, decimals);
  const { vault } = deployment;
  const epoch = await vault.currentEpoch();
  check.equal("epoch starts at 0", epoch, 0n);
  check.equal("MIN_PIXELS", await vault.minPixels(), 20n);
  check.equal("BOARD_SIZE", await vault.boardSize(), 66n);

  const painters = chain.wallets.slice(5, 71);
  const fill: number[] = [];
  for (let i = 0; i < 66; i++) {
    const count = 20 + i;
    fill.push(count);
    await fundPainter(deployment, painters[i], count);
    await vault.paint(painters[i], IDS(count), COLORS(count));
  }

  const full = await vault.getBoard(epoch);
  check.equal("board fills to 66 entries", full.painters.length, 66);
  let sortedDesc = true;
  for (let i = 1; i < full.counts.length; i++) {
    if (full.counts[i] > full.counts[i - 1]) sortedDesc = false;
  }
  check.check("getBoard is sorted descending", sortedDesc, full.counts.slice(0, 5).join(","));
  check.equal("highest count is 85", full.counts[0], 85);
  check.equal("lowest count is 20", full.counts[65], 20);
  check.equal("board epoch count for a painter", await vault.pixelsPaintedIn(epoch, painters[0].address), 20);

  let allWhitelisted = true;
  for (const painter of painters) {
    if (!(await vault.isWhitelisted(epoch, painter.address))) allWhitelisted = false;
  }
  check.check("every board painter is whitelisted", allWhitelisted);

  // ---- Equal count does not displace the minimum; one more does. ----
  const newcomer = chain.wallets[71];
  await fundPainter(deployment, newcomer, 40);
  await vault.paint(newcomer, IDS(10), COLORS(10));
  check.check(
    "below MIN_PIXELS is not on the board",
    !(await vault.isWhitelisted(epoch, newcomer.address)),
  );

  const gap = pixelsToEnterTop({
    myPixels: 10,
    minPixels: 20,
    boardSize: 66,
    boardCounts: full.counts,
    myRank: null,
  });
  check.equal("app says 11 px needed from 10 px", gap, 11);
  await vault.paint(newcomer, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], COLORS(11));
  const afterGap = await vault.getBoard(epoch);
  check.equal(
    "painting the app-computed gap enters the board",
    rankOf(afterGap, newcomer) > 0,
    true,
  );
  check.equal("board still has 66 entries", afterGap.painters.length, 66);
  check.equal(
    "displaced the 20-pixel minimum",
    contains(afterGap, painters[0]),
    false,
  );
  check.equal(
    "newcomer count is 21",
    await vault.pixelsPaintedIn(epoch, newcomer.address),
    21,
  );

  // ---- Equal to the new minimum is rejected (strictly greater required). ----
  const equalNewcomer = chain.wallets[72];
  await fundPainter(deployment, equalNewcomer, 40);
  await vault.paint(equalNewcomer, IDS(21), COLORS(21));
  check.check(
    "equal-count newcomer is rejected on a full board",
    !(await vault.isWhitelisted(epoch, equalNewcomer.address)),
  );
  check.check(
    "minimum holder stays on the board after a tie",
    await vault.isWhitelisted(epoch, newcomer.address),
  );

  // ---- One pixel more displaces the (tied) minimum. ----
  const stronger = chain.wallets[73];
  await fundPainter(deployment, stronger, 40);
  await vault.paint(stronger, IDS(22), COLORS(22));
  const afterStronger = await vault.getBoard(epoch);
  check.check(
    "strictly greater newcomer enters",
    await vault.isWhitelisted(epoch, stronger.address),
  );
  check.check(
    "displaced the tied minimum (latest reach ranks lowest)",
    !(await vault.isWhitelisted(epoch, newcomer.address)),
  );
  check.equal("board size stays 66", afterStronger.painters.length, 66);
  check.equal("stronger count", await vault.pixelsPaintedIn(epoch, stronger.address), 22);

  const nextGap = pixelsToEnterTop({
    myPixels: 21,
    minPixels: 20,
    boardSize: 66,
    boardCounts: afterStronger.counts,
    myRank: null,
  });
  check.equal("app gap on the real board is min+1-21 = 1", nextGap, 1);
  await fundPainter(deployment, equalNewcomer, 40);
  await vault.paint(equalNewcomer, [0], [3]);
  check.check(
    "painting exactly the computed gap enters the board",
    await vault.isWhitelisted(epoch, equalNewcomer.address),
  );

  // ---- Tie ordering: earlier reach ranks higher, even within one block. ----
  const tie = await deployFresh(chain, artifacts, decimals);
  const [a, b, c] = chain.wallets.slice(74, 77);
  for (const wallet of [a, b, c]) {
    await fundPainter(tie, wallet, 40);
  }
  await tie.vault.paint(a, IDS(30), COLORS(30));
  await tie.vault.paint(b, IDS(30), COLORS(30));
  await tie.vault.paint(c, IDS(31), COLORS(31));
  const tiedBoard = await tie.vault.getBoard(0n);
  check.equal("tie board has 3 entries", tiedBoard.painters.length, 3);
  check.check(
    "higher count ranks first",
    sameAddress(tiedBoard.painters[0], c.address),
    tiedBoard.painters[0],
  );
  check.check(
    "earlier reach wins the tie",
    sameAddress(tiedBoard.painters[1], a.address) && sameAddress(tiedBoard.painters[2], b.address),
    tiedBoard.painters.slice(1).join(","),
  );
  check.equal("tie counts", tiedBoard.counts.join(","), "31,30,30");
  check.check(
    "isWhitelisted on the tie board",
    (await tie.vault.isWhitelisted(0n, a.address)) &&
      (await tie.vault.isWhitelisted(0n, b.address)) &&
      (await tie.vault.isWhitelisted(0n, c.address)),
  );
  check.check(
    "future epoch board is empty",
    !(await tie.vault.isWhitelisted(99n, a.address)),
  );
}
