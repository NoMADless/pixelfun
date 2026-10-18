import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Abi } from "viem";
import { Checker } from "./assert";
import { startAnvil } from "./anvil";
import { loadArtifacts } from "./artifacts";
import { createChainContext } from "./chain";
import { CONFIG } from "./config";
import { runCanvasScenario } from "./scenarios/canvas";
import { runEpochScenario } from "./scenarios/epoch";
import { runBoardScenario } from "./scenarios/board";
import { runGasScenario } from "./scenarios/gas";
import { runVaultScenario } from "./scenarios/vault";

interface AbiItem {
  type?: string;
  name?: string;
  inputs?: Array<{ type: string }>;
}

function signatures(abi: Abi): string[] {
  return (abi as AbiItem[])
    .filter((item) => (item.type === "function" || item.type === "event") && item.name)
    .map(
      (item) =>
        `${item.type}:${item.name}(${(item.inputs ?? []).map((input) => input.type).join(",")})`,
    )
    .sort();
}

async function main(): Promise<void> {
  console.log("PixelFun local end-to-end test (Anvil, no real network, no real keys)");
  console.log(`contract repo: ${CONFIG.contractRepo}`);
  const check = new Checker();
  const artifacts = loadArtifacts();

  // The committed ABI must be the artifact's ABI, not a hand-written subset.
  check.section("ABI artifact");
  const committed = JSON.parse(
    readFileSync(join(process.cwd(), "abi/PixelFunVault.json"), "utf8"),
  ) as Abi;
  const artifactSignatures = signatures(artifacts.vault.abi);
  const committedSignatures = signatures(committed);
  check.equal(
    "abi/PixelFunVault.json matches the compiled artifact",
    artifactSignatures.join("|"),
    committedSignatures.join("|"),
  );
  check.check(
    "artifact includes totalBurned/MAX_READ_SLOTS/BURN_ADDRESS",
    ["totalBurned", "MAX_READ_SLOTS", "BURN_ADDRESS", "totalDeposited"].every((name) =>
      artifactSignatures.some((signature) => signature.includes(`:${name}(`)),
    ),
  );

  const anvil = await startAnvil();
  try {
    const chain = createChainContext(anvil.url);
    console.log(`anvil wallets: ${chain.wallets.length}, deployer ${chain.deployer.address}`);

    for (const [runIndex, decimals] of CONFIG.decimalRuns.entries()) {
      console.log(`\n=== ${decimals} decimals run ===`);
      await runCanvasScenario(chain, artifacts, check, decimals);
      await runVaultScenario(chain, artifacts, check, decimals);
      await runBoardScenario(chain, artifacts, check, decimals);
      await runEpochScenario(chain, artifacts, check, decimals);
      await runGasScenario(chain, artifacts, check, decimals, runIndex === 0 && CONFIG.gasWrite);
    }
  } finally {
    await anvil.stop();
  }

  console.log(`\n${check.summary()}`);
  if (check.failures > 0) {
    const failed = check.results.filter((result) => !result.ok);
    console.error(`\n${check.failures} failed check(s):`);
    for (const result of failed) {
      console.error(`  - [${result.group}] ${result.label}: ${result.detail}`);
    }
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
