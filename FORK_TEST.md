# PixelFun × real IMD — Robinhood Chain fork test

Run date: **2026-10-18**. This suite replays Robinhood Chain state into a local
Anvil fork, deploys the real `PixelFun` artifact with the **real IMD token**, and
sends transactions only to that fork. No private key, real transaction or contract
source change was used.

| | |
| --- | --- |
| Chain | Robinhood Chain, chain ID **4663** (`0x1237`) |
| RPC | `https://rpc.mainnet.chain.robinhood.com` |
| IMD token | `0x5F7Bb59365ce557C26dbcAa4EE9d39A4b95B7127` |
| Live block at start | `91,614,489` |
| Fork tip | `91,614,538` |
| Deployed PixelFun (fork) | `0xb8357f7f41125d4b24ad052c1b7288bef5c43446` |
| Result | **121/121 checks passed** |

Command:

```bash
ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com npm run e2e:fork
```

`e2e:fork` skips with a clear message when `ROBINHOOD_RPC_URL` is unset. It also
honours `IMD_HOLDER`, `IMD_ADDRESS`, `ANVIL_BIN` and `PIXELFUN_CONTRACT_REPO`.
The holder was an impersonated EOA on the fork, funded with fork-only ETH; the
test moved 2 IMD from it to an Anvil test wallet.

## Verdict

**Contract integration: GO.** The real token and the real `PixelFun(imd, 20)`
artifact work together at 18 decimals: `PRICE()` is exactly `0.005 IMD`, deposits
credit exactly what arrives, 1/25/100-pixel paints pay exactly `PRICE × pixels` to
the dead address, withdrawals return only the unspent balance, and the epoch
boundary behaves correctly.

**Announcement: NO-GO until the token-admin caveat is disclosed and accepted.**
IMD is not ownerless. It is an unverified-source, owner-controlled LayerZero OFT
whose owner is a single EOA. The owner can block an address from receiving IMD.
The fork proves that blocking the vault, the dead address or a user makes deposits,
paints or withdrawals revert. PixelFun's vault has no admin and cannot override the
token. The site now states this plainly; the launch decision must include it.

## Token facts

| Fact | Result | Evidence |
| --- | --- | --- |
| Name / symbol / decimals | `Identity.md` / `IMD` / `18` | `eth_call` |
| Contract code | 15,448 bytes | `eth_getCode` |
| Proxy | **No** — EIP-1967 implementation, admin and beacon slots are all zero | `eth_getStorageAt` |
| Owner | `0x047F606fD5b2BaA5f5C6c4aB8958E45CB6B054B7` — **EOA, 0 code bytes** | `owner()`, `eth_getCode` |
| Creator (Blockscout) | Same address | Blockscout address API |
| Token type | LayerZero v2 OFT (not a plain ERC-20) | `token()` returns itself, `endpoint()` = `0x6F475642a6e85809B1c36Fa62763669b1b48DD5B`, `sharedDecimals()` = 6, `decimalConversionRate()` = 1e12 |
| Transfers | `transfersEnabled()` = `true`; `enableTransfers()` reverts with “already enabled” | `eth_call` |
| Public mint / burn | **No** `mint(address,uint256)` or `burn(uint256)` selector in runtime bytecode | runtime selector scan |
| Supply | 61,164.987469 IMD at the test block. **Not fixed**: the OFT bridge can mint/burn through its endpoint; no public mint/burn is exposed | `totalSupply()`, bytecode scan |
| Blocklist | `blocked(address)`; owner-only `setBlocked(address,bool)` | owner call succeeds, non-owner call reverts `OwnableUnauthorizedAccount` |
| Initial block state | dead address, vault and painter all `blocked = false` | `blocked()` |
| Uniswap v4 config | `poolManager()` = `0x0` at the test block; `setV4Config(address,address,bool)` exists in bytecode | `eth_call`, selector scan |
| Source verification | **Not verified** on Blockscout (`is_verified: false`); Sourcify has no match | Blockscout API, Sourcify v2 |
| Metadata admin | `updateName`, `updateSymbol`, `updateNameAndSymbol` selectors present | bytecode scan (not exercised) |

Only the owner can change the blocklist. Ownership is transferable (`transferOwnership`)
and renounceable (`renounceOwnership`) in the bytecode. There is no multisig or
timelock around the current owner.

## Real-token checks that passed

- `PRICE()` on a fresh deployment is `5,000,000,000,000,000` raw = **0.005 IMD**.
- Approve + deposit of 1 IMD: painter debit 1 IMD, vault token credit 1 IMD, vault
  ledger credit 1 IMD, `totalDeposited` 1 IMD. **No fee-on-transfer.**
- Paint 1 px, 25 px and 100 px in distinct storage slots:
  - dead-address delta is exactly `PRICE × pixels` (0.005 / 0.125 / 0.5 IMD);
  - `totalBurned` increases by exactly the same amount;
  - vault ledger decreases by exactly the cost;
  - `totalSupply` is **unchanged** — this is a transfer, not a burn;
  - the `Painted` event decodes through the app's own `PAINTED_EVENT` with the
    same ids and colors;
  - `pixelAt(id)` returns `palette + 1`.
- `totalSupply` stayed `61,164.987469 IMD` across all 126 painted pixels.
- Withdraw of the unspent 0.37 IMD: wallet credit and vault token debit are exact;
  the vault token balance returns to 0. Over-withdraw reverts.
- Epoch boundary: after 259,200 seconds, `currentEpoch` is 1, epoch 0 is ended and
  frozen, the painter is whitelisted in epoch 0 (126 paints), epoch 1 starts empty,
  and a paint in epoch 1 pays the exact price.
- Deposits and withdrawals prove that transfers **to** the vault contract and
  **from** the vault contract are not blocked by default.
- The dead address is not blocked by default; paint transfers to it succeed.

## Admin-power checks (fork only)

The suite impersonated the real owner and used `setBlocked` on the fork. It then
unblocked every address, so no persistent state was created outside the fork.

| Action | Observed |
| --- | --- |
| Owner blocks the vault | `blocked(vault) = true`; deposit reverts; vault ledger unchanged |
| Owner unblocks the vault | deposit works again |
| Owner blocks the dead address | `blocked(0x…dEaD) = true`; paint reverts and sends nothing to dead |
| Owner unblocks the dead address | paint works again and pays exactly `PRICE` |
| Owner blocks a painter | `blocked(painter) = true`; **withdraw reverts** |
| Paint while painter is blocked | **Still succeeds** — the payment transfer is `vault → dead`, not `painter → dead`; the blocklist is recipient-side |
| Owner unblocks the painter | withdraw works again |
| Non-owner calls `setBlocked` | reverts; blocked status unchanged |

That last distinction matters: blocking a user freezes their **withdrawal** path
(and any transfer **to** them), but does not stop them from spending an existing
vault balance on paint. Blocking the vault or dead address is the stronger
denial-of-service: it stops all deposits or all paints, respectively.

## Pass/fail table

| Group | Checks | Result |
| --- | ---: | --- |
| Network and IMD read-only | 21 | 21 pass |
| Fork state / holder funding | 6 | 6 pass |
| Deployment against real IMD | 13 | 13 pass |
| Approve, deposit, vault accounting | 7 | 7 pass |
| Paint 1 / 25 / 100 px + events | 33 | 33 pass |
| Paint totals, dead balance, supply | 6 | 6 pass |
| Withdraw | 5 | 5 pass |
| Epoch boundary | 10 | 10 pass |
| IMD admin powers | 19 | 19 pass |
| Gas budget | 1 | 1 pass |
| **Total** | **121** | **121 pass, 0 fail** |

An earlier version of the suite expected a blocked painter's paint to revert. It
did not, because the token only checks the recipient and the vault is the sender.
The check was corrected to test withdrawal (which does revert), and the paint path
is recorded above as a semantic finding rather than hidden.

## Gas (fork, real IMD)

The vault was fresh and the board was **not full**, so these numbers do not include
the 66-entry displacement rescan measured in [GAS.md](GAS.md).

| pixels | gas used | gas / pixel | board state |
| ---: | ---: | ---: | --- |
| 1 | 156,856 | 156,856 | below `MIN_PIXELS`, no board entry |
| 25 | 776,447 | 31,058 | adds a board entry |
| 100 | 2,517,034 | 25,170 | updates the board entry |

100 pixels is **2,517,034 gas**, below the 3,000,000 UI budget. The local
full-board worst case is 2,712,676 gas, also below that budget, so the 100-pixel
batch remains safe.

## What this does not prove

- No mainnet transaction was sent, and no real owner key was used.
- No LayerZero message was bridged; the OFT supply-change path was not exercised.
- The token source is **not verified**. The function list comes from runtime
  bytecode selectors and live calls, so an unlisted admin function cannot be ruled
  out. `setV4Config` / `poolManager` was not exercised beyond reading the zero
  value.
- The owner's willingness to keep the vault, dead address and participants
  unblocked is a social/operational assumption, not a contract guarantee.
- The fork is a snapshot. State and owner can change after block `91,614,538`.

## Pre-launch checklist

1. Re-run `npm run e2e:fork` against the RPC and block you will launch with.
2. After IMD publishes the vault address: `npm run check:abi`, then `npm run smoke`.
3. Keep the site copy on “sent to the dead address”, not “burned supply”; the fork
   proves `totalSupply` is unchanged by painting.
4. Publish the token-admin caveat and the owner address next to the launch details.
5. Ask the IMD owner to confirm it will not block the vault, the dead address or
   participants; if it will not, treat the launch as a trust assumption, not a
   guarantee.
