/**
 * Browser fixture: deploys a mock IMD + the real PixelFun to an Anvil node that
 * is already running, then seeds a few pixels and a small board so the UI has
 * something to render.
 *
 * Usage:
 *   anvil --port 8545 --chain-id 31337
 *   npx tsx scripts/local-e2e/fixture.ts
 *   # copy the printed env into .env.local, then: npm run dev
 */
import { loadArtifacts } from "./artifacts";
import { createChainContext, deployFresh, fundPainter, tokenUnits } from "./chain";
import { CONFIG } from "./config";

const RPC_URL = process.env.E2E_RPC_URL?.trim() || "http://127.0.0.1:8545";

async function main(): Promise<void> {
  const artifacts = loadArtifacts();
  const chain = createChainContext(RPC_URL);
  const decimals = 18;
  const deployment = await deployFresh(chain, artifacts, decimals);
  const { vault, token } = deployment;

  const [dev, rivalA, rivalB] = chain.wallets;
  const deposit = 10n * tokenUnits(decimals);
  await token.mint(chain.deployer, dev.address, deposit);
  await token.approve(dev, vault.address, deposit);
  await vault.deposit(dev, deposit);

  // Recognisable pixels for the canvas render check.
  const ids = [0, 1, 2, 3, 511, 512, 513, 262_143];
  const colors = [0, 8, 12, 19, 26, 31, 30, 5];
  await vault.paint(dev, ids, colors);

  // Cross MIN_PIXELS so the dev account is on the board, plus two rivals.
  await vault.paint(dev, Array.from({ length: 17 }, (_, i) => 1000 + i), Array.from({ length: 17 }, () => 18));
  for (const [wallet, count, color] of [
    [rivalA, 30, 12] as const,
    [rivalB, 40, 27] as const,
  ]) {
    await fundPainter(deployment, wallet, count);
    await vault.paint(
      wallet,
      Array.from({ length: count }, (_, i) => 2000 + i),
      Array.from({ length: count }, () => color),
    );
  }

  const price = await vault.price();
  const epoch = await vault.currentEpoch();
  const board = await vault.getBoard(epoch);
  const sample = await vault.pixelAt(262_143n);

  console.log("\nLocal fixture ready. Add these to .env.local:");
  console.log("----------------------------------------------------------------");
  console.log("MOCK_MODE=false");
  console.log("NEXT_PUBLIC_CHAIN_ID=31337");
  console.log(`NEXT_PUBLIC_RPC_URL=${RPC_URL}`);
  console.log("NEXT_PUBLIC_LOCAL_DEV=true");
  console.log(`NEXT_PUBLIC_VAULT_ADDRESS=${vault.address}`);
  console.log(`NEXT_PUBLIC_IMD_ADDRESS=${token.address}`);
  console.log("NEXT_PUBLIC_SITE_URL=http://localhost:3200");
  console.log("----------------------------------------------------------------");
  console.log(`PRICE: ${price.toString()} raw`);
  console.log(`dev wallet: ${dev.address} (vault ${(await vault.balanceOf(dev.address)).toString()} raw)`);
  console.log(`board: ${board.painters.length} entries, counts ${board.counts.join(",")}`);
  console.log(`pixelAt(262143): ${sample} (palette ${sample - 1})`);
  console.log(`MIN_PIXELS: ${(await vault.minPixels()).toString()}, epoch ${epoch.toString()}`);
  console.log(`contract repo: ${CONFIG.contractRepo}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
