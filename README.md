# PixelFun — Stages 1–2

A fully on-chain 512×512 collaborative pixel canvas on Robinhood Chain.
Paint any pixel for 0.005 IMD, burned by the vault contract. **No database, no
indexer, no backend state**: the app reads pixels straight from the contract and
applies live `Painted` events.

This repository currently contains **Stages 1–2**:

- Next.js App Router + TypeScript strict + wagmi/viem
- Robinhood Chain config (chain ID, RPC, explorer verified from official sources)
- One contract adapter (`src/lib/contract.ts`) driven by `abi/PixelFunVault.json`
- Canvas loading through `getPixels` in 16 chunks, plus `/api/canvas`
- Live `Painted` event polling every 4s, full resync every 60s and on focus
- Single-`<canvas>` renderer with pan, wheel/pinch zoom, fit, grid at 8×+
- Wallet connect (injected + optional WalletConnect) and network switching
- Vault deposit (approve only when needed) and withdraw
- Draft painting with undo/clear, cost bar, auto-split transactions
- Header stats: cumulative pixels painted and IMD burned
- Leaderboard tab: current top 66, countdown, my rank, pixel minimum and WL badges
- Past rounds with on-demand frozen boards and CSV/copy whitelist export
- `MOCK_MODE` with an in-memory canvas, round boards and localStorage fake vault
- Clear “contract not deployed yet” state when addresses are missing

About/Proof, PNG/share/OG, automated tests and final deploy notes remain Stage 3.

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
deployment. Mock board counts are synthetic demo data.

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
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=... # optional
```

The app will show a “contract not deployed yet” screen until both addresses are
provided. No admin/owner/pause UI exists.

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
2. The browser uses that route. If it fails, it falls back to direct RPC reads.
3. The client polls `Painted` logs every 4s from the last processed block and applies
   `ids`/`colors` to the local `Uint8Array(262144)`.
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
- The current board is polled every 10s. Past boards load only when expanded, so
  old rounds never fan out RPC calls on page load.
- Rank is only readable from the contract for the top `BOARD_SIZE` (66). An address
  below the board shows its pixel count with rank `—`; exact rank below 66 would
  require an indexer, which this app deliberately does not have.
- WL badges are provisional (`WL*`) until the round reports `epochEnded = true`.
  Past-round CSV export is disabled until that flag is true.
- CSV format is one lowercase address per line, no header, trailing newline —
  OpenSea allowlist friendly. The file is `pixelfun-round-N-wl.csv`.

## Contract adapter

Everything contract-related lives in `src/lib/contract.ts`:

- ABIs: `abi/PixelFunVault.json`, `abi/ERC20.json` (placeholder ERC20 set)
- addresses and chain from `src/config/chains.ts`
- chunked `getPixels` reader, log reader, token helpers
- wagmi read configs for decimals, balances, allowance, `PRICE` and `MAX_BATCH`
- epoch reads (`currentEpoch`, start/end/ended, `MIN_PIXELS`, `BOARD_SIZE`, `EPOCH_LENGTH`)
- board reads (`getBoard`, `pixelsPaintedIn`, `isWhitelisted`, `totalPixelsPainted`)
- write request builders (`paintCall`, `depositCall`, `withdrawCall`, `approveCall`)

When the swarm ships the final ABI, replace `abi/PixelFunVault.json` and adjust only
this adapter if a name or argument type differs.

## Commands

```bash
npm run dev        # local dev
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # production build
npm run start      # serve the production build
```

Verified after Stage 2: `typecheck`, `lint`, `build`, mock `/api/canvas` payload
(262,144 bytes, 3,126 seeded pixels), tap → Paint → pixel byte update, mock
stats/boards and viewer rank, countdown ticking, board refresh after paint,
past-round expansion, CSV download contents and filename, copy-to-clipboard,
and the not-deployed state. Production hydration was checked with a clean
console on `/` and `/leaderboard`.

## Deploy to Vercel

1. Push the repository and import it into Vercel.
2. Add the env vars from `.env.example` (Project → Settings → Environment Variables).
   `NEXT_PUBLIC_*` vars are inlined at build time; redeploy after changing them.
   `MOCK_MODE` is read when the page is built and by the API at request time, so set
   it before the build and keep it consistent across build and runtime.
3. Deploy. No database, cron, or serverless storage is required.
4. `/api/canvas`, `/api/stats` and `/api/leaderboard` run as Node serverless
   functions. RPC env values are public endpoints; there are no secrets in this stage.
5. Viewer-specific leaderboard responses are `private, no-store`; public boards and
   canvas responses are CDN-cached as described above.

## Stage 3 remaining

- About + Proof pages, PNG export, X share, OG image, favicon, automated tests and
  final deploy notes.

See [ASSUMPTIONS.md](ASSUMPTIONS.md) for the interface assumptions and open items.
