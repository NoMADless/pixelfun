import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  http,
  isAddress,
  type Abi,
  type Address,
  type Hex,
} from "viem";

/**
 * Read-only provenance check for the deployed vault.
 *
 * The launch receipt says the contract was "rebuilt", so the deployed code is
 * compared with the artifact compiled from the published commit:
 *  - runtime bytecode, with every immutable reference masked to zero;
 *  - each immutable group's value against the live getters;
 *  - the creation code and constructor args carried by the deploy transaction.
 *
 * No transaction is sent. Missing inputs fail with a clear message.
 */

const DEFAULT_RPC = "https://rpc.mainnet.chain.robinhood.com";
const DEFAULT_ARTIFACT = "../launch-2148-dsa";

function loadLocalEnv(): void {
  const loader = (process as unknown as { loadEnvFile?: (path: string) => void }).loadEnvFile;
  if (!loader) return;
  try {
    loader(".env.local");
  } catch {
    // The caller may provide the env directly.
  }
}

function bare(value: string): string {
  return value.replace(/^0x/i, "").toLowerCase();
}

function word(value: bigint | string): string {
  const hex = typeof value === "bigint" ? value.toString(16) : bare(value);
  return hex.padStart(64, "0");
}

interface Artifact {
  abi: readonly unknown[];
  bytecode: { object: string };
  deployedBytecode: {
    object: string;
    immutableReferences?: Record<string, { start: number; length: number }[]>;
  };
}

interface Check {
  label: string;
  ok: boolean;
  detail: string;
}

function maskImmutables(
  runtime: string,
  references: Record<string, { start: number; length: number }[]>,
): string {
  const chars = runtime.split("");
  for (const ranges of Object.values(references)) {
    for (const range of ranges) {
      for (let i = 0; i < range.length * 2; i++) chars[range.start * 2 + i] = "0";
    }
  }
  return chars.join("");
}

async function main(): Promise<void> {
  loadLocalEnv();

  const vault = process.env.NEXT_PUBLIC_VAULT_ADDRESS?.trim();
  const imd = process.env.NEXT_PUBLIC_IMD_ADDRESS?.trim();
  const deployTx = process.env.PIXELFUN_DEPLOY_TX?.trim();
  const rpcUrl = process.env.ROBINHOOD_RPC_URL?.trim() || process.env.NEXT_PUBLIC_RPC_URL?.trim();
  const repo = process.env.PIXELFUN_CONTRACT_REPO?.trim() || DEFAULT_ARTIFACT;

  if (!vault || !isAddress(vault)) {
    console.error("check:bytecode needs a valid NEXT_PUBLIC_VAULT_ADDRESS.");
    process.exitCode = 1;
    return;
  }
  if (!imd || !isAddress(imd)) {
    console.error("check:bytecode needs a valid NEXT_PUBLIC_IMD_ADDRESS.");
    process.exitCode = 1;
    return;
  }

  const artifactPath = path.resolve(repo, "out/PixelFun.sol/PixelFun.json");
  if (!fs.existsSync(artifactPath)) {
    console.error(
      `check:bytecode cannot find ${artifactPath}. Set PIXELFUN_CONTRACT_REPO to the contract checkout.`,
    );
    process.exitCode = 1;
    return;
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as Artifact;
  const abi = artifact.abi as Abi;
  const references = artifact.deployedBytecode.immutableReferences ?? {};
  const client = createPublicClient({
    transport: http(rpcUrl || DEFAULT_RPC, { timeout: 20_000, retryCount: 1 }),
  });

  const checks: Check[] = [];
  const add = (label: string, ok: boolean, detail: string) => checks.push({ label, ok, detail });

  const [liveCode, liveImd, liveMinPixels, liveEpochStart] = await Promise.all([
    client.getCode({ address: vault as Address }),
    client.readContract({ address: vault as Address, abi, functionName: "imd" }) as Promise<Address>,
    client.readContract({
      address: vault as Address,
      abi,
      functionName: "MIN_PIXELS",
    }) as Promise<bigint>,
    client.readContract({
      address: vault as Address,
      abi,
      functionName: "EPOCH_START",
    }) as Promise<bigint>,
  ]);

  if (!liveCode || liveCode === "0x") {
    add("runtime code", false, `no code at ${vault}`);
  } else {
    const runtime = bare(liveCode);
    const compiled = bare(artifact.deployedBytecode.object);
    add(
      "runtime length",
      runtime.length === compiled.length,
      `${runtime.length / 2} bytes on-chain, ${compiled.length / 2} compiled`,
    );
    add(
      "runtime match (immutables masked)",
      maskImmutables(runtime, references) === maskImmutables(compiled, references),
      `${Object.keys(references).length} immutable groups masked`,
    );

    const groups = Object.entries(references).map(([id, ranges]) => ({
      id,
      values: [...new Set(ranges.map((r) => runtime.slice(r.start * 2, r.start * 2 + r.length * 2)))],
    }));
    const expected = new Map<string, string>([
      [word(imd), "imd"],
      [word(liveMinPixels), "MIN_PIXELS"],
      [word(liveEpochStart), "EPOCH_START"],
    ]);
    const matched = new Set<string>();
    let immutablesOk = true;
    for (const group of groups) {
      const label = group.values.length === 1 ? expected.get(group.values[0]) : undefined;
      if (!label || matched.has(label)) immutablesOk = false;
      else matched.add(label);
      const detail =
        group.values.length === 1
          ? label === "imd"
            ? `${label} = ${liveImd}`
            : `${label ?? "unknown value"} = ${label === "MIN_PIXELS" ? liveMinPixels.toString() : liveEpochStart.toString()}`
          : `${group.values.length} different values across occurrences`;
      add(`immutable ${group.id}`, Boolean(label), detail);
    }
    add(
      "immutable coverage",
      immutablesOk && matched.size === 3,
      `matched ${[...matched].join(", ") || "none"}; expected imd, MIN_PIXELS, EPOCH_START`,
    );
    add("MIN_PIXELS", liveMinPixels === 20n, `${liveMinPixels.toString()} (expected 20)`);
    add("imd()", liveImd.toLowerCase() === imd.toLowerCase(), `${liveImd} (configured ${imd})`);
  }

  if (!deployTx) {
    add("creation code", true, "skipped: set PIXELFUN_DEPLOY_TX to verify the deploy calldata");
  } else {
    try {
      const tx = await client.getTransaction({ hash: deployTx as Hex });
      const input = bare(tx.input);
      const creation = bare(artifact.bytecode.object);
      const offset = input.indexOf(creation);
      add(
        "creation code in deploy calldata",
        offset >= 0,
        offset >= 0 ? `found at byte ${offset / 2}` : "not found in tx input",
      );
      if (offset >= 0) {
        const args = input.slice(offset + creation.length);
        const argImd = "0x" + args.slice(24, 64);
        const argMin = BigInt("0x" + args.slice(64, 128));
        add(
          "constructor args",
          argImd.toLowerCase() === imd.toLowerCase() && argMin === 20n,
          `imd ${argImd}, minPixels ${argMin.toString()}`,
        );
      }
    } catch (error) {
      add("deploy transaction", false, error instanceof Error ? error.message : String(error));
    }
  }

  console.log("PixelFun deployed-bytecode provenance");
  console.log(`  artifact: ${artifactPath}`);
  for (const check of checks) {
    console.log(`  ${check.ok ? "PASS" : "FAIL"} ${check.label}: ${check.detail}`);
  }
  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    console.error(`\nBytecode check failed: ${failed.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log(`\nBytecode check passed: ${checks.length} checks.`);
  }
}

void main();
