import type { Checker } from "../assert";
import {
  deployFresh,
  fundPainter,
  hexToBytes,
  readWholeCanvas,
  type ChainContext,
  type Deployment,
} from "../chain";
import { applyPaint } from "../../../src/shared/canvas";
import { PAINTED_EVENT } from "../../../src/lib/contract";

const IDS = [0, 31, 32, 511, 512, 262_143] as const;
const COLORS = [0, 1, 2, 3, 4, 5] as const;

export async function runCanvasScenario(
  chain: ChainContext,
  artifacts: Parameters<typeof deployFresh>[1],
  check: Checker,
  decimals: number,
): Promise<Deployment> {
  check.section(`canvas packing + live replay (${decimals} decimals)`);
  const deployment = await deployFresh(chain, artifacts, decimals);
  const { vault } = deployment;
  const painter = chain.wallets[1];

  check.equal("MAX_READ_SLOTS", await vault.maxReadSlots(), 1024n);
  check.equal("SLOT_COUNT", await vault.slotCount(), 8192n);
  check.equal("WIDTH", await vault.width(), 512n);
  check.equal("HEIGHT", await vault.height(), 512n);
  check.equal("PALETTE_SIZE", await vault.paletteSize(), 32n);

  // One transaction, ids that cross slot boundaries (0, 31 | 32, 511 | 512 | last pixel).
  await fundPainter(deployment, painter, 20);
  const paintReceipt = await vault.paint(painter, IDS, COLORS);
  check.check("paint touches all slots", paintReceipt.status === "success");

  const { bytes, calls } = await readWholeCanvas(vault, 1024);
  check.equal("whole canvas read in 8 getPixels calls", calls, 8);

  IDS.forEach((id, index) => {
    check.equal(
      `pixel ${id} decodes to color ${COLORS[index]}`,
      bytes[id],
      COLORS[index] + 1,
    );
  });

  let unexpected = 0;
  for (let id = 0; id < bytes.length; id++) {
    if ((IDS as readonly number[]).includes(id)) continue;
    if (bytes[id] !== 0) unexpected++;
  }
  check.equal("every other pixel stays unpainted", unexpected, 0);

  // pixelAt must agree with the packed bytes (proves the byte order both ways).
  for (let index = 0; index < IDS.length; index++) {
    check.equal(
      `pixelAt(${IDS[index]}) agrees`,
      await vault.pixelAt(BigInt(IDS[index])),
      COLORS[index] + 1,
    );
  }

  // Out-of-range chunk reads must revert with BadRange.
  await check.expectRevert(
    "getPixels(0, 1025) reverts",
    () => vault.getPixels(0, 1025),
    "BadRange",
  );
  await check.expectRevert(
    "getPixels(8191, 1024) reverts",
    () => vault.getPixels(8191, 1024),
    "BadRange",
  );
  await check.expectRevert(
    "getPixels(8192, 1) reverts",
    () => vault.getPixels(8192, 1),
    "BadRange",
  );

  // Painted event decoding + the web's own log-replay path.
  const logs = await vault.paintLogs();
  check.equal("one Painted event emitted", logs.length, 1);
  const first = logs[0] as { args?: Record<string, unknown> };
  const args = first.args as {
    painter?: string;
    epoch?: bigint;
    ids?: readonly number[];
    colors?: readonly number[];
    burned?: bigint;
  };
  const price = await vault.price();
  check.check(
    "Painted painter matches",
    (args.painter ?? "").toLowerCase() === painter.address.toLowerCase(),
    args.painter,
  );
  check.equal("Painted epoch", args.epoch, 0n);
  check.check(
    "Painted ids decoded",
    JSON.stringify(args.ids) === JSON.stringify([...IDS]),
    JSON.stringify(args.ids),
  );
  check.check(
    "Painted colors decoded",
    JSON.stringify(args.colors) === JSON.stringify([...COLORS]),
    JSON.stringify(args.colors),
  );
  check.equal("Painted burned", args.burned, price * BigInt(IDS.length));

  // Second paint: overlap one pixel and paint two more, then replay every log
  // through applyPaint (the same function useCanvasData uses for live updates).
  const SECOND_IDS = [31, 100, 262_143];
  const SECOND_COLORS = [9, 7, 31];
  await vault.paint(painter, SECOND_IDS, SECOND_COLORS);
  const afterSecond = await readWholeCanvas(vault, 1024);
  const allLogs = await vault.paintLogs();
  check.equal("two Painted events", allLogs.length, 2);

  const replayed = new Uint8Array(262_144);
  for (const log of allLogs) {
    const eventArgs = (log as { args?: { ids?: readonly number[]; colors?: readonly number[] } }).args;
    if (!eventArgs?.ids || !eventArgs.colors) {
      check.fail("log has ids/colors", "missing args");
      continue;
    }
    applyPaint(replayed, eventArgs.ids, eventArgs.colors);
  }
  let replayDiff = 0;
  for (let id = 0; id < replayed.length; id++) {
    if (replayed[id] !== afterSecond.bytes[id]) replayDiff++;
  }
  check.equal("web log replay matches chain state byte-for-byte", replayDiff, 0);
  check.equal("overlapping pixel uses the last color", afterSecond.bytes[31], 10);
  check.equal("second-paint burned", await vault.totalBurned(), price * 9n);

  // The event signature parsed by the app must be the one the contract emits.
  const eventSignature = `${PAINTED_EVENT.name}(${PAINTED_EVENT.inputs.map((input) => input.type).join(",")})`;
  check.check(
    "app PAINTED_EVENT signature",
    eventSignature === "Painted(address,uint64,uint32[],uint8[],uint256)",
    eventSignature,
  );

  // Sanity: the chunk bytes are the same bytes getPixels returns per slot.
  const slotZero = hexToBytes(await vault.getPixels(0, 1));
  check.equal("slot 0 byte 0 is pixel 0", slotZero[0], 1);
  check.equal("slot 0 byte 31 is pixel 31", slotZero[31], 10);

  return deployment;
}
