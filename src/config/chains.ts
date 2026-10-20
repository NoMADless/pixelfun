import { defineChain, isAddress, type Address } from "viem";

/**
 * Robinhood Chain mainnet.
 * Verified 2026-10-18: official docs list chain ID 4663 with
 * https://rpc.mainnet.chain.robinhood.com. The live RPC returns eth_chainId
 * 0x1237 (4663). The deployed vault is published on robin.etherscan.io, so that
 * is the default explorer; Blockscout is kept as a documented alternative.
 * Sources: docs.robinhood.com/chain/connecting and
 * robinhood.com/us/en/support/articles/robinhood-chain-mainnet
 */
export const DEFAULT_CHAIN_ID = 4663;
export const DEFAULT_RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
export const DEFAULT_EXPLORER_URL = "https://robin.etherscan.io";

/**
 * Live PixelFun deployment (IMD launch 2148). These are public constants, not
 * secrets, and they are the defaults because a static export inlines its
 * configuration at build time: a host that only runs `npm run build` (IPFS,
 * for example) never gets a chance to supply `NEXT_PUBLIC_*` variables.
 * Setting the variables still overrides them.
 */
export const DEFAULT_VAULT_ADDRESS: Address = "0x30da521f63553ec3ea2dbb82c30581c00ccf9009";
export const DEFAULT_IMD_ADDRESS: Address = "0x5F7Bb59365ce557C26dbcAa4EE9d39A4b95B7127";

/*
 * Read NEXT_PUBLIC_* values with literal property access. Next inlines them at
 * build time only when written as `process.env.NEXT_PUBLIC_X`; a computed
 * `process.env[key]` is undefined in the browser bundle and silently falls back
 * to mainnet, even when the env file points somewhere else.
 */
const RAW = {
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL,
  vaultAddress: process.env.NEXT_PUBLIC_VAULT_ADDRESS,
  imdAddress: process.env.NEXT_PUBLIC_IMD_ADDRESS,
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  canvasChunkSlots: process.env.NEXT_PUBLIC_CANVAS_CHUNK_SLOTS,
  localDev: process.env.NEXT_PUBLIC_LOCAL_DEV,
};

function envString(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function envAddress(value: string | undefined): Address | null {
  const trimmed = value?.trim();
  return trimmed && isAddress(trimmed) ? trimmed : null;
}

function envNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value?.trim() ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const CHAIN_ID = envNumber(RAW.chainId, DEFAULT_CHAIN_ID);
export const RPC_URL = envString(RAW.rpcUrl, DEFAULT_RPC_URL);
export const EXPLORER_URL = envString(RAW.explorerUrl, DEFAULT_EXPLORER_URL);
export const VAULT_ADDRESS = envAddress(RAW.vaultAddress) ?? DEFAULT_VAULT_ADDRESS;
export const IMD_ADDRESS = envAddress(RAW.imdAddress) ?? DEFAULT_IMD_ADDRESS;
export const WALLETCONNECT_PROJECT_ID = envString(RAW.walletConnectProjectId, "");

/**
 * 1024 slots × 32 bytes = 32,768 pixels per getPixels call, so 8 calls for the
 * whole canvas. The contract caps a call at MAX_READ_SLOTS (1024); the read
 * adapter clamps to the on-chain value at runtime.
 */
export const CANVAS_CHUNK_SLOTS = Math.min(8192, envNumber(RAW.canvasChunkSlots, 1024));

/** Used when MAX_READ_SLOTS cannot be read (for example a transient RPC error). */
export const MAX_READ_SLOTS_FALLBACK = 1024;

/**
 * DEV ONLY: adds a local Anvil test connector (well-known test key). Ignored
 * unless the chain is 31337; see src/lib/local-dev-connector.ts.
 */
export const LOCAL_DEV_ENABLED = RAW.localDev?.trim().toLowerCase() === "true";
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

/** ERC-20 page, which is `/token/…` on the published explorer. */
export function explorerTokenUrl(address: string): string {
  return `${EXPLORER_URL}/token/${address}`;
}
