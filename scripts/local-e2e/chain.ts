import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
  type Address,
  type Chain,
  type Hash,
  type Hex,
  type PublicClient,
  type TestClient,
  type TransactionReceipt,
  type Transport,
  type WalletClient,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { anvil } from "viem/chains";
import { ERC20_ABI, PAINTED_EVENT, VAULT_ABI } from "../../src/lib/contract";
import type { Artifact } from "./artifacts";
import { CONFIG } from "./config";

export const anvilChain = anvil;

export interface Wallet {
  address: Address;
  /** 1-based like anvil's account list. */
  index: number;
}

export interface ChainContext {
  url: string;
  chain: Chain;
  publicClient: PublicClient;
  testClient: TestClient<"anvil", Transport, Chain>;
  wallets: Wallet[];
  walletClient: (wallet: Wallet) => WalletClient;
  deployer: Wallet;
}

export function createChainContext(url: string, chainId: number = CONFIG.chainId): ChainContext {
  const chain: Chain =
    chainId === anvil.id
      ? anvil
      : { ...anvil, id: chainId, name: chainId === CONFIG.forkChainId ? "Fork" : `Chain ${chainId}` };
  const publicClient = createPublicClient({ chain, transport: http(url) });
  const testClient = createTestClient({ chain, mode: "anvil", transport: http(url) });
  const wallets: Wallet[] = Array.from({ length: CONFIG.walletCount }, (_, index) => ({
    address: mnemonicToAccount(CONFIG.mnemonic, { addressIndex: index }).address,
    index,
  }));

  const walletClient = (wallet: Wallet): WalletClient =>
    createWalletClient({
      account: mnemonicToAccount(CONFIG.mnemonic, { addressIndex: wallet.index }),
      chain,
      transport: http(url),
    });

  if (wallets.length === 0) throw new Error("No anvil wallets configured.");
  return {
    url,
    chain,
    publicClient,
    testClient,
    wallets,
    walletClient,
    deployer: wallets[0],
  };
}

export function tokenUnits(decimals: number): bigint {
  return 10n ** BigInt(decimals);
}

export function formatAmount(raw: bigint, decimals: number): string {
  const whole = raw / tokenUnits(decimals);
  const fraction = raw % tokenUnits(decimals);
  return fraction === 0n
    ? whole.toString()
    : `${whole}.${fraction.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}

export async function waitFor(
  client: PublicClient,
  hash: Hash,
): Promise<TransactionReceipt> {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Transaction ${hash} reverted.`);
  return receipt;
}

export async function deployArtifact(
  chain: ChainContext,
  wallet: Wallet,
  artifact: Artifact,
  args: readonly unknown[] = [],
): Promise<Address> {
  const client = chain.walletClient(wallet);
  const hash = await client.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args,
    account: client.account!,
    chain: chain.chain,
  });
  const receipt = await waitFor(chain.publicClient, hash);
  if (!receipt.contractAddress) throw new Error(`Deployment ${hash} has no address.`);
  return receipt.contractAddress;
}

export class MockIMD {
  constructor(
    readonly chain: ChainContext,
    readonly address: Address,
    readonly decimals: number,
    readonly abi: Artifact["abi"],
  ) {}

  async balanceOf(account: Address): Promise<bigint> {
    return (await this.chain.publicClient.readContract({
      address: this.address,
      abi: this.abi,
      functionName: "balanceOf",
      args: [account],
    })) as bigint;
  }

  async allowance(owner: Address, spender: Address): Promise<bigint> {
    return (await this.chain.publicClient.readContract({
      address: this.address,
      abi: this.abi,
      functionName: "allowance",
      args: [owner, spender],
    })) as bigint;
  }

  async mint(wallet: Wallet, to: Address, amount: bigint): Promise<void> {
    const client = this.chain.walletClient(wallet);
    const hash = await client.writeContract({
      address: this.address,
      abi: this.abi,
      functionName: "mint",
      args: [to, amount],
      account: client.account!,
      chain: this.chain.chain,
    });
    await waitFor(this.chain.publicClient, hash);
  }

  async approve(wallet: Wallet, spender: Address, amount: bigint): Promise<void> {
    const client = this.chain.walletClient(wallet);
    const hash = await client.writeContract({
      address: this.address,
      abi: this.abi,
      functionName: "approve",
      args: [spender, amount],
      account: client.account!,
      chain: this.chain.chain,
    });
    await waitFor(this.chain.publicClient, hash);
  }
}

export interface BoardRead {
  painters: Address[];
  counts: number[];
}

export class Vault {
  constructor(
    readonly chain: ChainContext,
    readonly address: Address,
  ) {}

  private read<T>(functionName: string, args: readonly unknown[] = []): Promise<T> {
    return this.chain.publicClient.readContract({
      address: this.address,
      abi: VAULT_ABI,
      functionName,
      args,
    }) as Promise<T>;
  }

  private async write(
    wallet: Wallet,
    functionName: string,
    args: readonly unknown[],
  ): Promise<TransactionReceipt> {
    const client = this.chain.walletClient(wallet);
    const hash = await client.writeContract({
      address: this.address,
      abi: VAULT_ABI,
      functionName,
      args,
      account: client.account!,
      chain: this.chain.chain,
    });
    return waitFor(this.chain.publicClient, hash);
  }

  price(): Promise<bigint> {
    return this.read("PRICE");
  }

  maxReadSlots(): Promise<bigint> {
    return this.read("MAX_READ_SLOTS");
  }

  slotCount(): Promise<bigint> {
    return this.read("SLOT_COUNT");
  }

  width(): Promise<bigint> {
    return this.read("WIDTH");
  }

  height(): Promise<bigint> {
    return this.read("HEIGHT");
  }

  paletteSize(): Promise<bigint> {
    return this.read("PALETTE_SIZE");
  }

  maxBatch(): Promise<bigint> {
    return this.read("MAX_BATCH");
  }

  minPixels(): Promise<bigint> {
    return this.read("MIN_PIXELS");
  }

  boardSize(): Promise<bigint> {
    return this.read("BOARD_SIZE");
  }

  epochLength(): Promise<bigint> {
    return this.read("EPOCH_LENGTH");
  }

  epochStartValue(): Promise<bigint> {
    return this.read("EPOCH_START");
  }

  burnAddress(): Promise<Address> {
    return this.read("BURN_ADDRESS");
  }

  totalBurned(): Promise<bigint> {
    return this.read("totalBurned");
  }

  totalDeposited(): Promise<bigint> {
    return this.read("totalDeposited");
  }

  totalPixelsPainted(): Promise<bigint> {
    return this.read("totalPixelsPainted");
  }

  balanceOf(account: Address): Promise<bigint> {
    return this.read("balanceOf", [account]);
  }

  currentEpoch(): Promise<bigint> {
    return this.read("currentEpoch");
  }

  epochStart(epoch: bigint): Promise<bigint> {
    return this.read("epochStart", [epoch]);
  }

  epochEnd(epoch: bigint): Promise<bigint> {
    return this.read("epochEnd", [epoch]);
  }

  epochEnded(epoch: bigint): Promise<boolean> {
    return this.read("epochEnded", [epoch]);
  }

  pixelsPaintedIn(epoch: bigint, painter: Address): Promise<number> {
    return this.read<number>("pixelsPaintedIn", [epoch, painter]);
  }

  isWhitelisted(epoch: bigint, painter: Address): Promise<boolean> {
    return this.read("isWhitelisted", [epoch, painter]);
  }

  async getBoard(epoch: bigint): Promise<BoardRead> {
    const [painters, counts] = await this.read<readonly [readonly Address[], readonly number[]]>(
      "getBoard",
      [epoch],
    );
    return { painters: [...painters], counts: counts.map(Number) };
  }

  getPixels(startSlot: number, slotCount: number): Promise<Hex> {
    return this.read("getPixels", [startSlot, slotCount]);
  }

  pixelAt(id: bigint): Promise<number> {
    return this.read<number>("pixelAt", [id]);
  }

  deposit(wallet: Wallet, amount: bigint): Promise<TransactionReceipt> {
    return this.write(wallet, "deposit", [amount]);
  }

  withdraw(wallet: Wallet, amount: bigint): Promise<TransactionReceipt> {
    return this.write(wallet, "withdraw", [amount]);
  }

  paint(wallet: Wallet, ids: readonly number[], colors: readonly number[]): Promise<TransactionReceipt> {
    return this.write(wallet, "paint", [ids, colors]);
  }

  async paintLogs(fromBlock = 0n): Promise<
    Awaited<ReturnType<PublicClient["getLogs"]>>
  > {
    return this.chain.publicClient.getLogs({
      address: this.address,
      event: PAINTED_EVENT,
      fromBlock,
      toBlock: "latest",
    });
  }
}

export function hexToBytes(hex: Hex): Uint8Array {
  const body = hex.slice(2);
  const out = new Uint8Array(body.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Read the whole canvas exactly the way the web app does: chunked getPixels. */
export async function readWholeCanvas(
  vault: Vault,
  chunkSlots = 1024,
): Promise<{ bytes: Uint8Array; calls: number }> {
  const canvas = new Uint8Array(262_144);
  const totalSlots = Number(await vault.slotCount());
  let calls = 0;
  for (let start = 0; start < totalSlots; start += chunkSlots) {
    const count = Math.min(chunkSlots, totalSlots - start);
    const bytes = hexToBytes(await vault.getPixels(start, count));
    if (bytes.length !== count * 32) {
      throw new Error(`getPixels(${start}, ${count}) returned ${bytes.length} bytes.`);
    }
    canvas.set(bytes, start * 32);
    calls++;
  }
  return { bytes: canvas, calls };
}

export interface Deployment {
  vault: Vault;
  token: MockIMD;
  vaultArtifact: Artifact;
  tokenArtifact: Artifact;
}

/** Deploy a fresh mock IMD + the real PixelFun, exactly as launch.json does. */
export async function deployFresh(
  chain: ChainContext,
  artifacts: { vault: Artifact; token: Artifact },
  decimals: number,
  feeBps = 0n,
): Promise<Deployment> {
  const tokenAddress = await deployArtifact(chain, chain.deployer, artifacts.token, [
    decimals,
    feeBps,
    chain.deployer.address,
  ]);
  const token = new MockIMD(chain, tokenAddress, decimals, artifacts.token.abi);
  const vaultAddress = await deployArtifact(chain, chain.deployer, artifacts.vault, [
    tokenAddress,
    BigInt(CONFIG.minPixels),
  ]);
  const vault = new Vault(chain, vaultAddress);
  return { vault, token, vaultArtifact: artifacts.vault, tokenArtifact: artifacts.token };
}

/** Mint, approve and deposit enough for `pixels` at PRICE (plus headroom). */
export async function fundPainter(
  deployment: Deployment,
  wallet: Wallet,
  pixels: number,
): Promise<void> {
  const { vault, token } = deployment;
  const price = await vault.price();
  const needed = price * BigInt(pixels) * 2n;
  const mintAmount = needed > 10n * tokenUnits(token.decimals) ? needed : 10n * tokenUnits(token.decimals);
  await token.mint(deployment.vault.chain.deployer, wallet.address, mintAmount);
  await token.approve(wallet, vault.address, mintAmount);
  await vault.deposit(wallet, needed);
}

/** Range of pixel ids in distinct storage slots: 0, 32, 64, ... */
export function distinctSlotIds(count: number, offset = 0): number[] {
  return Array.from({ length: count }, (_, i) => (offset + i) * 32);
}

/** Current latest block timestamp (seconds). */
export async function latestTimestamp(chain: ChainContext): Promise<number> {
  const block = await chain.publicClient.getBlock({ blockTag: "latest" });
  return Number(block.timestamp);
}

/** Move the chain to an exact timestamp and mine one block. */
export async function warpTo(chain: ChainContext, timestamp: number): Promise<void> {
  const now = await latestTimestamp(chain);
  const delta = timestamp - now;
  if (delta > 0) await chain.testClient.increaseTime({ seconds: delta });
  await chain.testClient.mine({ blocks: 1 });
}

export function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** Read an ERC20 field through the app's own ABI (not the mock's ABI). */
export async function readErc20ThroughAppAbi(
  chain: ChainContext,
  token: Address,
  functionName: string,
  args: readonly unknown[],
): Promise<bigint | number | boolean> {
  return (await chain.publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName,
    args,
  })) as bigint | number | boolean;
}
