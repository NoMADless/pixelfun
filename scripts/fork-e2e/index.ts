/**
 * Real-token fork suite: Anvil replays Robinhood Chain state, but every
 * transaction stays on the local fork. No private keys and no real transactions.
 *
 * Usage:
 *   ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com npm run e2e:fork
 *
 * Optional:
 *   IMD_HOLDER=0x...          pick a specific funded EOA
 *   ANVIL_BIN=/path/to/anvil  when Foundry is not on PATH
 */
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  http,
  parseAbi,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import { Checker } from "../local-e2e/assert";
import { startAnvil } from "../local-e2e/anvil";
import { loadVaultArtifact } from "../local-e2e/artifacts";
import {
  createChainContext,
  deployArtifact,
  distinctSlotIds,
  Vault,
  waitFor,
  warpTo,
  type ChainContext,
  type Wallet,
} from "../local-e2e/chain";
import { CONFIG } from "../local-e2e/config";
import { PAINTED_EVENT } from "../../src/lib/contract";

const DEAD = "0x000000000000000000000000000000000000dEaD" as Address;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

const EIP1967_IMPLEMENTATION =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as Hex;
const EIP1967_ADMIN =
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103" as Hex;
const EIP1967_BEACON =
  "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50" as Hex;

const IMD_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
  "function owner() view returns (address)",
  "function blocked(address) view returns (bool)",
  "function setBlocked(address,bool)",
  "function transfersEnabled() view returns (bool)",
  "function enableTransfers()",
  "function token() view returns (address)",
  "function endpoint() view returns (address)",
  "function sharedDecimals() view returns (uint8)",
  "function decimalConversionRate() view returns (uint256)",
  "function oftVersion() view returns (bytes4,uint64)",
]);

/**
 * Publicly visible IMD EOAs used as funding sources. The suite verifies the
 * balance and code size on the fork before using one, and IMD_HOLDER overrides
 * the list. The first entry was the largest codeless holder at the time of
 * writing; the others are fallbacks.
 */
const KNOWN_HOLDERS: Address[] = [
  "0xFB75AE12c96225d8fA17883CEE9c7B1a26b646A1",
  "0xa6A0e32744459dc0E54E2abF87390e3Bf8bDE674",
  "0x5869458f360D8C1CE49e35fCcb3d0A1F25E8d533",
  "0x66c638d85c266d860279aa497a569a6Bb132109D",
];

function envAddress(key: string): Address | null {
  const value = process.env[key]?.trim();
  return value ? (value as Address) : null;
}

function short(value: bigint | number | string): string {
  return typeof value === "bigint" ? value.toString() : String(value);
}

class RealImd {
  constructor(
    readonly chain: ChainContext,
    readonly address: Address,
  ) {}

  read<T>(functionName: string, args: readonly unknown[] = []): Promise<T> {
    return this.chain.publicClient.readContract({
      address: this.address,
      abi: IMD_ABI,
      functionName: functionName as never,
      args: args as never,
    }) as Promise<T>;
  }

  balanceOf(account: Address): Promise<bigint> {
    return this.read("balanceOf", [account]);
  }

  totalSupply(): Promise<bigint> {
    return this.read("totalSupply");
  }

  owner(): Promise<Address> {
    return this.read("owner");
  }

  blocked(account: Address): Promise<boolean> {
    return this.read("blocked", [account]);
  }

  async approve(wallet: Wallet, spender: Address, amount: bigint): Promise<void> {
    const client = this.chain.walletClient(wallet);
    const hash = await client.writeContract({
      address: this.address,
      abi: IMD_ABI,
      functionName: "approve",
      args: [spender, amount],
      account: client.account!,
      chain: this.chain.chain,
    });
    await waitFor(this.chain.publicClient, hash);
  }

  /** Send as a wallet or as an impersonated address on the fork. */
  async sendAs(
    from: Address,
    functionName: "transfer" | "setBlocked" | "enableTransfers",
    args: readonly unknown[],
  ): Promise<TransactionReceipt> {
    const client = createWalletClient({
      account: from,
      chain: this.chain.chain,
      transport: http(this.chain.url, { timeout: 120_000 }),
    });
    const hash = await client.writeContract({
      address: this.address,
      abi: IMD_ABI,
      functionName: functionName as never,
      args: args as never,
      account: from,
      chain: this.chain.chain,
    });
    return waitFor(this.chain.publicClient, hash);
  }
}

async function pickHolder(
  client: PublicClient,
  imd: RealImd,
  check: Checker,
): Promise<Address> {
  const override = envAddress("IMD_HOLDER");
  const candidates = override ? [override] : KNOWN_HOLDERS;
  for (const candidate of candidates) {
    const [code, balance, blocked] = await Promise.all([
      client.getBytecode({ address: candidate }),
      imd.balanceOf(candidate),
      imd.blocked(candidate),
    ]);
    const codeless = !code || code === "0x";
    check.check(
      `holder ${candidate} is usable`,
      codeless && balance >= 2n * 10n ** 18n && !blocked,
      `code ${code ? (code.length - 2) / 2 : 0} bytes, balance ${short(balance)}, blocked ${blocked}`,
    );
    if (codeless && balance >= 2n * 10n ** 18n && !blocked) return candidate;
  }
  throw new Error(
    "No usable IMD holder found. Set IMD_HOLDER to a funded EOA on Robinhood Chain.",
  );
}

async function main(): Promise<void> {
  const rpcUrl = process.env.ROBINHOOD_RPC_URL?.trim();
  if (!rpcUrl) {
    console.log(
      "SKIP e2e:fork — ROBINHOOD_RPC_URL is not set. Set it to the Robinhood Chain RPC to run the real-token fork suite.",
    );
    return;
  }

  const token = (process.env.IMD_ADDRESS?.trim() || CONFIG.forkToken) as Address;
  console.log("PixelFun real-token fork test (Anvil fork; no real transactions)");
  console.log(`rpc: ${rpcUrl}`);
  console.log(`IMD: ${token}`);

  const check = new Checker();

  // ---- 1. Read-only network and token inspection, before starting Anvil. ----
  check.section("network and IMD read-only");
  const probe = createPublicClient({
    transport: http(rpcUrl, { timeout: 60_000 }),
  });
  const liveChainId = await probe.getChainId();
  check.equal("Robinhood Chain chainId", liveChainId, CONFIG.forkChainId);
  const liveBlock = await probe.getBlockNumber();
  check.check("RPC returns a block number", liveBlock > 0n, liveBlock.toString());

  const code = await probe.getBytecode({ address: token });
  check.check(
    "IMD address has contract code",
    Boolean(code && code !== "0x"),
    `${code ? (code.length - 2) / 2 : 0} bytes`,
  );

  const liveImd = {
    name: (await probe.readContract({ address: token, abi: IMD_ABI, functionName: "name" })) as string,
    symbol: (await probe.readContract({ address: token, abi: IMD_ABI, functionName: "symbol" })) as string,
    decimals: Number(
      await probe.readContract({ address: token, abi: IMD_ABI, functionName: "decimals" }),
    ),
    totalSupply: (await probe.readContract({
      address: token,
      abi: IMD_ABI,
      functionName: "totalSupply",
    })) as bigint,
    owner: (await probe.readContract({
      address: token,
      abi: IMD_ABI,
      functionName: "owner",
    })) as Address,
    transfersEnabled: (await probe.readContract({
      address: token,
      abi: IMD_ABI,
      functionName: "transfersEnabled",
    })) as boolean,
    token: (await probe.readContract({
      address: token,
      abi: IMD_ABI,
      functionName: "token",
    })) as Address,
    endpoint: (await probe.readContract({
      address: token,
      abi: IMD_ABI,
      functionName: "endpoint",
    })) as Address,
    sharedDecimals: Number(
      await probe.readContract({
        address: token,
        abi: IMD_ABI,
        functionName: "sharedDecimals",
      }),
    ),
    conversionRate: (await probe.readContract({
      address: token,
      abi: IMD_ABI,
      functionName: "decimalConversionRate",
    })) as bigint,
  };

  check.equal("name", liveImd.name, "Identity.md");
  check.equal("symbol", liveImd.symbol, "IMD");
  check.equal("decimals", liveImd.decimals, 18);
  check.check("totalSupply > 0", liveImd.totalSupply > 0n, short(liveImd.totalSupply));
  check.equal("transfersEnabled", liveImd.transfersEnabled, true);
  check.check("token() points at itself", liveImd.token.toLowerCase() === token.toLowerCase(), liveImd.token);
  check.check("LayerZero endpoint is set", liveImd.endpoint !== ZERO, liveImd.endpoint);
  check.equal("OFT sharedDecimals", liveImd.sharedDecimals, 6);
  check.equal(
    "OFT decimalConversionRate",
    liveImd.conversionRate,
    10n ** BigInt(liveImd.decimals - liveImd.sharedDecimals),
  );

  const ownerCode = await probe.getBytecode({ address: liveImd.owner });
  check.check(
    "owner is an EOA, not a contract",
    !ownerCode || ownerCode === "0x",
    `${liveImd.owner} (${ownerCode ? (ownerCode.length - 2) / 2 : 0} code bytes)`,
  );

  const [impl, admin, beacon] = await Promise.all([
    probe.getStorageAt({ address: token, slot: EIP1967_IMPLEMENTATION }),
    probe.getStorageAt({ address: token, slot: EIP1967_ADMIN }),
    probe.getStorageAt({ address: token, slot: EIP1967_BEACON }),
  ]);
  check.check("not an EIP-1967 proxy (implementation slot empty)", impl === `0x${"0".repeat(64)}`, impl);
  check.check("not an EIP-1967 proxy (admin slot empty)", admin === `0x${"0".repeat(64)}`, admin);
  check.check("not an EIP-1967 proxy (beacon slot empty)", beacon === `0x${"0".repeat(64)}`, beacon);

  const setBlockedData = encodeFunctionData({
    abi: IMD_ABI,
    functionName: "setBlocked",
    args: [DEAD, true],
  });
  let ownerCanBlock = false;
  let strangerCannotBlock = false;
  try {
    await probe.call({ account: liveImd.owner, to: token, data: setBlockedData });
    ownerCanBlock = true;
  } catch {
    ownerCanBlock = false;
  }
  try {
    await probe.call({
      account: "0x2222222222222222222222222222222222222222",
      to: token,
      data: setBlockedData,
    });
  } catch {
    strangerCannotBlock = true;
  }
  check.check("setBlocked is callable by the owner", ownerCanBlock);
  check.check("setBlocked rejects non-owners", strangerCannotBlock);
  check.equal("dead address is not blocked today", await probe.readContract({
    address: token,
    abi: IMD_ABI,
    functionName: "blocked",
    args: [DEAD],
  }), false);

  const hasBurnSelector = Boolean(code?.includes("42966c68"));
  const hasMintSelector = Boolean(code?.includes("40c10f19"));
  check.check("no public burn(uint256) selector in bytecode", !hasBurnSelector);
  check.check("no public mint(address,uint256) selector in bytecode", !hasMintSelector);

  // ---- 2. Fork Anvil at the current block. ----
  const anvil = await startAnvil({
    forkUrl: rpcUrl,
    chainId: CONFIG.forkChainId,
    accounts: 10,
  });
  try {
    const chain = createChainContext(anvil.url, CONFIG.forkChainId);
    const imd = new RealImd(chain, token);
    const forkedBlock = await chain.publicClient.getBlockNumber();
    check.section("fork state");
    check.equal("fork chainId", await chain.publicClient.getChainId(), CONFIG.forkChainId);
    check.check(
      "fork block is at or after the live tip",
      forkedBlock >= liveBlock,
      forkedBlock.toString(),
    );
    check.equal(
      "IMD code is present on the fork",
      Boolean(await chain.publicClient.getBytecode({ address: token })),
      true,
    );

    const holder = await pickHolder(chain.publicClient, imd, check);
    console.log(`IMD holder: ${holder}`);

    // Fund the holder with gas, impersonate it, and move IMD to an Anvil wallet.
    await chain.testClient.setBalance({ address: holder, value: 10n ** 19n });
    await chain.testClient.impersonateAccount({ address: holder });
    const painter = chain.wallets[1];
    const holderBefore = await imd.balanceOf(holder);
    const painterBefore = await imd.balanceOf(painter.address);
    const funding = 2n * 10n ** 18n;
    await imd.sendAs(holder, "transfer", [painter.address, funding]);
    const holderAfter = await imd.balanceOf(holder);
    const painterAfter = await imd.balanceOf(painter.address);
    check.equal("holder debit is exact (no transfer fee)", holderBefore - holderAfter, funding);
    check.equal("painter credit is exact (no transfer fee)", painterAfter - painterBefore, funding);
    await chain.testClient.stopImpersonatingAccount({ address: holder });

    // ---- 3. Deploy the real PixelFun with the real token. ----
    check.section("deployment against real IMD");
    const vaultArtifact = loadVaultArtifact();
    const vaultAddress = await deployArtifact(chain, chain.deployer, vaultArtifact, [
      token,
      BigInt(CONFIG.minPixels),
    ]);
    const vault = new Vault(chain, vaultAddress);
    console.log(`PixelFun deployed at ${vaultAddress}`);

    const price = await vault.price();
    const expectedPrice = 5n * 10n ** 15n;
    check.equal("PRICE() on a fresh deployment", price, expectedPrice);
    check.check("PRICE() equals 0.005 IMD", price === 5000000000000000n, short(price));
    check.equal("MIN_PIXELS", await vault.minPixels(), BigInt(CONFIG.minPixels));
    check.equal("MAX_BATCH", await vault.maxBatch(), 100n);
    check.equal("BURN_ADDRESS", (await vault.burnAddress()).toLowerCase(), DEAD.toLowerCase());
    check.equal("EPOCH_LENGTH", await vault.epochLength(), 259_200n);
    check.equal("currentEpoch at deployment", await vault.currentEpoch(), 0n);
    check.equal("totalPixelsPainted at deployment", await vault.totalPixelsPainted(), 0n);
    check.equal("totalBurned at deployment", await vault.totalBurned(), 0n);
    check.equal("totalDeposited at deployment", await vault.totalDeposited(), 0n);
    check.equal("vault token balance at deployment", await imd.balanceOf(vaultAddress), 0n);
    check.equal("vault blocked at deployment", await imd.blocked(vaultAddress), false);
    check.equal("dead blocked at deployment", await imd.blocked(DEAD), false);

    // ---- 4. Approve + deposit, with an exact accounting check. ----
    check.section("approve, deposit and vault accounting");
    const depositAmount = price * 200n; // 1 IMD, enough for 200 pixels
    await imd.approve(painter, vaultAddress, depositAmount);
    check.equal(
      "allowance after approve",
      (await chain.publicClient.readContract({
        address: token,
        abi: IMD_ABI,
        functionName: "allowance",
        args: [painter.address, vaultAddress],
      })) as bigint,
      depositAmount,
    );

    const painterBeforeDeposit = await imd.balanceOf(painter.address);
    const vaultBeforeDeposit = await imd.balanceOf(vaultAddress);
    const depositReceipt = await vault.deposit(painter, depositAmount);
    const painterAfterDeposit = await imd.balanceOf(painter.address);
    const vaultAfterDeposit = await imd.balanceOf(vaultAddress);
    check.check("deposit transaction succeeded", depositReceipt.status === "success");
    check.equal("painter debit on deposit", painterBeforeDeposit - painterAfterDeposit, depositAmount);
    check.equal("vault token credit on deposit", vaultAfterDeposit - vaultBeforeDeposit, depositAmount);
    check.equal("vault ledger credit on deposit", await vault.balanceOf(painter.address), depositAmount);
    check.equal("totalDeposited", await vault.totalDeposited(), depositAmount);
    check.equal(
      "no fee-on-transfer: credited == received",
      await vault.balanceOf(painter.address),
      vaultAfterDeposit - vaultBeforeDeposit,
    );

    // ---- 5. Paint 1, 25 and 100 pixels; track gas, dead balance and supply. ----
    check.section("paint 1, 25 and 100 pixels");
    const supplyAtStart = await imd.totalSupply();
    const deadAtStart = await imd.balanceOf(DEAD);
    const gasRows: Array<{ pixels: number; gasUsed: bigint }> = [];

    async function paintAndCheck(
      label: string,
      ids: number[],
      colors: number[],
      paintedBefore: bigint,
    ): Promise<bigint> {
      const deadBefore = await imd.balanceOf(DEAD);
      const supplyBefore = await imd.totalSupply();
      const vaultLedgerBefore = await vault.balanceOf(painter.address);
      const burnedBefore = await vault.totalBurned();
      const receipt = await vault.paint(painter, ids, colors);
      const deadAfter = await imd.balanceOf(DEAD);
      const supplyAfter = await imd.totalSupply();
      const vaultLedgerAfter = await vault.balanceOf(painter.address);
      const expectedCost = price * BigInt(ids.length);

      check.check(`${label}: transaction succeeded`, receipt.status === "success");
      check.equal(`${label}: dead address delta == PRICE x pixels`, deadAfter - deadBefore, expectedCost);
      check.equal(`${label}: token totalSupply unchanged`, supplyAfter, supplyBefore);
      check.equal(`${label}: vault ledger debit == cost`, vaultLedgerBefore - vaultLedgerAfter, expectedCost);
      check.equal(
        `${label}: totalPixelsPainted`,
        await vault.totalPixelsPainted(),
        paintedBefore + BigInt(ids.length),
      );
      check.equal(
        `${label}: totalBurned increment == cost`,
        (await vault.totalBurned()) - burnedBefore,
        expectedCost,
      );
      check.check(`${label}: gas used > 0`, receipt.gasUsed > 0n, `${receipt.gasUsed}`);
      gasRows.push({ pixels: ids.length, gasUsed: receipt.gasUsed });

      // The app's own event decoder must replay the same ids/colors.
      const paintedLog = receipt.logs
        .map((log) => {
          try {
            return decodeEventLog({ abi: [PAINTED_EVENT], data: log.data, topics: log.topics });
          } catch {
            return null;
          }
        })
        .find((event) => event?.eventName === "Painted");
      check.check(`${label}: Painted event present`, Boolean(paintedLog));
      if (paintedLog && paintedLog.eventName === "Painted") {
        const args = paintedLog.args as { ids?: readonly number[]; colors?: readonly number[] };
        check.equal(`${label}: event ids match`, (args.ids ?? []).join(","), ids.join(","));
        check.equal(`${label}: event colors match`, (args.colors ?? []).join(","), colors.join(","));
      }
      check.equal(`${label}: pixelAt(first id)`, await vault.pixelAt(BigInt(ids[0])), colors[0] + 1);
      return deadAfter;
    }

    await paintAndCheck("1 px", [0], [7], 0n);
    await paintAndCheck("25 px", distinctSlotIds(25, 1), Array.from({ length: 25 }, () => 12), 1n);
    await paintAndCheck(
      "100 px",
      distinctSlotIds(100, 100),
      Array.from({ length: 100 }, () => 20),
      26n,
    );

    const deadAfterPaints = await imd.balanceOf(DEAD);
    check.equal(
      "dead address received exactly 126 x PRICE",
      deadAfterPaints - deadAtStart,
      price * 126n,
    );
    check.equal("totalPixelsPainted after 126", await vault.totalPixelsPainted(), 126n);
    check.equal("totalBurned after 126", await vault.totalBurned(), price * 126n);
    check.equal("vault balance after 126", await vault.balanceOf(painter.address), depositAmount - price * 126n);
    check.equal("token supply still unchanged after paints", await imd.totalSupply(), supplyAtStart);
    check.equal("dead address is still not blocked", await imd.blocked(DEAD), false);

    // ---- 6. Withdraw only the unspent balance. ----
    check.section("withdraw unspent balance");
    const remaining = await vault.balanceOf(painter.address);
    const walletBeforeWithdraw = await imd.balanceOf(painter.address);
    const vaultTokenBeforeWithdraw = await imd.balanceOf(vaultAddress);
    await vault.withdraw(painter, remaining);
    check.equal("vault ledger after withdraw", await vault.balanceOf(painter.address), 0n);
    check.equal(
      "wallet credit after withdraw",
      (await imd.balanceOf(painter.address)) - walletBeforeWithdraw,
      remaining,
    );
    check.equal(
      "vault token debit after withdraw",
      vaultTokenBeforeWithdraw - (await imd.balanceOf(vaultAddress)),
      remaining,
    );
    check.equal("vault token balance after withdraw", await imd.balanceOf(vaultAddress), 0n);
    await check.expectRevert("withdraw more than the balance reverts", () =>
      vault.withdraw(painter, 1n),
    );

    // ---- 7. Epoch boundary against the real token. ----
    check.section("epoch boundary");
    const epochZeroEnd = await vault.epochEnd(0n);
    await warpTo(chain, Number(epochZeroEnd));
    check.equal("currentEpoch after boundary", await vault.currentEpoch(), 1n);
    check.equal("epochEnded(0)", await vault.epochEnded(0n), true);
    check.equal("pixelsPaintedIn(0) for painter", await vault.pixelsPaintedIn(0n, painter.address), 126);
    check.equal("isWhitelisted(0) for painter", await vault.isWhitelisted(0n, painter.address), true);
    const epochZeroBoard = await vault.getBoard(0n);
    check.check(
      "epoch 0 board holds the painter",
      epochZeroBoard.painters.some((address) => address.toLowerCase() === painter.address.toLowerCase()),
      `${epochZeroBoard.painters.length} entries`,
    );

    const epochOneDeposit = price * 20n;
    await imd.approve(painter, vaultAddress, epochOneDeposit);
    await vault.deposit(painter, epochOneDeposit);
    const deadBeforeEpochOne = await imd.balanceOf(DEAD);
    await vault.paint(painter, [1], [3]);
    check.equal(
      "dead delta in epoch 1",
      (await imd.balanceOf(DEAD)) - deadBeforeEpochOne,
      price,
    );
    check.equal("pixelsPaintedIn(1) for painter", await vault.pixelsPaintedIn(1n, painter.address), 1);
    check.equal("isWhitelisted(1) below MIN_PIXELS", await vault.isWhitelisted(1n, painter.address), false);
    check.equal("epoch 0 board is frozen", (await vault.getBoard(0n)).counts.join(","), epochZeroBoard.counts.join(","));
    check.equal("epoch 1 board is empty", (await vault.getBoard(1n)).painters.length, 0);
    await vault.withdraw(painter, await vault.balanceOf(painter.address));

    // ---- 8. Token admin powers, exercised only on the fork. ----
    check.section("IMD admin powers on the fork");
    const owner = await imd.owner();
    check.check("owner is non-zero", owner !== ZERO, owner);
    check.equal("owner equals the live owner", owner.toLowerCase(), liveImd.owner.toLowerCase());
    await chain.testClient.setBalance({ address: owner, value: 10n ** 18n });
    await chain.testClient.impersonateAccount({ address: owner });

    await imd.sendAs(owner, "setBlocked", [vaultAddress, true]);
    check.equal("owner can block the vault", await imd.blocked(vaultAddress), true);
    await check.expectRevert("deposit while the vault is blocked", async () => {
      await imd.approve(painter, vaultAddress, price * 2n);
      await vault.deposit(painter, price * 2n);
    });
    check.equal("blocked deposit did not change the vault ledger", await vault.balanceOf(painter.address), 0n);
    await imd.sendAs(owner, "setBlocked", [vaultAddress, false]);
    check.equal("owner can unblock the vault", await imd.blocked(vaultAddress), false);

    await imd.sendAs(owner, "setBlocked", [DEAD, true]);
    check.equal("owner can block the dead address", await imd.blocked(DEAD), true);
    await imd.approve(painter, vaultAddress, price * 2n);
    await vault.deposit(painter, price * 2n);
    const deadBeforeBlockedPaint = await imd.balanceOf(DEAD);
    await check.expectRevert("paint while the dead address is blocked", () =>
      vault.paint(painter, [2], [9]),
    );
    check.equal("blocked paint sent nothing to the dead address", await imd.balanceOf(DEAD), deadBeforeBlockedPaint);
    await imd.sendAs(owner, "setBlocked", [DEAD, false]);
    check.equal("owner can unblock the dead address", await imd.blocked(DEAD), false);
    await vault.paint(painter, [2], [9]);
    check.equal(
      "paint works again after unblocking the dead address",
      (await imd.balanceOf(DEAD)) - deadBeforeBlockedPaint,
      price,
    );

    await imd.sendAs(owner, "setBlocked", [painter.address, true]);
    check.equal("owner can block a painter", await imd.blocked(painter.address), true);
    await check.expectRevert("withdraw while the painter is blocked", () =>
      vault.withdraw(painter, price),
    );
    const deadBeforeBlockedPainter = await imd.balanceOf(DEAD);
    await vault.paint(painter, [3], [4]);
    check.equal(
      "painting still works while the painter is blocked (the transfer is vault -> dead)",
      (await imd.balanceOf(DEAD)) - deadBeforeBlockedPainter,
      price,
    );
    await imd.sendAs(owner, "setBlocked", [painter.address, false]);
    check.equal("owner can unblock a painter", await imd.blocked(painter.address), false);
    await imd.approve(painter, vaultAddress, price);
    await vault.deposit(painter, price);
    await vault.withdraw(painter, price);
    check.equal("painter can withdraw after unblocking", await vault.balanceOf(painter.address), 0n);

    await check.expectRevert("enableTransfers reverts when already enabled", () =>
      imd.sendAs(owner, "enableTransfers", []),
    );
    await check.expectRevert("non-owner cannot call setBlocked", () =>
      imd.sendAs(painter.address, "setBlocked", [DEAD, true]),
    );
    check.equal("setBlocked from a non-owner changed nothing", await imd.blocked(DEAD), false);

    await chain.testClient.stopImpersonatingAccount({ address: owner });

    // ---- 9. Summary and gas table. ----
    console.log("\nGas used (fork, real IMD):");
    for (const row of gasRows) {
      console.log(`  ${row.pixels.toString().padStart(3)} px: ${row.gasUsed} gas`);
    }
    const gasOneHundred = gasRows.find((row) => row.pixels === 100)?.gasUsed ?? 0n;
    check.check(
      "100 px stays below 3,000,000 gas",
      gasOneHundred > 0n && gasOneHundred < 3_000_000n,
      `${gasOneHundred}`,
    );

    console.log(`\n${check.summary()}`);
    if (check.failures > 0) {
      const failed = check.results.filter((result) => !result.ok);
      console.error(`\n${check.failures} failed check(s):`);
      for (const result of failed) {
        console.error(`  - [${result.group}] ${result.label}: ${result.detail}`);
      }
      process.exitCode = 1;
    }
  } finally {
    await anvil.stop();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
