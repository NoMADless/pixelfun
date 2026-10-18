# PixelFun — live on Robinhood Chain

A fully on-chain 512×512 collaborative pixel canvas on Robinhood Chain.
Paint any pixel for 0.005 IMD; the vault sends the payment to the dead address.
**No database, no indexer, no backend state**: the app reads pixels straight from
the contract and applies live `Painted` events.

What this repository contains:

- Next.js App Router + TypeScript strict + wagmi/viem
- Robinhood Chain config (chain ID, RPC and explorer verified from official sources)
- The **real** `PixelFun` ABI compiled from
  [identity-md-launches/launch-2148-dsa](https://github.com/identity-md-launches/launch-2148-dsa)
  (`abi/PixelFunVault.json`), with one adapter in `src/lib/contract.ts`
- Canvas loading through `getPixels` in 8 chunks of 1024 slots (the contract's
  `MAX_READ_SLOTS`), plus a shared, coalesced `/api/canvas`
- Live `Painted` event polling every 4s, full resync every 60s and on focus
- Polling pauses while the tab is hidden
- Single-`<canvas>` renderer with pan, wheel/pinch zoom, fit, grid at 8×+
- Wallet connect (injected + optional WalletConnect) and lazy network switching
- Vault deposit (approve only when needed) and withdraw of the unspent balance
- Draft painting with undo/clear, cost bar and MAX_BATCH transaction splitting
- Header stats: cumulative pixels painted and IMD sent to the dead address
  (`totalBurned()`, a transfer — not a supply reduction)
- Leaderboard: current top 66, countdown, my rank, rank gap to the top 66 and WL badges
- Past rounds with on-demand frozen boards and CSV/copy whitelist export
- About and Proof tabs, PNG canvas export, Share on X, OG/Twitter metadata and a pixel favicon
- Loading skeletons, empty states and route error boundaries
- `MOCK_MODE` with an in-memory canvas, round boards and localStorage fake vault
- Clear “contract not deployed yet” state when addresses are missing
- Unit tests, ABI validation, an env validator and a deployed-vault smoke script
- A repeatable local Anvil end-to-end suite against the real compiled artifact
- A read-only **real-IMD fork suite** on Robinhood Chain, with admin-risk checks
- A dev-only Anvil wallet connector for browser checks (chain 31337 only)
- [CONTRACT_REVIEW.md](CONTRACT_REVIEW.md), [FORK_TEST.md](FORK_TEST.md) and measured [GAS.md](GAS.md)

## Quick start (mock mode, no chain)

```bash
npm install
cp .env.example .env.local
# The template ships the live deployment; set MOCK_MODE=true for the demo
npm run dev
```

Open <http://localhost:3000>. Mock mode uses:

- a server-memory canvas seeded with pixel art at `/api/canvas`
- `/api/mock/paint` to persist mock paint actions and update the round board
- `/api/stats` and `/api/leaderboard?epoch=N` with two completed rounds and a live round
- a localStorage vault per address, starting at 50 IMD, with a +100 faucet
- demo painter `0x000000000000000000000000000000000000dead` when no wallet is connected

Mock state resets when the dev server restarts (canvas and boards) or localStorage
is cleared (vault). It is not durable and not safe for a multi-instance serverless
deployment. Mock board counts and the Proof page's live numbers are synthetic demo
data, not launch proof.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MOCK_MODE` | no | `true` runs the in-memory demo; `false` reads the chain |
| `NEXT_PUBLIC_CHAIN_ID` | no | Defaults to `4663` (Robinhood Chain) |
| `NEXT_PUBLIC_RPC_URL` | no | Defaults to the public Robinhood Chain RPC |
| `NEXT_PUBLIC_EXPLORER_URL` | no | Defaults to `https://robin.etherscan.io` |
| `NEXT_PUBLIC_VAULT_ADDRESS` | real mode | PixelFunVault address (`0x30da…9009` in production) |
| `NEXT_PUBLIC_IMD_ADDRESS` | real mode | IMD ERC-20 address |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | no | Enables the WalletConnect connector |
| `NEXT_PUBLIC_SITE_URL` | no | Public origin for canonical/OG/Twitter/share links. Falls back to `https://$VERCEL_PROJECT_PRODUCTION_URL`, then `http://localhost:3000` |
| `CANVAS_CHUNK_SLOTS` | no | Server `getPixels` chunk size; default 1024 slots (contract max) |
| `NEXT_PUBLIC_CANVAS_CHUNK_SLOTS` | no | Browser RPC fallback chunk size; default 1024 |
| `PIXELFUN_ALLOW_UNDEPLOYED` | no | Set `1` only to run a production server without a vault |
| `NEXT_PUBLIC_LOCAL_DEV` | no | DEV ONLY. `true` adds an Anvil test connector; requires chain 31337 |
| `ROBINHOOD_RPC_URL` | fork test | RPC for `npm run e2e:fork`; the suite skips when unset |
| `IMD_HOLDER` | no | Optional funded EOA to impersonate in `e2e:fork` |
| `PIXELFUN_DEPLOY_TX` | bytecode check | Deploy tx hash for `npm run check:bytecode` |
| `PIXELFUN_CONTRACT_REPO` | bytecode check | Contract checkout with `out/PixelFun.sol/PixelFun.json`; defaults to `../launch-2148-dsa` |

`VERCEL_PROJECT_PRODUCTION_URL` is a Vercel system variable (host without a protocol);
the app turns it into `https://<host>`. Set `NEXT_PUBLIC_SITE_URL` only when you use a
custom domain — there is no hard-coded production domain.

`/api/canvas`, `/api/stats`, `/api/leaderboard` and the browser wallet config only
need public values. There are no secrets.

## Real mode

```dotenv
MOCK_MODE=false
NEXT_PUBLIC_CHAIN_ID=4663
NEXT_PUBLIC_RPC_URL=https://rpc.mainnet.chain.robinhood.com
NEXT_PUBLIC_EXPLORER_URL=https://robin.etherscan.io
NEXT_PUBLIC_VAULT_ADDRESS=0x30da521f63553ec3ea2dbb82c30581c00ccf9009
NEXT_PUBLIC_IMD_ADDRESS=0x5F7Bb59365ce557C26dbcAa4EE9d39A4b95B7127
CANVAS_CHUNK_SLOTS=1024
NEXT_PUBLIC_CANVAS_CHUNK_SLOTS=1024
NEXT_PUBLIC_SITE_URL=https://your-domain.example # optional; Vercel host otherwise
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=... # optional
```

### Live deployment (Robinhood Chain)

| | |
| --- | --- |
| Vault | `0x30da521f63553ec3ea2dbb82c30581c00ccf9009` ([explorer](https://robin.etherscan.io/address/0x30da521f63553ec3ea2dbb82c30581c00ccf9009)) |
| Deploy tx | `0xd7c0e30bc98b22a71eff1aa35df2362f131a295cbc981c764c74fc0511b72523` ([explorer](https://robin.etherscan.io/tx/0xd7c0e30bc98b22a71eff1aa35df2362f131a295cbc981c764c74fc0511b72523)), block 91,565,987 |
| IMD | `0x5F7Bb59365ce557C26dbcAa4EE9d39A4b95B7127` ([token](https://robin.etherscan.io/token/0x5F7Bb59365ce557C26dbcAa4EE9d39A4b95B7127)) |
| Constructor args | `imd = 0x5F7B…7127`, `minPixels = 20` |
| Source commit | [`e880bd5`](https://github.com/identity-md-launches/launch-2148-dsa/commit/e880bd5931c48ca32e7de751471a4506bd25e6e4), solc 0.8.26, optimizer 200 |
| Epoch 0 | starts `2026-10-18T06:38:40Z`, ends `2026-10-21T06:38:40Z` (EPOCH_START 1792305520) |

`npm run check:bytecode` matched the live runtime (6,921 bytes, immutables
masked) and the creation code inside the deploy factory calldata, so
`deployedUnchanged` is `true` on `/proof`. `npm run smoke` passes 11/11 against
the live vault: `imd()`, `MIN_PIXELS = 20`, `PRICE = 0.005 IMD`, empty epoch-0
board, `totalPixelsPainted = 0`, and an all-zero canvas chunk.

The app shows a “contract not deployed yet” screen until both addresses are
provided. The PixelFun vault has no admin/owner/pause UI. IMD itself is an
owner-controlled token; [FORK_TEST.md](FORK_TEST.md) records its admin powers and
the exact fork evidence.

### Startup validation

`src/instrumentation.ts` runs once before a server instance accepts requests.
With `MOCK_MODE=false` it validates the required addresses and URL formats and
prints **every** missing or malformed variable in one error. A production server
throws at startup; development logs the same message and keeps the explicit
not-deployed UI available. Set `PIXELFUN_ALLOW_UNDEPLOYED=1` to downgrade the
production error to a warning when intentionally previewing without a vault.

## Robinhood Chain parameters

Verified 2026-10-18 against the live chain:

| Field | Value |
| --- | --- |
| Chain ID | `4663` (`0x1237`; confirmed live via `eth_chainId`) |
| RPC | `https://rpc.mainnet.chain.robinhood.com` |
| Explorer | `https://robin.etherscan.io` (address, tx and token pages return 200; Blockscout also mirrors the chain) |
| Native gas token | ETH |

Official sources: [docs.robinhood.com/chain/connecting](https://docs.robinhood.com/chain/connecting/),
[docs.robinhood.com/chain/add-network-to-wallet](https://docs.robinhood.com/chain/add-network-to-wallet/),
[robinhood.com support — Robinhood Chain mainnet](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet/).
The docs host returned TLS errors from this build machine, so the values were
cross-checked against official search snippets plus the live RPC and explorer.

## Canvas without a backend

1. `/api/canvas` reads `getPixels(startSlot, slotCount)` server-side in
   `CANVAS_CHUNK_SLOTS` chunks (default 1024 slots = 32,768 pixels), 8 calls total,
   concurrency 4, 2 retries. The chunk size is clamped at runtime to the
   contract's own `MAX_READ_SLOTS` read, so a misconfigured env cannot exceed it.
   It returns `{ width, height, pixels: base64, lastSync, blockNumber }` with
   `Cache-Control: public, s-maxage=3, stale-while-revalidate=30`. Requests within
   a 3s window share one in-memory read, so concurrent visitors do not each
   trigger a full 8-call sweep.
2. The browser uses that route. If it fails, it falls back to direct RPC reads.
3. The client polls `Painted` logs every 4s from the last processed block and applies
   `ids`/`colors` to the local `Uint8Array(262144)`. Polls are skipped while the tab
   is hidden.
4. A full resync runs every 60s and whenever the tab becomes visible/focused.

`MOCK_MODE` serves the same API shape from an in-memory canvas.

## Leaderboard without an indexer

- `/api/stats` reads `totalPixelsPainted`, `totalBurned`, `PRICE`, token decimals,
  `currentEpoch`, epoch start/end/ended, `MIN_PIXELS`, `BOARD_SIZE` and
  `EPOCH_LENGTH` server-side. Burned uses the contract's `totalBurned()` with
  `totalPixelsPainted × PRICE` as a fallback. `PRICE()` is a view and works before
  the first transaction; if it reverts, the app computes `5 * 10^(decimals-3)`
  from `decimals()`. It is cached for 4s at the CDN.
- `/api/leaderboard?epoch=N` reads `getBoard(N)`, `epochEnded(N)` and `BOARD_SIZE`.
  Ended boards are cached for an hour; the live board for 4s.
- Adding `viewer=0x…` returns that address's `pixelsPaintedIn`, rank and
  `isWhitelisted`. Those responses are `private, no-store` because they are
  wallet-specific.
- The current board and stats poll every 10s only while the tab is visible. Past
  boards load only when expanded, so old rounds never fan out RPC calls on page load.
- Rank is only readable from the contract for the top `BOARD_SIZE` (66). For an
  address outside the board, “My rank” shows the pixels still needed to enter it:
  `max(MIN_PIXELS − myCount, 0)` when the board is not full, and
  `max(MIN_PIXELS, lowestCount + 1) − myCount` when it is full (the contract rejects
  ties, so a newcomer needs strictly more than the lowest entry).
- WL badges are provisional (`WL*`) until the round reports `epochEnded = true`.
  Past-round CSV export is disabled until that flag is true.
- CSV format is one lowercase address per line, no header, trailing newline —
  OpenSea allowlist friendly. The file is `pixelfun-round-N-wl.csv`.

## Contract adapter and ABI readiness

Everything contract-related lives in `src/lib/contract.ts`:

- ABIs: `abi/PixelFunVault.json` (extracted from the real compiled artifact),
  `abi/ERC20.json` (approve/balance/allowance/decimals only)
- addresses and chain from `src/config/chains.ts`
- chunked `getPixels` reader clamped to `MAX_READ_SLOTS`, log reader, token helpers
- wagmi read configs for decimals, balances, allowance, `PRICE` and `MAX_BATCH`
  (`MAX_BATCH` is a `uint256`, converted to a number in the hook)
- epoch reads (`currentEpoch`, start/end/ended, `MIN_PIXELS`, `BOARD_SIZE`, `EPOCH_LENGTH`)
- stats reads (`totalPixelsPainted`, `totalBurned`, `totalDeposited`, `BURN_ADDRESS`)
- board reads (`getBoard`, `pixelsPaintedIn`, `isWhitelisted`)
- write request builders (`paintCall`, `depositCall`, `withdrawCall`, `approveCall`)

`src/lib/abi-requirements.ts` is the single list of every function and event this
app calls. After changing the ABI:

```bash
npm run check:abi
```

It prints each required signature and exits non-zero if anything is missing or has
different inputs/outputs. Adjust only `src/lib/contract.ts` if a name or argument
type changed.

### Refresh the ABI from the contract repo

```bash
# next to this repository
git clone https://github.com/identity-md-launches/launch-2148-dsa ../launch-2148-dsa
(cd ../launch-2148-dsa && forge build)
node -e '
  const fs = require("fs");
  const a = JSON.parse(fs.readFileSync("../launch-2148-dsa/out/PixelFun.sol/PixelFun.json"));
  fs.writeFileSync("abi/PixelFunVault.json", JSON.stringify(a.abi, null, 2) + "\n");
'
npm run check:abi
```

The committed ABI is the artifact's `abi` array (45 entries). The local e2e suite
fails if it ever drifts from the compiled artifact.

## Real-token fork test (Robinhood Chain)

This is the read-only bridge between “works on Anvil” and “safe to announce”. It
forks the live Robinhood Chain, impersonates a funded IMD holder, deploys the real
`PixelFun(IMD, 20)` with the real token, and sends transactions only on the local
fork. No private key or real transaction is used.

```bash
ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com npm run e2e:fork
```

It checks the token facts (18 decimals, no proxy, LayerZero OFT, owner EOA, no
public mint/burn), `PRICE() = 0.005 IMD`, exact deposit accounting with no transfer
fee, 1/25/100-pixel paints, the dead-address balance and unchanged `totalSupply`,
withdrawals, an epoch boundary, and the owner's blocklist powers. The last run was
**121/121 checks passed**; see [FORK_TEST.md](FORK_TEST.md) for facts, gas and the
go/no-go recommendation.

Set `ANVIL_BIN` if Foundry is not on `PATH`, `IMD_HOLDER` to choose a different
funded EOA, and `IMD_ADDRESS` to override the token. The suite skips with a clear
message when `ROBINHOOD_RPC_URL` is unset.

## Local end-to-end test (Anvil)

This is the real contract, compiled from the contract repo, on a local chain. It
does not touch a real network and uses only Anvil's public test mnemonic.

Requirements: [Foundry](https://book.getfoundry.sh/getting-started/installation)
(`forge` and `anvil` on `PATH`) and a built contract repo at `../launch-2148-dsa`.

```bash
npm run e2e:local
```

What it does:

- starts Anvil on a free local port and deploys a mock IMD (the contract repo's
  `CanvasToken`) plus the real `PixelFun(imd, 20)`
- runs the suite twice: **18 decimals and 6 decimals**
- checks `PRICE()` on a fresh deployment (and the 2-decimal `UnsupportedDecimals`
  edge), approve/deposit, fee-on-transfer deposit crediting, withdraw of only the
  unspent balance, `totalBurned` and the dead address balance
- paints ids `[0, 31, 32, 511, 512, 262143]`, reads all 8,192 slots through
  `getPixels`, and asserts every byte (packing/byte-order check); also `pixelAt`
  and `BadRange` on oversized chunks
- decodes `Painted` logs with the app's `PAINTED_EVENT` and replays them through the
  app's `applyPaint`, comparing byte-for-byte with chain state
- covers duplicate ids, bad id/color, empty batch, batch > 100, length mismatch,
  insufficient balance, zero amounts and over-withdraw
- fills all 66 board slots, then checks equal-count rejection, strictly-greater
  displacement, earlier-reach tie order, sorted `getBoard`, `isWhitelisted`, and
  the app's "pixels needed" calculation against real board data
- travels through an epoch boundary with `evm_increaseTime`/`evm_mine`, checks
  `currentEpoch`/`epochEnded`, the frozen past board, the empty new board and the
  CSV export gate
- measures gas for 1/25/50/100 px on a full board and writes [GAS.md](GAS.md)

Environment overrides: `PIXELFUN_CONTRACT_REPO`, `ANVIL_BIN`, `FORGE_BIN`,
`E2E_ANVIL_PORT`, `E2E_WRITE_GAS=0` (do not rewrite GAS.md).

`npm run e2e:local` prints `302/302 checks passed` and exits non-zero on the
first failed check. The measured 100-pixel batch is 2,712,676 gas, below the 3M
budget, so the UI keeps the contract maximum of 100 pixels per transaction and
adds a 20% buffer to every `eth_estimateGas` result.

## Local browser check against Anvil

`NEXT_PUBLIC_LOCAL_DEV=true` adds an **Anvil (dev)** connector that signs with the
first well-known Anvil test key. It is a public test key, not a secret, and it is
only added to the wallet list when the flag is set. The module throws at import if
the flag is combined with any `NEXT_PUBLIC_CHAIN_ID` other than `31337`, so a
production build cannot point it at mainnet (verified: that build exits 1).

```bash
# terminal 1
anvil --port 8545 --chain-id 31337

# terminal 2
npx tsx scripts/local-e2e/fixture.ts   # deploys + seeds, prints env
# copy the printed env into .env.local, then:
npm run dev
```

Open the app, connect **Anvil (dev)**, then paint, deposit and withdraw. The
fixture funds the dev account, paints recognizable pixels and seeds a three-entry
board. This connector is for local verification only; leave
`NEXT_PUBLIC_LOCAL_DEV` unset in production.

## Proof page

`src/config/proof.ts` records the live deployment: vault address, explorer link,
deploy tx and block, source commit, constructor args, compiler settings,
attestation and manifest hashes, launch number 2148 and the seven IMD verification
gates. `deployedUnchanged` is `true` because `npm run check:bytecode` matched both
the runtime bytecode and the creation code. The wording is “IMD verification gates
passed” — IMD's verifier is not a third-party audit. Empty fields are hidden, and
the page still shows live total-painted, dead-address and current-round values.

## Commands

```bash
npm run dev        # local dev
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest unit tests
npm run build      # production build
npm run start      # serve the production build
npm run check:abi       # compare ABI requirements with the committed ABIs
npm run check:bytecode  # compare live runtime + creation code with the build
npm run smoke           # read the live vault and print pass/fail
npm run e2e:local  # full local Anvil suite against the real contract
npm run e2e:fork   # real IMD fork suite (needs ROBINHOOD_RPC_URL)
npm run assets     # regenerate OG image, favicons from the pixel-art script
```

`npm run smoke` needs `MOCK_MODE=false`, `NEXT_PUBLIC_VAULT_ADDRESS`,
`NEXT_PUBLIC_IMD_ADDRESS` and an RPC. It compares `imd()`, `MIN_PIXELS = 20` and
`PRICE = 0.005 IMD`, confirms epoch 0's board and `totalPixelsPainted` are empty,
reads one all-zero `getPixels` chunk, and prints `EPOCH_START` with the epoch-0
window. It is read-only and never sends a transaction.

## Verify the live deployment

Status at the time of writing: the vault is deployed and the read-only checks
pass. Painting had not started, so epoch 0 was still open.

- [x] `npm run check:bytecode` — 10/10: runtime 6,921 bytes matches with immutables
  masked; creation code found in the deploy calldata; args `IMD, 20`.
- [x] `npm run check:abi` — 33/33 requirements against the regenerated ABI
  (45 entries, zero diff from commit `e880bd5`).
- [x] `npm run smoke` — 11/11 against the live vault.
- [x] `npm run e2e:local` and `npm run e2e:fork` — 302/302 and 121/121.
- [ ] Real demo transactions (approve → deposit → paint → withdraw) and the
  resulting hashes in `demoTxUrls`.
- [ ] The IMD owner's written reassurance that the vault, `0x…dEaD` and
  participants will not be blocklisted ([FORK_TEST.md](FORK_TEST.md)).

Re-run the three commands below before every production deploy:

```bash
npm run check:bytecode   # needs PIXELFUN_DEPLOY_TX
npm run check:abi
npm run smoke
```

## Deploy to Vercel

1. Push the repository and import it into Vercel.
2. Add these env vars (Project → Settings → Environment Variables), then redeploy:

```dotenv
MOCK_MODE=false
NEXT_PUBLIC_CHAIN_ID=4663
NEXT_PUBLIC_RPC_URL=https://rpc.mainnet.chain.robinhood.com
NEXT_PUBLIC_EXPLORER_URL=https://robin.etherscan.io
NEXT_PUBLIC_VAULT_ADDRESS=0x30da521f63553ec3ea2dbb82c30581c00ccf9009
NEXT_PUBLIC_IMD_ADDRESS=0x5F7Bb59365ce557C26dbcAa4EE9d39A4b95B7127
CANVAS_CHUNK_SLOTS=1024
NEXT_PUBLIC_CANVAS_CHUNK_SLOTS=1024
# optional: only for a custom domain; the Vercel production host is used otherwise
# NEXT_PUBLIC_SITE_URL=https://your-domain.example
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
```

   `NEXT_PUBLIC_*` values are inlined at build time; redeploy after changing them.
   `MOCK_MODE` is read when pages are built and by the API at request time, so set
   it before the build and keep it consistent across build and runtime.
3. Deploy. No database, cron or serverless storage is required.
4. `/api/canvas`, `/api/stats` and `/api/leaderboard` run as Node serverless
   functions. Viewer-specific leaderboard responses are `private, no-store`; public
   boards and canvas responses are CDN-cached as described above.
5. The default public RPC may rate-limit under demo traffic. Use a dedicated RPC
   endpoint in `NEXT_PUBLIC_RPC_URL` for a launch, and keep the server route as the
   primary canvas reader so visitors do not each fan out 16 RPC calls.

## Tests and verification

`npm test` covers pure logic: paint cost, MAX_BATCH batching, price fallback,
gas buffer/out-of-gas detection, pixel pack/unpack, id↔x,y mapping, rank-gap
calculation, CSV generation and countdown formatting. `npm run e2e:local` covers
the real contract on Anvil with 302 checks at 18 and 6 decimals. `npm run e2e:fork`
covers the real IMD token on a Robinhood Chain fork with 121 checks, including the
owner blocklist. Browser checks against a local Anvil deployment covered the canvas
render, deposit, paint (with gas estimate), withdraw, live `Painted` updates,
leaderboard, countdown, About and `/proof`.

See [CONTRACT_REVIEW.md](CONTRACT_REVIEW.md) for the contract review,
[FORK_TEST.md](FORK_TEST.md) for the real-token evidence, [GAS.md](GAS.md) for the
gas table, [ASSUMPTIONS.md](ASSUMPTIONS.md) for interface assumptions and
[DEMO.md](DEMO.md) for the go-live/demo checklist.
