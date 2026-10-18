import { isMockMode } from "../src/config/server";
import { collectEnvIssues, formatEnvIssues } from "../src/config/env";
import { IMD_ADDRESS } from "../src/config/chains";
import {
  getReadClient,
  readBoard,
  readBoardSize,
  readCanvasChunk,
  readCurrentEpoch,
  readEpochAnchor,
  readEpochEnd,
  readHeight,
  readImdAddress,
  readMinPixels,
  readPrice,
  readTokenDecimals,
  readTotalPixelsPainted,
  readWidth,
} from "../src/lib/contract";

function loadLocalEnv(): void {
  const loader = (process as unknown as { loadEnvFile?: (path: string) => void }).loadEnvFile;
  if (!loader) return;
  try {
    loader(".env.local");
  } catch {
    // A missing .env.local is fine: the caller may provide env directly.
  }
}

interface Check {
  label: string;
  ok: boolean;
  detail: string;
}

function iso(seconds: bigint): string {
  return new Date(Number(seconds) * 1_000).toISOString();
}

/** 0.005 in token base units: 5 * 10 ** (decimals - 3). */
function expectedPrice(decimals: number): bigint {
  return 5n * 10n ** BigInt(decimals - 3);
}

async function main(): Promise<void> {
  loadLocalEnv();

  if (isMockMode()) {
    console.error("Smoke check needs a deployed vault. Set MOCK_MODE=false and provide the chain env.");
    process.exitCode = 1;
    return;
  }

  const issues = collectEnvIssues();
  if (issues.length > 0) {
    console.error("Smoke check cannot start:\n" + formatEnvIssues(issues));
    process.exitCode = 1;
    return;
  }

  const checks: Check[] = [];
  const add = (label: string, ok: boolean, detail: string) => {
    checks.push({ label, ok, detail });
  };

  try {
    const client = getReadClient();
    const [
      price,
      width,
      height,
      minPixels,
      anchor,
      currentEpoch,
      totalPainted,
      boardSize,
      imdAddress,
      decimals,
    ] = await Promise.all([
      readPrice(client),
      readWidth(client),
      readHeight(client),
      readMinPixels(client),
      readEpochAnchor(client),
      readCurrentEpoch(client),
      readTotalPixelsPainted(client),
      readBoardSize(client),
      readImdAddress(client),
      readTokenDecimals(client),
    ]);
    // One getPixels chunk (default 512 slots = 16,384 pixels) and the live board.
    const chunk = await readCanvasChunk(client, 0, 512);
    const board = await readBoard(currentEpoch, client);
    const epoch0End = await readEpochEnd(0n, client);

    add(
      "imd()",
      Boolean(IMD_ADDRESS) && imdAddress.toLowerCase() === IMD_ADDRESS?.toLowerCase(),
      `${imdAddress} (configured ${IMD_ADDRESS ?? "unset"})`,
    );
    add("MIN_PIXELS", minPixels === 20, `${minPixels} (expected 20)`);
    add(
      "PRICE()",
      price === expectedPrice(decimals) && price === 5_000_000_000_000_000n,
      `${price.toString()} raw (decimals ${decimals}, expected 5000000000000000)`,
    );
    add("WIDTH / HEIGHT", width === 512 && height === 512, `${width} x ${height}`);
    add("BOARD_SIZE", boardSize === 66, `${boardSize} (expected 66)`);
    add(
      "EPOCH_START",
      anchor > 0n,
      `${anchor.toString()} (${iso(anchor)}); epoch 0 ends ${iso(epoch0End)}`,
    );
    add("currentEpoch", currentEpoch === 0n, `${currentEpoch.toString()} (fresh deployment)`);
    add(
      "getBoard(currentEpoch) empty",
      currentEpoch === 0n && board.painters.length === 0 && board.counts.length === 0,
      `${board.painters.length} entries, boardSize ${boardSize}`,
    );
    add(
      "totalPixelsPainted",
      totalPainted === 0n,
      `${totalPainted.toString()} (expected 0 before launch)`,
    );
    add("getPixels chunk", chunk.length === 512 * 32, `${chunk.length} bytes, expected 16384`);
    const firstNonZero = chunk.findIndex((byte) => byte !== 0);
    add(
      "getPixels chunk all zeros",
      firstNonZero === -1,
      firstNonZero === -1 ? "all 16,384 pixels empty" : `byte ${firstNonZero} is non-zero`,
    );
  } catch (error) {
    add("RPC smoke read", false, error instanceof Error ? error.message : String(error));
  }

  console.log("PixelFun deployed-vault smoke check");
  for (const check of checks) {
    console.log(`  ${check.ok ? "PASS" : "FAIL"} ${check.label}: ${check.detail}`);
  }

  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    console.error(`\nSmoke check failed: ${failed.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log(`\nSmoke check passed: ${checks.length} checks.`);
  }
}

void main();
