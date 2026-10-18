# PixelFun contract review

Scope: `identity-md-launches/launch-2148-dsa` at commit `e880bd5`
(`src/PixelFun.sol`, solc 0.8.26, optimizer 200, OZ vendored in `lib/`).
Read-only review: no contract source was modified, nothing was deployed to a
real network, and no real keys were used.

Method:

- Read `README.md`, `launch.json`, `foundry.toml` and `src/PixelFun.sol` line by line.
- `forge test` in the contract repo: **57 tests passed, 0 failed** (including a
  256-run board invariant, 24,576 calls, 0 reverts).
- Ran the real compiled artifact on local Anvil with a mock IMD at 18 and 6
  decimals (`npm run e2e:local`, 302 checks). Results quoted below are measured,
  not estimated.
- Measured paint gas with a full top-66 board and distinct storage slots
  (`GAS.md`).

## Findings

### HIGH — "Burned" is a transfer to `0x…dEaD`, not a token burn

**Lines 11-14, 28, 138, 156.** `paint` increments `totalBurned` by the full cost
and calls `imd.safeTransfer(BURN_ADDRESS, cost)`. No ERC-20 `burn` is called, so
the token's `totalSupply()` does not fall and the tokens are locked at the dead
address. If IMD is a bridged token, that may be the only safe action (the
README explains why), but "burned" and the site copy "destroyed by painting" are
not literally true.

With a fee-on-transfer token the discrepancy becomes numeric: the dead address
receives less than `totalBurned` while `totalBurned` still grows by `cost`.
The local e2e uses a 1% fee token and confirms `deposit` credits the post-fee
amount; the same fee would apply to the transfer to `0x…dEaD`.

Impact: the headline "IMD burned" stat is contract accounting, not token supply.
Recommendation: verify IMD's transfer semantics and, if it is not a burn, word
the UI as "sent to the dead address"; if the token has a transfer fee, display
the dead address's actual balance instead of `totalBurned`.

### HIGH — A wrong or incompatible IMD token bricks the ownerless contract

**Lines 77-82, 91-95, 156.** The constructor does not require `imd_` to have
code and does not read `decimals()`. The first `deposit`/`paint` reads
`decimals()` and reverts with `UnsupportedDecimals` when it is `< 3` or `> 77`.
If the launch address is an EOA, a proxy that is not initialized, a token whose
`decimals()` reverts, or a token that blocks transfers to `0x…dEaD`, every
deposit and paint reverts forever. There is no owner, pause or rescue path.

The local e2e deploys a 2-decimal mock and confirms `PRICE()` reverts with
`UnsupportedDecimals` before any transaction. That is correct validation, but it
is unrecoverable after launch.

Impact: one bad constructor argument or one blacklist rule makes the vault and
canvas permanently unusable. Recommendation: before announcing, run a tiny
real deposit + 1-pixel paint against the deployed IMD (the repo's `npm run smoke`
plus a manual paint), and verify the token's dead-address transfer is allowed.

### HIGH — Duplicate ids let one pixel buy whitelist eligibility

**Lines 140-154.** Each array element is charged, counted in
`totalPixelsPainted`, and added to `pixelsPaintedIn`, even when several elements
share an id; the loop writes the last color. The README documents "duplicates
allowed (last wins, all paid/counted)", and the e2e confirms three copies of id
100 increase the count by 3 and burn three prices.

Consequence: 20 paints of the same pixel (0.1 IMD) reach `MIN_PIXELS = 20` and
put the address on the top-66 board without adding 20 distinct pixels. The board
therefore measures spend/calls, not distinct canvas coverage. This may be
intended, but it is a whitelist-fairness risk.

Recommendation: if distinct coverage is the intent, reject duplicate ids in
`paint`, or keep the frontend's de-duplicating draft (it already uses a Map, so
the shipped UI never sends duplicates) and document the direct-call behavior.

### MEDIUM — README's O(1) claim is slightly stronger than the code

**Lines 165-190, 192-202.** Displacing a newcomer and rejecting one are O(1)
(one cached-min read). But:

- Adding any newcomer while the board is not full rescans all entries
  (`_findMin` at line 180), even when the new count cannot be the minimum.
- Updating an existing member at the cached minimum rescans (line 172), even if
  their increased count still leaves them the minimum.

The scan is bounded at 66 SLOADs and the README acknowledges rescans when the
minimum can change, but "only when it can change" is not exact. Gas only, no
correctness impact: measured 2,712,676 gas for 100 distinct-slot pixels with a
full board, below the README's 3.5M claim.

### MEDIUM — "Frozen" past boards depend on monotonic timestamps

**Lines 151, 224-226.** A paint's epoch is `(block.timestamp - EPOCH_START) /
3 days`. Once that value increases, normal EVM timestamp monotonicity prevents a
return to an older epoch, so finished boards are frozen. The README itself
warns that a sequencer can nudge timestamps near boundaries. If an L2 could
produce a block with a timestamp earlier than a previous block, a late paint
could mutate a board that already reports `epochEnded = true`.

Impact: unlikely on a standard OP-stack-style chain, but the "frozen" guarantee
is only as strong as the chain's timestamp monotonicity. Recommendation: confirm
the sequencer's timestamp rule, or derive epochs from a monotonic counter.

### LOW — Overflow edge cases revert with a panic, not `BadRange`

**Lines 228-234, 278.** `epochStart`/`epochEnd` multiply `epoch * EPOCH_LENGTH`
with checked arithmetic; an absurd `epoch` reverts with a panic. In `getPixels`,
`startSlot + slotCount` can overflow before the `> SLOT_COUNT` comparison,
turning a malformed range into a panic instead of `BadRange`. Both are
unreachable through the app (`epoch` comes from `currentEpoch`, slots from
8192) and cost only a different error selector. No action required for launch.

### LOW — Fee-on-transfer surplus and "withdrawals always work"

**Lines 106-125, 156.** `deposit` correctly credits the received balance, so a
fee-on-transfer token is handled on deposit. But the fee stays in the contract
as unowned surplus, and `paint`'s accounting can make `totalBurned` exceed the
dead address's balance. `withdraw` is only as reliable as the token's transfer;
a token that blacklists the vault or freezes transfers would make the README's
"withdrawals always work" false. For a standard, non-fee, non-blacklisting IMD
this is moot; verify the token before launch.

### LOW — Cached price never refreshes

**Lines 36-37, 97-103.** `_cachedPrice` is written on the first successful
`deposit`/`paint`. If the token's `decimals()` later changes (upgradeable
proxy), `PRICE()` keeps the old value. The constructor deliberately does not
call out, so the cache is a first-use snapshot, not a deploy-time constant.
Not a practical issue for an immutable bridged token; worth noting because the
site computes `5 * 10^(decimals-3)` as a fallback and could disagree with a
stale cache.

### LOW — Unbounded per-epoch storage

**Lines 43, 56-58.** `pixelsPaintedIn`, `_boards` and `_boardIndex` grow with
every epoch that has painters. Nothing is deleted; past boards are intentionally
retained for whitelist proofs. Storage cost is paid by painters (first 66
entries per epoch) and there is no loop over epochs, so this is state growth,
not a denial-of-service vector.

### LOW — Other observations

- **Lines 167 vs 185:** `_seq` increments for a newcomer who is then rejected.
  Harmless gap in the sequence; tie ordering is unaffected.
- **Lines 140-147:** validation happens inside the loop after the balance is
  debited; a revert undoes all of it, so this is atomic, not a partial charge.
- **Lines 150-157:** `paint` updates state before the external transfer and is
  `nonReentrant`; `deposit`/`withdraw` use the same pattern. CEI and the guard
  are correct.
- **Line 152:** `pixelsPaintedIn + uint32(n)` is checked arithmetic; a `uint32`
  overflow reverts rather than wrapping (documented in the README).
- **Lines 271-274:** `pixelAt` casts the shifted word to `uint8`, which truncates
  to the low byte and matches `getPixels`; verified byte-for-byte on Anvil.
- **Lines 277-286:** the `memory-safe` assembly writes exactly 32 bytes per slot
  into a freshly allocated `bytes`; no out-of-bounds write. Confirmed with 8
  chunked reads of 1024 slots.
- **Event (line 65):** emitting the full `ids`/`colors` arrays makes each paint
  log a few KB; fine for 100 pixels, but an indexer should decode arrays rather
  than assume one event per pixel.
- **No ERC-20 rescue and no `receive`:** ERC-20s other than IMD sent to the
  contract are stuck; ETH transfers revert. Expected for an ownerless contract,
  but worth telling users.

## README consistency check

| README claim | Result |
| --- | --- |
| `PRICE = 5 * 10**(decimals-3)`, readable view | True; 18-dec `5e15`, 6-dec `5000` measured on fresh deployments |
| 32 pixels per slot, `id%32` at that byte from the MSB end | True; ids 0/31/32/511/512/262143 decoded correctly, all other bytes zero |
| 1..100 items, duplicates allowed, last wins, all paid | True; 3 duplicate ids increased count by 3 and burned 3× |
| Entry needs `>= MIN_PIXELS`; strict-greater displacement; ties earlier-first | True; equal-count newcomer rejected, 21 displaced 20, earlier reach ranked first |
| `getBoard` sorted descending, past boards frozen | Sorting true; frozen true under monotonic timestamps (see MEDIUM) |
| Updating a member/rejecting a newcomer is O(1); rescans only when the minimum can change | Mostly true; rescans also happen on non-full admissions and min self-updates (bounded, gas only) |
| `withdraw` returns unspent balance, "always available" | True for a standard token; overclaims for blacklisting/freezing tokens |
| Burned immediately / transfer to `0x…dEaD` / `totalBurned = PRICE * totalPixelsPainted` | Transfer true; accounting true; it is not a token-supply burn |
| "works for any ERC-20" | False for tokens that block the dead address or charge a transfer fee |
| 100 distinct-slot pixels with a full board < 3.5M gas | True; measured 2,712,676 |
| Constructor makes no external calls | True |
| Decimals read/validated on first deposit/paint | True; `PRICE()` also reads `decimals()` (view) before that |
| No owner, admin, pause or upgrade | True from the source surface |
| `MAX_READ_SLOTS = 1024`, 8 calls for the canvas | True; 1025-slot reads revert `BadRange` |

## Verified properties (local Anvil, real artifact)

- Fresh deploy: `PRICE()`, `totalBurned`, `totalDeposited`, `totalPixelsPainted`
  all readable before the first transaction; `PRICE` equals the formula.
- Vault: approve + deposit credits exactly; fee-on-transfer deposit credits the
  post-fee amount; withdraw returns only unspent balance; over-withdraw reverts.
- Burn: `totalBurned == PRICE × pixels`; the dead address receives exactly that
  amount for the non-fee mock; 1% fee token would under-deliver (analysis).
- Packing: every pixel of the full 262,144-byte canvas read back through
  `getPixels` in 8 calls; ids and colors match, byte order correct.
- Live path: `Painted` logs decoded through the app's `PAINTED_EVENT`, replayed
  with the app's `applyPaint`, and compared byte-for-byte with chain state.
- Reverts: bad id, bad color, empty batch, batch > 100, length mismatch,
  insufficient balance, zero deposit/withdraw, unreadable decimals.
- Board: fill 66, sorted descending, equal count rejected, greater count
  displaces, tie order earlier-first, `isWhitelisted` agrees, app-computed
  "pixels needed" enters with exactly that many pixels.
- Epochs: current epoch 0 at deployment; still 0 one second before the end;
  next epoch at the exact end; old board unchanged; new board empty; CSV export
  unlocked only for an ended, non-empty board.
- Gas: 1 px 116,251; 25 px 897,949; 50 px 1,502,813; 100 px 2,712,676
  (full board, distinct slots; 25/50/100 include displacement + rescan).

## Not covered

- No adversarial audit, no mainnet fork, and no real IMD token. Blacklist,
  pause/upgrade, transfer-fee and dead-address-blocking behavior are reasoned
  from ERC-20 semantics, not observed on Robinhood Chain.
- Sequencer timestamp behavior near epoch boundaries is not tested.
- Front-running and MEV around paint are out of scope; the design is
  last-write-wins and pays per paint, so this is expected.
