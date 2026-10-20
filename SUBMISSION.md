# PixelFun — Identity MD Hackathon submission

Status: **contract live, site live, submission ready to post.**
Prepared 2026-10-20. Submissions close **21 October**, winners **23 October**.

## One line

A 512×512 on-chain canvas on Robinhood Chain: every pixel costs 0.005 IMD, the
payment leaves the contract for `0x…dEaD` the moment it is painted, and the top
66 painters of each 3-day round become the whitelist for a future mint. No owner,
no admin, no pause, no upgrade path.

## Eligibility against the published criteria

| Criterion (from the announcement post) | Status | Evidence |
| --- | --- | --- |
| Launched through the IMD Protocol during the build window (7–21 Oct) | **Met** | Launch `2148`, deployed 2026-10-18 (block 91,565,987) — inside the window. Job page: <https://explorer.imd.fun/jobs/7080a75d-d9a3-48da-a85c-9cb4e20a6f67> |
| Meaningful build beyond a standard token (V4 hook or custom contract) | **Met** | Purpose-written `PixelFun` contract, 6,921-byte runtime, 30 functions / 3 events, no ERC-20 surface. Substance listed under [Why this is meaningful](#why-this-is-meaningful). |

## Links

| What | Where |
| --- | --- |
| IMD launch / job (8 agents built, reviewed, tested it) | <https://explorer.imd.fun/jobs/7080a75d-d9a3-48da-a85c-9cb4e20a6f67> |
| Contract (Robinhood Chain, 4663) | `0x30da521f63553ec3ea2dbb82c30581c00ccf9009` |
| Explorer | <https://robin.etherscan.io/address/0x30da521f63553ec3ea2dbb82c30581c00ccf9009#code> |
| Deploy tx | <https://robin.etherscan.io/tx/0xd7c0e30bc98b22a71eff1aa35df2362f131a295cbc981c764c74fc0511b72523> |
| Source (audited commit) | <https://github.com/identity-md-launches/launch-2148-dsa/commit/e880bd5931c48ca32e7de751471a4506bd25e6e4> |
| App source | this repository |
| App | <https://pixelfun-beryl.vercel.app/> (also builds to a static `out/` for IPFS) |

## Verified on-chain state

Read from the public RPC on 2026-10-20T06:34Z with the shipped ABI, not copied
from the launch page:

| Value | Result |
| --- | --- |
| `imd()` | `0x5F7Bb59365ce557C26dbcAa4EE9d39A4b95B7127` |
| `MIN_PIXELS` | 20 |
| `PRICE()` | `5e15` raw = 0.005 IMD (token decimals 18) |
| `WIDTH` × `HEIGHT` | 512 × 512 = 262,144 pixels |
| `BOARD_SIZE` | 66 |
| `EPOCH_START` | 2026-10-18T06:38:40Z |
| `currentEpoch()` | 0, ends **2026-10-21T06:38:40Z** |
| `totalPixelsPainted()` | 20 |
| `totalBurned()` | 0.1 IMD |
| `getBoard(0)` | 1 painter: `0xC4a8Ea10819d341D19d1dFBBa7Bb0E0F2295d952`, 20 px |
| `getPixels(0, 1024)` | 16,384 bytes, all zero (empty canvas) |

That read pattern is what the site does at runtime: no indexer, no database, no
backend state.

## Demo transactions (all receipts status `1`, verified via RPC)

| Action | Block | Gas used | Tx |
| --- | ---: | ---: | --- |
| Deposit 0.05 IMD | 92,075,730 | 143,006 | `0x400b4ab429e47ca69faa8770ec6b8c043e838445a5adab2f362bbeb11e4d23c3` |
| Paint 1 px | 92,075,918 | 156,892 | `0x1acce07cd2e11467b52b160dd72c091d97ff9f881c83aaf9e38e69f78990fb0f` |
| Paint 3 px | 92,076,069 | 93,116 | `0xc6b32e9679088aa11ec5aea44a28fed0c00878b096018e73ee2e6c6e512cace6` |
| Withdraw 0.03 IMD | 92,076,151 | 50,666 | `0x6c005fca5fbc562d762953a868ced027459d42489c6f6e51a3dc7295c11ab96b` |
| Deposit 0.1221 IMD | 92,078,618 | 117,090 | `0x7600d5cc69dee6f3449bd8b6341ef63d4445eacfccaf45a7d264a2da1d555828` |
| Paint 16 px | 92,078,873 | 345,070 | `0x147c9563facad1d647dc725facf965ff157fde1cd49ccc877ee58655bef3e778` |
| Withdraw 0.0421 IMD | 92,078,986 | 64,535 | `0x2a31d00ac882e341e2807423e923e7d04697fd6155679ca10c51cb016e1014dc` |

1 + 3 + 16 = 20 pixels, which is exactly `totalPixelsPainted()` and exactly
`MIN_PIXELS`, so the demo wallet is on the round-0 board. Full list with labels:
`src/config/proof.ts`.

## Why this is meaningful

- **Ownerless by construction.** The constructor takes only `(imd, minPixels)`;
  the ABI has 30 functions and none of them is owner, admin, pause, upgrade,
  mint, sweep or rescue. Verified against `abi/PixelFunVault.json`.
- **No pot to steal.** Payment leaves the contract in the same call
  (`safeTransfer` to the dead address), so the contract holds nothing but
  unclaimed vault balances, and each balance is only spendable by its owner.
- **Full canvas readable in 8 calls.** Pixels are packed 32 per 32-byte slot;
  `getPixels(startSlot, slotCount)` returns `slotCount * 32` bytes and is capped
  at 1,024 slots = 32,768 pixels. A static page with only RPC can render
  everything.
- **On-chain leaderboard, not a hosted one.** `getBoard` / `isWhitelisted`
  answer the round state directly; the board is bounded at 66 entries with a
  cached minimum, so inserting never scans more than 66 slots.
- **Measured cost, not estimated.** Full board, distinct slots: 1 px 116,251
  gas; 25 px 897,949; 50 px 1,502,813; 100 px 2,712,676 (`GAS.md`).

## Test and verification evidence

| Check | Result |
| --- | --- |
| `forge test` in the contract repo | 57 passed, 0 failed (incl. a 256-run board invariant) |
| `npm run e2e:local` (real artifact on Anvil) | 302 checks passed |
| `npm run e2e:fork` (read-only real IMD fork) | 121 checks passed |
| `npm run check:bytecode` | runtime matches artifact after masking 12 immutables; creation code found in the deploy calldata |
| `npm run check:abi` | 33/33 ABI requirements |
| `npm run smoke` (live) | params and reads pass; the "fresh deployment" rows now report the 20 painted pixels |

Review documents: `CONTRACT_REVIEW.md` (findings), `FORK_TEST.md` (real-token
behaviour), `GAS.md` (measurements), `ASSUMPTIONS.md`.

## Honest limitations (do not overclaim in the post)

1. **"Burn" is a transfer to `0x…dEaD`.** `totalSupply()` does not fall; the
   tokens are locked, not destroyed. Wording everywhere should be "sent to the
   dead address".
2. **Duplicates count.** 20 paints of the *same* pixel (0.1 IMD) reach
   `MIN_PIXELS` and put an address on the board. The shipped UI de-duplicates
   drafts with a Map; a direct contract call does not.
3. **The IMD token has an owner.** A blocklist or transfer switch on IMD can
   freeze deposits, paints and withdrawals together. That power lives outside
   PixelFun and cannot be removed inside a no-admin brief.
4. **No third-party audit.** The IMD verifier passed seven gates; that is not an
   audit, and `src/config/proof.ts` deliberately leaves `auditReportUrl` unset.
5. **Past boards assume monotonic timestamps**, as any epoch scheme on an L2
   does.

## Before you post

- [x] **Deploy the site.** Live at <https://pixelfun-beryl.vercel.app/>, in
      live mode (header stats read the deployed vault) with OG and canonical URLs
      resolving to that origin.
- [x] Link the IMD launch page from `/proof` (`imdJobUrl` in
      `src/config/proof.ts`).
- [x] **Make the repo deployable on IPFS.** The IMD flow builds a repository and
      pins a static site, so the app is now a static export: `npm run build`
      emits `out/`, every read goes straight to the RPC from the browser, and the
      live contract address is the built-in default, so a build with no env
      variables still points at launch 2148. Verified by serving `out/` over
      plain HTTP and checking canvas, leaderboard and proof against the chain.
- [ ] **Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`** and redeploy. Right now the
      connect modal says "Mobile wallets need
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID": only injected wallets can connect,
      so a judge on a phone with a WalletConnect-only wallet cannot paint.
- [ ] **Paint something recognizable before judging.** The whole canvas holds
      20 painted pixels (one 11×7 glyph at y≈311), so a first-time visitor sees
      an empty cream grid. Round 0 closes 2026-10-21T06:38:40Z; after that the
      board is frozen but the canvas keeps going.
- [ ] Put the site URL and the seven demo txs in the launch post; they are
      already wired into `/proof` from `src/config/proof.ts`.
- [ ] Tell visitors how to get IMD. The site explains the price but never links
      a swap or the token, so nobody who lands on it can take part.
- [ ] Optional: add `robots.txt` and a sitemap; both 404 today.
- [ ] Confirm the submission channel: the criteria post asks for a launch
      through IMD plus a meaningful contract; the announcement thread is the
      place the community and IMD agents pick entries up.

## Draft post

> PixelFun is live on Robinhood Chain.
>
> A 512×512 canvas where a pixel costs 0.005 $IMD and the payment leaves the
> contract for 0x…dEaD in the same transaction.
>
> No owner. No admin. No pause. No upgrade.
>
> Launch 2148 → https://explorer.imd.fun/jobs/7080a75d-d9a3-48da-a85c-9cb4e20a6f67
> Contract → https://robin.etherscan.io/address/0x30da521f63553ec3ea2dbb82c30581c00ccf9009#code

Thread:

> 1/ 262,144 pixels, 32 colors, packed 32 per storage slot. Three-day rounds:
> the top 66 painters of each round become the whitelist for a later mint.
>
> 2/ No backend. Pixels, boards, prices and ranks are all view calls — 8 RPC
> calls render the entire canvas, so any static page can show it.
>
> 3/ Built and reviewed by the IMD swarm (8 agents), then verified again here:
> 6,921-byte runtime matching commit e880bd5, immutables masked, creation code
> found in the deploy calldata.
>
> 4/ Two things I won't overclaim: the payment is a transfer to the dead
> address, not an ERC-20 burn — supply doesn't fall — and duplicate ids in one
> batch still count, so 20 paints of one pixel reaches the round minimum. The UI
> de-duplicates; a raw call doesn't.
>
> 5/ Deposit → paint → withdraw, all on chain: [7 demo tx links]
