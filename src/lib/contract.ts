import {
  createPublicClient,
  http,
  parseAbiItem,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import vaultAbiJson from "../../abi/PixelFunVault.json";
import erc20AbiJson from "../../abi/ERC20.json";
import {
  CANVAS_CHUNK_SLOTS,
  IMD_ADDRESS,
  RPC_URL,
  VAULT_ADDRESS,
  robinhoodChain,
} from "@/config/chains";
import { CANVAS_PIXEL_COUNT, SLOT_BYTES, TOTAL_SLOTS } from "@/shared/palette";

export const VAULT_ABI = vaultAbiJson as Abi;
export const ERC20_ABI = erc20AbiJson as Abi;

export const CONTRACT = {
  vault: VAULT_ADDRESS,
  imd: IMD_ADDRESS,
  chain: robinhoodChain,
} as const;

export const PAINTED_EVENT = parseAbiItem(
  "event Painted(address indexed painter, uint64 indexed epoch, uint32[] ids, uint8[] colors, uint256 burned)",
);

let cachedClient: PublicClient | null = null;

/** Shared viem client for server-side reads and the browser RPC fallback. */
export function getReadClient(): PublicClient {
  if (!cachedClient) {
    cachedClient = createPublicClient({
      chain: robinhoodChain,
      transport: http(RPC_URL, { timeout: 20_000, retryCount: 1 }),
    }) as PublicClient;
  }
  return cachedClient;
}

function hexToBytes(hex: Hex): Uint8Array {
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (body.length === 0) return new Uint8Array(0);
  if (body.length % 2 !== 0) throw new Error("Malformed hex payload from getPixels.");
  const bytes = new Uint8Array(body.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireVault() {
  if (!VAULT_ADDRESS) throw new Error("PixelFunVault address is not configured.");
  return VAULT_ADDRESS;
}

export async function readCanvasChunk(
  client: PublicClient,
  startSlot: number,
  slotCount: number,
): Promise<Uint8Array> {
  const hex = (await client.readContract({
    address: requireVault(),
    abi: VAULT_ABI,
    functionName: "getPixels",
    args: [startSlot, slotCount],
  })) as Hex;
  const bytes = hexToBytes(hex);
  const expected = slotCount * SLOT_BYTES;
  if (bytes.length !== expected) {
    throw new Error(
      `getPixels(${startSlot}, ${slotCount}) returned ${bytes.length} bytes, expected ${expected}.`,
    );
  }
  return bytes;
}

export interface ReadCanvasOptions {
  client?: PublicClient;
  chunkSlots?: number;
  concurrency?: number;
  retries?: number;
  onChunk?: (done: number, total: number) => void;
}

/**
 * Read all 262,144 canvas bytes using getPixels in chunks.
 * Default 512 slots = 16,384 pixels per call, so 16 calls.
 */
export async function readCanvasFromRpc(options: ReadCanvasOptions = {}): Promise<Uint8Array> {
  const client = options.client ?? getReadClient();
  const chunkSlots = Math.max(
    1,
    Math.min(TOTAL_SLOTS, Math.floor(options.chunkSlots ?? CANVAS_CHUNK_SLOTS)),
  );
  const concurrency = Math.max(1, Math.min(8, options.concurrency ?? 4));
  const retries = Math.max(0, options.retries ?? 2);
  const canvas = new Uint8Array(CANVAS_PIXEL_COUNT);
  const total = Math.ceil(TOTAL_SLOTS / chunkSlots);
  let nextIndex = 0;
  let done = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= total) return;
      const startSlot = index * chunkSlots;
      const slotCount = Math.min(chunkSlots, TOTAL_SLOTS - startSlot);
      let lastError: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const bytes = await readCanvasChunk(client, startSlot, slotCount);
          canvas.set(bytes, startSlot * SLOT_BYTES);
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          if (attempt < retries) await delay(200 * 2 ** attempt);
        }
      }
      if (lastError) throw lastError;
      done++;
      options.onChunk?.(done, total);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, total) }, () => worker()),
  );
  return canvas;
}

export async function getLatestBlockNumber(client = getReadClient()): Promise<bigint> {
  return client.getBlockNumber();
}

export async function getPaintedLogs(
  fromBlock: bigint,
  toBlock: bigint,
  client = getReadClient(),
) {
  return client.getLogs({
    address: requireVault(),
    event: PAINTED_EVENT,
    fromBlock,
    toBlock,
  });
}

export async function readTokenDecimals(client = getReadClient()): Promise<number> {
  if (!IMD_ADDRESS) throw new Error("IMD address is not configured.");
  const decimals = await client.readContract({
    address: IMD_ADDRESS,
    abi: ERC20_ABI,
    functionName: "decimals",
  });
  return Number(decimals);
}

/* ---------------------------- read config builders ---------------------------- */

/**
 * Configs for wagmi's useReadContract. Keeping the ABI, address and function
 * names here means a final-ABI rename only touches this adapter.
 */
export function readTokenDecimalsConfig() {
  return {
    address: IMD_ADDRESS ?? undefined,
    abi: ERC20_ABI,
    functionName: "decimals" as const,
    chainId: robinhoodChain.id,
  };
}

export function readTokenBalanceConfig(owner?: Address) {
  return {
    address: IMD_ADDRESS ?? undefined,
    abi: ERC20_ABI,
    functionName: "balanceOf" as const,
    args: owner ? ([owner] as const) : undefined,
    chainId: robinhoodChain.id,
  };
}

export function readVaultBalanceConfig(owner?: Address) {
  return {
    address: VAULT_ADDRESS ?? undefined,
    abi: VAULT_ABI,
    functionName: "balanceOf" as const,
    args: owner ? ([owner] as const) : undefined,
    chainId: robinhoodChain.id,
  };
}

export function readAllowanceConfig(owner?: Address) {
  return {
    address: IMD_ADDRESS ?? undefined,
    abi: ERC20_ABI,
    functionName: "allowance" as const,
    args: owner && VAULT_ADDRESS ? ([owner, VAULT_ADDRESS] as const) : undefined,
    chainId: robinhoodChain.id,
  };
}

export function readPriceConfig() {
  return {
    address: VAULT_ADDRESS ?? undefined,
    abi: VAULT_ABI,
    functionName: "PRICE" as const,
    chainId: robinhoodChain.id,
  };
}

export function readMaxBatchConfig() {
  return {
    address: VAULT_ADDRESS ?? undefined,
    abi: VAULT_ABI,
    functionName: "MAX_BATCH" as const,
    chainId: robinhoodChain.id,
  };
}

/* ---------------------------- write call builders ---------------------------- */

export function paintCall(ids: readonly number[], colors: readonly number[]) {
  return {
    address: requireVault(),
    abi: VAULT_ABI,
    functionName: "paint" as const,
    args: [ids, colors] as const,
  };
}

export function depositCall(amount: bigint) {
  return {
    address: requireVault(),
    abi: VAULT_ABI,
    functionName: "deposit" as const,
    args: [amount] as const,
  };
}

export function withdrawCall(amount: bigint) {
  return {
    address: requireVault(),
    abi: VAULT_ABI,
    functionName: "withdraw" as const,
    args: [amount] as const,
  };
}

export function approveCall(amount: bigint) {
  if (!IMD_ADDRESS || !VAULT_ADDRESS) throw new Error("IMD or vault address is not configured.");
  return {
    address: IMD_ADDRESS,
    abi: ERC20_ABI,
    functionName: "approve" as const,
    args: [VAULT_ADDRESS, amount] as const,
  };
}

export async function readAllowance(owner: `0x${string}`, client = getReadClient()) {
  if (!IMD_ADDRESS || !VAULT_ADDRESS) throw new Error("IMD or vault address is not configured.");
  return (await client.readContract({
    address: IMD_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, VAULT_ADDRESS],
  })) as bigint;
}

export async function readTokenBalance(owner: `0x${string}`, client = getReadClient()) {
  if (!IMD_ADDRESS) throw new Error("IMD address is not configured.");
  return (await client.readContract({
    address: IMD_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [owner],
  })) as bigint;
}

export async function readVaultBalance(owner: `0x${string}`, client = getReadClient()) {
  return (await client.readContract({
    address: requireVault(),
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: [owner],
  })) as bigint;
}
