import { resolve } from "node:path";

function envString(key: string, fallback: string): string {
  const value = process.env[key]?.trim();
  return value ? value : fallback;
}

function envInt(key: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[key] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const root = process.cwd();

export const CONFIG = {
  /** Path to the IMD launch repo (PixelFun.sol + its forge artifacts). */
  contractRepo: resolve(
    root,
    envString("PIXELFUN_CONTRACT_REPO", "../launch-2148-dsa"),
  ),
  /** Foundry binaries. Put them on PATH or point these at the executables. */
  anvilBin: envString("ANVIL_BIN", "anvil"),
  forgeBin: envString("FORGE_BIN", "forge"),
  /** Anvil chain id. The app's dev connector only allows 31337. */
  chainId: 31337,
  anvilPort: envInt("E2E_ANVIL_PORT", 0),
  /** Anvil's documented default mnemonic (never a real key). */
  mnemonic: "test test test test test test test test test test test junk",
  /** 66 board painters + newcomers + gas wallets. */
  walletCount: 80,
  minPixels: 20,
  boardSize: 66,
  maxBatch: 100,
  /** Decimals used for the two full runs. */
  decimalRuns: [18, 6] as const,
  gasWrite: envString("E2E_WRITE_GAS", "1") !== "0",
} as const;

export const ARTIFACTS = {
  vault: "out/PixelFun.sol/PixelFun.json",
  // Mock IMD: the contract repo's own local test ERC20 (constructor decimals).
  token: "out/PixelFunTokens.sol/CanvasToken.json",
} as const;
