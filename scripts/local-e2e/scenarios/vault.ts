import type { Checker } from "../assert";
import {
  deployFresh,
  formatAmount,
  readErc20ThroughAppAbi,
  tokenUnits,
  type ChainContext,
} from "../chain";
import { priceFromDecimals, resolvePrice } from "../../../src/shared/price";

const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

export async function runVaultScenario(
  chain: ChainContext,
  artifacts: Parameters<typeof deployFresh>[1],
  check: Checker,
  decimals: number,
): Promise<void> {
  check.section(`vault, burn and reverts (${decimals} decimals)`);
  const unit = tokenUnits(decimals);
  const deployment = await deployFresh(chain, artifacts, decimals);
  const { vault, token } = deployment;
  const alice = chain.wallets[2];
  const bob = chain.wallets[3];

  // ---- PRICE on a fresh deployment, before approve/deposit/paint. ----
  const freshPrice = await vault.price();
  const formula = priceFromDecimals(decimals);
  check.check("PRICE readable before any transaction", freshPrice > 0n, freshPrice.toString());
  check.equal("PRICE == 5 * 10^(decimals-3)", freshPrice, formula);
  check.equal("priceFromDecimals matches PRICE", formula, freshPrice);
  check.equal("resolved price source", resolvePrice({ contractPrice: freshPrice }).source, "contract");
  check.equal("totalBurned starts at 0", await vault.totalBurned(), 0n);
  check.equal("totalDeposited starts at 0", await vault.totalDeposited(), 0n);
  check.equal("totalPixelsPainted starts at 0", await vault.totalPixelsPainted(), 0n);
  check.equal("MIN_PIXELS", await vault.minPixels(), 20n);
  check.equal("MAX_BATCH", await vault.maxBatch(), 100n);
  check.equal("BOARD_SIZE", await vault.boardSize(), 66n);
  check.equal("EPOCH_LENGTH", await vault.epochLength(), 259_200n);
  check.check(
    "BURN_ADDRESS is the dead address",
    (await vault.burnAddress()).toLowerCase() === BURN_ADDRESS.toLowerCase(),
  );

  // ---- Approve + deposit credits the exact amount. ----
  const depositAmount = 2n * unit;
  await token.mint(chain.deployer, alice.address, depositAmount);
  check.equal(
    "app ERC20 ABI reads decimals",
    await readErc20ThroughAppAbi(chain, token.address, "decimals", []),
    decimals,
  );
  await token.approve(alice, vault.address, depositAmount);
  check.equal(
    "allowance after approve",
    await readErc20ThroughAppAbi(chain, token.address, "allowance", [
      alice.address,
      vault.address,
    ]),
    depositAmount,
  );
  await vault.deposit(alice, depositAmount);
  check.equal("vault balance credited", await vault.balanceOf(alice.address), depositAmount);
  check.equal("vault holds the IMD", await token.balanceOf(vault.address), depositAmount);
  check.equal("totalDeposited after deposit", await vault.totalDeposited(), depositAmount);
  check.equal("wallet token balance spent", await token.balanceOf(alice.address), 0n);
  check.check(
    "deposit emits credited amount",
    (await vault.totalDeposited()) === depositAmount,
    formatAmount(depositAmount, decimals),
  );

  // ---- Deposit is credited by balance difference (fee-on-transfer safe). ----
  const feeDeployment = await deployFresh(chain, artifacts, decimals, 100n); // 1% fee
  const feeAmount = unit;
  await feeDeployment.token.mint(chain.deployer, bob.address, feeAmount);
  await feeDeployment.token.approve(bob, feeDeployment.vault.address, feeAmount);
  await feeDeployment.vault.deposit(bob, feeAmount);
  const feeCredit = feeAmount - feeAmount / 100n;
  check.equal(
    "fee-on-transfer deposit credits received amount",
    await feeDeployment.vault.balanceOf(bob.address),
    feeCredit,
  );
  check.equal(
    "fee-on-transfer vault holds only the post-fee amount",
    await feeDeployment.token.balanceOf(feeDeployment.vault.address),
    feeCredit,
  );

  // ---- Paint, burn and withdraw only the unspent balance. ----
  const painted = 10;
  const cost = freshPrice * BigInt(painted);
  const ids = Array.from({ length: painted }, (_, i) => i * 3 + 7);
  const colors = ids.map((_, i) => i % 32);
  await vault.paint(alice, ids, colors);
  check.equal("balance spent on paint", await vault.balanceOf(alice.address), depositAmount - cost);
  check.equal("totalBurned after paint", await vault.totalBurned(), cost);
  check.equal("totalPixelsPainted after paint", await vault.totalPixelsPainted(), BigInt(painted));
  check.equal(
    "dead address received exactly the burn",
    await token.balanceOf(BURN_ADDRESS),
    cost,
  );
  check.equal(
    "burn == PRICE x pixels",
    await vault.totalBurned(),
    freshPrice * BigInt(painted),
  );
  check.equal(
    "contract keeps only unspent balance",
    await token.balanceOf(vault.address),
    depositAmount - cost,
  );
  check.equal(
    "totalDeposited equals the unspent vault balance",
    await vault.totalDeposited(),
    depositAmount - cost,
  );

  const unspent = depositAmount - cost;
  await check.expectRevert(
    "withdraw above the unspent balance reverts",
    () => vault.withdraw(alice, unspent + 1n),
    "InsufficientBalance",
  );
  await vault.withdraw(alice, unspent);
  check.equal("vault balance after full withdraw", await vault.balanceOf(alice.address), 0n);
  check.equal("tokens returned to the wallet", await token.balanceOf(alice.address), unspent);
  check.equal("totalDeposited after withdraw", await vault.totalDeposited(), 0n);
  check.equal("Vault token balance after withdraw", await token.balanceOf(vault.address), 0n);
  await check.expectRevert(
    "withdraw with zero unspent balance reverts",
    () => vault.withdraw(alice, 1n),
    "InsufficientBalance",
  );

  // ---- Duplicate ids: all paid/counted, last color wins. ----
  await token.mint(chain.deployer, alice.address, unit);
  await token.approve(alice, vault.address, unit);
  await vault.deposit(alice, unit);
  const beforePainted = await vault.totalPixelsPainted();
  const beforeBurned = await vault.totalBurned();
  await vault.paint(alice, [100, 100, 100], [1, 2, 3]);
  check.equal("duplicate ids all counted", await vault.totalPixelsPainted(), beforePainted + 3n);
  check.equal("duplicate ids all paid", await vault.totalBurned(), beforeBurned + 3n * freshPrice);
  check.equal("duplicate ids last color wins", await vault.pixelAt(100n), 4);

  // ---- Reverts. ----
  await check.expectRevert(
    "bad pixel id reverts",
    () => vault.paint(alice, [262_144], [0]),
    "PixelOutOfBounds",
  );
  await check.expectRevert(
    "bad color reverts",
    () => vault.paint(alice, [0], [32]),
    "ColorOutOfRange",
  );
  await check.expectRevert(
    "empty batch reverts",
    () => vault.paint(alice, [], []),
    "BadBatchSize",
  );
  await check.expectRevert(
    "batch over MAX_BATCH reverts",
    () =>
      vault.paint(
        alice,
        Array.from({ length: 101 }, (_, i) => i),
        Array.from({ length: 101 }, () => 0),
      ),
    "BadBatchSize",
  );
  await check.expectRevert(
    "mismatched array lengths revert",
    () => vault.paint(alice, [0, 1], [0]),
    "LengthMismatch",
  );
  const broke = chain.wallets[4];
  await check.expectRevert(
    "paint without balance reverts",
    () => vault.paint(broke, [0], [0]),
    "InsufficientBalance",
  );
  await check.expectRevert(
    "deposit(0) reverts",
    () => vault.deposit(alice, 0n),
    "ZeroAmount",
  );
  await check.expectRevert(
    "withdraw(0) reverts",
    () => vault.withdraw(alice, 0n),
    "ZeroAmount",
  );

  // ---- PRICE edge: token with < 3 decimals makes PRICE() revert. ----
  const twoDecimals = await deployFresh(chain, artifacts, 2);
  await check.expectRevert(
    "PRICE() reverts for a 2-decimal token",
    () => twoDecimals.vault.price(),
    "UnsupportedDecimals",
  );
  check.equal("priceFromDecimals(2) is null", priceFromDecimals(2), null);
  check.equal(
    "resolvePrice falls back to unavailable",
    resolvePrice({ contractPrice: null, decimals: 2 }).source,
    "unavailable",
  );
  check.equal(
    "resolvePrice uses decimals when PRICE read fails",
    resolvePrice({ contractPrice: null, decimals }).price,
    formula,
  );
  check.equal(
    "resolvePrice rejects a zero contract price",
    resolvePrice({ contractPrice: 0n, decimals }).price,
    formula,
  );
}
