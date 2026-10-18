import { isMockMode } from "../src/config/server";
import { collectEnvIssues, formatEnvIssues } from "../src/config/env";
import {
  getReadClient,
  readBoard,
  readBoardSize,
  readCanvasChunk,
  readCurrentEpoch,
  readEpochAnchor,
  readHeight,
  readMinPixels,
  readPrice,
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
    const [price, width, height, minPixels, anchor, currentEpoch, totalPainted, boardSize] =
      await Promise.all([
        readPrice(client),
        readWidth(client),
        readHeight(client),
        readMinPixels(client),
        readEpochAnchor(client),
        readCurrentEpoch(client),
        readTotalPixelsPainted(client),
        readBoardSize(client),
      ]);
    // One getPixels chunk (default 512 slots = 16,384 pixels) and the live board.
    const chunk = await readCanvasChunk(client, 0, 512);
    const board = await readBoard(currentEpoch, client);

    add("PRICE read", price > 0n, `${price.toString()} raw (${price > 0n ? "non-zero" : "zero"})`);
    add("WIDTH read", width === 512, `${width}`);
    add("HEIGHT read", height === 512, `${height}`);
    add("MIN_PIXELS read", minPixels >= 0, `${minPixels}`);
    add(
      "EPOCH_START read",
      anchor > 0n,
      `${anchor.toString()} (${new Date(Number(anchor) * 1_000).toISOString()})`,
    );
    add("currentEpoch read", currentEpoch >= 0n, `${currentEpoch.toString()}`);
    add("totalPixelsPainted read", totalPainted >= 0n, `${totalPainted.toString()}`);
    add("getPixels chunk", chunk.length === 512 * 32, `${chunk.length} bytes, expected 16384`);
    add(
      "getBoard(currentEpoch)",
      board.painters.length === board.counts.length && board.painters.length <= boardSize,
      `${board.painters.length} entries, boardSize ${boardSize}`,
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
