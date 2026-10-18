# PixelFun — Stages 1–3

A fully on-chain 512×512 collaborative pixel canvas on Robinhood Chain.
Paint any pixel for 0.005 IMD, burned by the vault contract. **No database, no
indexer, no backend state**: the app reads pixels straight from the contract and
applies live `Painted` events.

This repository contains **Stages 1–3**:

- Next.js App Router + TypeScript strict + wagmi/viem
- Robinhood Chain config (chain ID, RPC and explorer verified from official sources)
- One contract adapter (`src/lib/contract.ts`) driven by `abi/PixelFunVault.json`
- Canvas loading through `getPixels` in 16 chunks, plus a shared, coalesced `/api/canvas`
- Live `Painted` event polling every 4s, full resync every 60s and on focus
- Polling pauses while the tab is hidden
- Single-`<canvas>` renderer with pan, wheel/pinch zoom, fit, grid at 8×+
- Wallet connect (injected + optional WalletConnect) and lazy network switching
- Vault deposit (approve only when needed) and withdraw of the unspent balance
- Draft painting with undo/clear, cost bar and MAX_BATCH transaction splitting
- Header stats: cumulative pixels painted and IMD burned
- Leaderboard: current top 66, countdown, my rank, rank gap to the top 66 and WL badges
- Past rounds with on-demand frozen boards and CSV/copy whitelist export
- About and Proof tabs, PNG canvas export, Share on X, OG/Twitter metadata and a pixel favicon
- Loading skeletons, empty states and route error boundaries
- `MOCK_MODE` with an in-memory canvas, round boards and localStorage fake vault
- Clear “contract not deployed yet” state when addresses are missing
- Unit tests, ABI validation, an env validator and a deployed-vault smoke script

## Quick start (mock mode, no chain)

```bash
npm install
cp .env.example .env.local
# .env.local already has MOCK_MODE=true
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
| `NEXT_PUBLIC_EXPLORER_URL` | no | Defaults to the Robinhood Chain Blockscout |
| `NEXT_PUBLIC_VAULT_ADDRESS` | real mode | PixelFunVault address |
| `NEXT_PUBLIC_IMD_ADDRESS` | real mode | IMD ERC-20 address |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | no | Enables the WalletConnect connector |
| `NEXT_PUBLIC_SITE_URL` | no | Public origin for canonical/OG/share links; defaults to `https://pixelfun.xyz` |
| `CANVAS_CHUNK_SLOTS` | no | Server `getPixels` chunk size; default 512 slots |
| `NEXT_PUBLIC_CANVAS_CHUNK_SLOTS` | no | Browser RPC fallback chunk size; default 512 |
| `PIXELFUN_ALLOW_UNDEPLOYED` | no | Set `1` only to run a production server without a vault |

`/api/canvas`, `/api/stats`, `/api/leaderboard` and the browser wallet config only
need public values. There are no secrets in this stage.

## Real mode

```dotenv
MOCK_MODE=false
NEXT_PUBLIC_CHAIN_ID=4663
NEXT_PUBLIC_RPC_URL=https://rpc.mainnet.chain.robinhood.com
NEXT_PUBLIC_EXPLORER_URL=https://robinhoodchain.blockscout.com
NEXT_PUBLIC_VAULT_ADDRESS=0x...
NEXT_PUBLIC_IMD_ADDRESS=0x...
CANVAS_CHUNK_SLOTS=512
NEXT_PUBLIC_CANVAS_CHUNK_SLOTS=512
NEXT_PUBLIC_SITE_URL=https://your-domain.example
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=... # optional
```

The app shows a “contract not deployed yet” screen until both addresses are
provided. No admin/owner/pause UI exists.

### Startup validation

`src/instrumentation.ts` runs once before a server instance accepts requests.
With `MOCK_MODE=false` it validates the required addresses and URL formats and
prints **every** missing or malformed variable in one error. A production server
throws at startup; development logs the same message and keeps the explicit
not-deployed UI available. Set `PIXELFUN_ALLOW_UNDEPLOYED=1` to downgrade the
production error to a warning when intentionally previewing without a vault.

## Robinhood Chain parameters

Verified before hardcoding:

| Field | Value |
| --- | --- |
| Chain ID | `4663` (`0x1237`; confirmed live via `eth_chainId`) |
| RPC | `https://rpc.mainnet.chain.robinhood.com` |
| Explorer | `https://robinhoodchain.blockscout.com` (HTTP 200) |
| Native gas token | ETH |

Official sources: [docs.robinhood.com/chain/connecting](https://docs.robinhood.com/chain/connecting/),
[docs.robinhood.com/chain/add-network-to-wallet](https://docs.robinhood.com/chain/add-network-to-wallet/),
[robinhood.com support — Robinhood Chain mainnet](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet/).
The docs host was not fetchable from the build environment (TLS interception), so
the values were cross-checked against official search snippets plus the live RPC
and explorer.

## Canvas without a backend

1. `/api/canvas` reads `getPixels(startSlot, slotCount)` server-side in
   `CANVAS_CHUNK_SLOTS` chunks (default 512 slots = 16,384 pixels), 16 calls total,
   concurrency 4, 2 retries. It returns `{ width, height, pixels: base64, lastSync,
   blockNumber }` with `Cache-Control: public, s-maxage=3, stale-while-revalidate=30`.
   Requests within a 3s window share one in-memory read, so concurrent visitors do
   not each trigger a full 16-call sweep.
2. The browser uses that route. If it fails, it falls back to direct RPC reads.
3. The client polls `Painted` logs every 4s from the last processed block and applies
   `ids`/`colors` to the local `Uint8Array(262144)`. Polls are skipped while the tab
   is hidden.
4. A full resync runs every 60s and whenever the tab becomes visible/focused.

`MOCK_MODE` serves the same API shape from an in-memory canvas.

## Leaderboard without an indexer

- `/api/stats` reads `totalPixelsPainted`, `PRICE`, token decimals, `currentEpoch`,
  epoch start/end/ended, `MIN_PIXELS`, `BOARD_SIZE` and `EPOCH_LENGTH` server-side.
  Burned total is `totalPixelsPainted × PRICE`. It is cached for 4s at the CDN.
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

- ABIs: `abi/PixelFunVault.json`, `abi/ERC20.json` (placeholder ERC20 set)
- addresses and chain from `src/config/chains.ts`
- chunked `getPixels` reader, log reader, token helpers
- wagmi read configs for decimals, balances, allowance, `PRICE` and `MAX_BATCH`
- epoch reads (`currentEpoch`, start/end/ended, `MIN_PIXELS`, `BOARD_SIZE`, `EPOCH_LENGTH`)
- board reads (`getBoard`, `pixelsPaintedIn`, `isWhitelisted`, `totalPixelsPainted`)
- write request builders (`paintCall`, `depositCall`, `withdrawCall`, `approveCall`)

`src/lib/abi-requirements.ts` is the single list of every function and event this
app calls. After swapping in the final ABI:

```bash
npm run check:abi
```

It prints each required signature and exits non-zero if anything is missing or has
different inputs/outputs. Adjust only `src/lib/contract.ts` if a name or argument
type changed.

## Proof page

`src/config/proof.ts` holds optional launch-proof fields: contract address, verified
explorer URL, IMD launch number/job URL, audit report, deployed-unchanged flag,
demo transaction URLs, X account and repo URL. Empty fields are hidden; when every
field is empty, `/proof` shows a neutral “launch details coming soon” state. The
page also shows live total-painted, burned and current-round values.

## Commands

```bash
npm run dev        # local dev
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest unit tests
npm run build      # production build
npm run start      # serve the production build
npm run check:abi  # compare ABI requirements with the committed ABIs
npm run smoke      # read a deployed vault and print pass/fail
npm run assets     # regenerate OG image, favicons from the pixel-art script
```

`npm run smoke` needs `MOCK_MODE=false`, `NEXT_PUBLIC_VAULT_ADDRESS`,
`NEXT_PUBLIC_IMD_ADDRESS` and an RPC. It reads `PRICE`, `WIDTH`, `HEIGHT`,
`MIN_PIXELS`, `EPOCH_START`, `currentEpoch`, `totalPixelsPainted`, one `getPixels`
chunk and `getBoard(currentEpoch)`, then prints a pass/fail summary. It is read-only
and never sends a transaction.

## Deploy to Vercel

1. Push the repository and import it into Vercel.
2. Add the env vars from `.env.example` (Project → Settings → Environment Variables).
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

`npm test` covers pure logic only: paint cost, MAX_BATCH batching, pixel
pack/unpack, id↔x,y mapping, rank-gap calculation, CSV generation and countdown
formatting. The app was also checked in a production build at 375px and desktop
widths in both themes. See [ASSUMPTIONS.md](ASSUMPTIONS.md) for interface
assumptions and [DEMO.md](DEMO.md) for the post-deploy demo checklist.
