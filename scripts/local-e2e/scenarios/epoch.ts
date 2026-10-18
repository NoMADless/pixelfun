import type { Checker } from "../assert";
import {
  deployFresh,
  fundPainter,
  sameAddress,
  warpTo,
  type ChainContext,
} from "../chain";
import { whitelistCsv } from "../../../src/shared/leaderboard";

const IDS = (count: number) => Array.from({ length: count }, (_, i) => i);
const COLORS = (count: number) => Array.from({ length: count }, () => 12);

export async function runEpochScenario(
  chain: ChainContext,
  artifacts: Parameters<typeof deployFresh>[1],
  check: Checker,
  decimals: number,
): Promise<void> {
  check.section(`epochs, frozen boards and CSV (${decimals} decimals)`);
  const deployment = await deployFresh(chain, artifacts, decimals);
  const { vault } = deployment;
  const alice = chain.wallets[77];
  const bob = chain.wallets[78];

  check.equal("currentEpoch at deployment", await vault.currentEpoch(), 0n);
  const epochStart = await vault.epochStartValue();
  const end = await vault.epochEnd(0n);
  check.equal("EPOCH_START is the deploy timestamp", epochStart, end - 259_200n);
  check.equal("epochStart(0)", await vault.epochStart(0n), epochStart);
  check.equal("epochEnd(0) - epochStart(0)", end - epochStart, 259_200n);

  await fundPainter(deployment, alice, 30);
  await vault.paint(alice, IDS(30), COLORS(30));
  check.equal("alice painted in epoch 0", await vault.pixelsPaintedIn(0n, alice.address), 30);
  check.check("alice whitelisted in epoch 0", await vault.isWhitelisted(0n, alice.address));

  // One second before the boundary the epoch is still 0 and not ended.
  await warpTo(chain, Number(end) - 1);
  check.equal("currentEpoch one second before the end", await vault.currentEpoch(), 0n);
  check.equal("epochEnded one second before the end", await vault.epochEnded(0n), false);
  check.check("alice still whitelisted before the boundary", await vault.isWhitelisted(0n, alice.address));

  // Exactly at epochEnd the next epoch starts; the old board is frozen.
  await warpTo(chain, Number(end));
  check.equal("currentEpoch at the boundary", await vault.currentEpoch(), 1n);
  check.equal("epochEnded at the boundary", await vault.epochEnded(0n), true);
  check.equal("epochStart(1) == epochEnd(0)", await vault.epochStart(1n), end);
  check.equal("alice count in epoch 1 is 0", await vault.pixelsPaintedIn(1n, alice.address), 0);
  check.check("epoch 1 board starts empty", (await vault.getBoard(1n)).painters.length === 0);

  await fundPainter(deployment, bob, 25);
  await vault.paint(bob, IDS(25), COLORS(25));
  const epoch1Board = await vault.getBoard(1n);
  check.equal("epoch 1 board has only bob", epoch1Board.painters.length, 1);
  check.check("bob is on the epoch 1 board", sameAddress(epoch1Board.painters[0], bob.address));

  const frozen = await vault.getBoard(0n);
  check.equal("epoch 0 board is frozen at one entry", frozen.painters.length, 1);
  check.check("frozen board still lists alice", sameAddress(frozen.painters[0], alice.address));
  check.equal("frozen board count unchanged", frozen.counts[0], 30);
  check.check(
    "alice no longer whitelisted in epoch 1",
    !(await vault.isWhitelisted(1n, alice.address)),
  );
  check.check("bob is not whitelisted in epoch 0", !(await vault.isWhitelisted(0n, bob.address)));

  // CSV export path used by PastRound: only unlocked for an ended, non-empty board.
  const ended = await vault.epochEnded(0n);
  const csv = whitelistCsv(frozen.painters.map((address) => ({ address })));
  check.equal("CSV unlocked for the finished epoch", ended && frozen.painters.length > 0, true);
  check.equal(
    "CSV for finished epoch lists the frozen painter",
    csv,
    `${alice.address.toLowerCase()}\n`,
  );
  const liveEnded = await vault.epochEnded(1n);
  check.equal(
    "CSV locked while epoch 1 is live",
    liveEnded && epoch1Board.painters.length > 0,
    false,
  );

  // Event epoch matches the epoch the paint landed in.
  const logs = await vault.paintLogs();
  const last = logs[logs.length - 1] as { args?: { epoch?: bigint; painter?: string } };
  check.equal("Painted event reports epoch 1", last.args?.epoch, 1n);
  check.check(
    "Painted event painter is bob",
    (last.args?.painter ?? "").toLowerCase() === bob.address.toLowerCase(),
  );
}
