import { defineChain, isAddress, type Address } from "viem";

/**
 * Robinhood Chain mainnet.
 * Verified 2026-10-18: official docs list chain ID 4663 with
 * https://rpc.mainnet.chain.robinhood.com and robinhoodchain.blockscout.com.
 * The live RPC returns eth_chainId 0x1237 (4663).
 * Sources: docs.robinhood.com/chain/connecting and
 * robinhood.com/us/en/support/articles/robinhood-chain-mainnet
 */
export const DEFAULT_CHAIN_ID = 4663;
export const DEFAULT_RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
export const DEFAULT_EXPLORER_URL = "https://robinhoodchain.blockscout.com";

function envString(key: string, fallback: string): string {
  const value = process.env[key]?.trim();
  return value ? value : fallback;
}

function envAddress(key: string): Address | null {
  const value = envString(key, "");
  return value && isAddress(value) ? value : null;
}

function envNumber(key: string, fallback: number): number {
  const parsed = Number.parseInt(envString(key, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const CHAIN_ID = envNumber("NEXT_PUBLIC_CHAIN_ID", DEFAULT_CHAIN_ID);
export const RPC_URL = envString("NEXT_PUBLIC_RPC_URL", DEFAULT_RPC_URL);
export const EXPLORER_URL = envString("NEXT_PUBLIC_EXPLORER_URL", DEFAULT_EXPLORER_URL);
export const VAULT_ADDRESS = envAddress("NEXT_PUBLIC_VAULT_ADDRESS");
export const IMD_ADDRESS = envAddress("NEXT_PUBLIC_IMD_ADDRESS");
export const WALLETCONNECT_PROJECT_ID = envString(
  "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
  "",
);

/**
 * 1024 slots × 32 bytes = 32,768 pixels per getPixels call, so 8 calls for the
 * whole canvas. The contract caps a call at MAX_READ_SLOTS (1024); the read
 * adapter clamps to the on-chain value at runtime.
 */
export const CANVAS_CHUNK_SLOTS = Math.min(
  8192,
  envNumber("NEXT_PUBLIC_CANVAS_CHUNK_SLOTS", 1024),
);

/** Used when MAX_READ_SLOTS cannot be read (for example a transient RPC error). */
export const MAX_READ_SLOTS_FALLBACK = 1024;

/**
 * DEV ONLY: adds a local Anvil test connector (well-known test key). Ignored
 * unless the chain is 31337; see src/lib/local-dev-connector.ts.
 */
export const LOCAL_DEV_ENABLED =
  process.env.NEXT_PUBLIC_LOCAL_DEV?.trim().toLowerCase() === "true";
export const LOCAL_DEV_CHAIN_ID = 31337;

export const robinhoodChain = defineChain({
  id: CHAIN_ID,
  name:
    CHAIN_ID === DEFAULT_CHAIN_ID
      ? "Robinhood Chain"
      : CHAIN_ID === LOCAL_DEV_CHAIN_ID
        ? "Anvil Local"
        : `Robinhood Chain ${CHAIN_ID}`,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Robinhood Chain Explorer", url: EXPLORER_URL },
  },
});

export const CONTRACTS_CONFIGURED = Boolean(VAULT_ADDRESS && IMD_ADDRESS);

export function explorerTxUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}
