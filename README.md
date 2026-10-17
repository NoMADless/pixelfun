# PixelFun — Stage 1

A fully on-chain 512×512 collaborative pixel canvas on Robinhood Chain.
Paint any pixel for 0.005 IMD, burned by the vault contract. **No database, no
indexer, no backend state**: the app reads pixels straight from the contract and
applies live `Painted` events.

This repository currently contains **Stage 1** only:

- Next.js App Router + TypeScript strict + wagmi/viem
- Robinhood Chain config (chain ID, RPC, explorer verified from official sources)
- One contract adapter (`src/lib/contract.ts`) driven by `abi/PixelFunVault.json`
- Canvas loading through `getPixels` in 16 chunks, plus `/api/canvas`
- Live `Painted` event polling every 4s, full resync every 60s and on focus
- Single-`<canvas>` renderer with pan, wheel/pinch zoom, fit, grid at 8×+
- Wallet connect (injected + optional WalletConnect) and network switching
- Vault deposit (approve only when needed) and withdraw
- Draft painting with undo/clear, cost bar, auto-split transactions
- `MOCK_MODE` with an in-memory canvas and localStorage fake vault
- Clear “contract not deployed yet” state when addresses are missing

Leaderboard, past rounds, CSV export, About/Proof, PNG/share/OG are Stage 2 and 3.

## Quick start (mock mode, no chain)

```bash
npm install
cp .env.example .env.local
# .env.local already has MOCK_MODE=true
npm run dev
```

Open <http://localhost:3000>. Mock mode uses:

- a server-memory canvas seeded with pixel art at `/api/canvas`
- `/api/mock/paint` to persist mock paint actions
- a localStorage vault per address, starting at 50 IMD, with a +100 faucet
- demo painter `0x000000000000000000000000000000000000dead` when no wallet is connected

Mock state resets when the dev server restarts (canvas) or localStorage is cleared
(vault). It is not durable and not safe for a multi-instance serverless deployment.

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

## Contract adapter

Everything contract-related lives in `src/lib/contract.ts`:

- ABIs: `abi/PixelFunVault.json`, `abi/ERC20.json` (placeholder ERC20 set)
- addresses and chain from `src/config/chains.ts`
- chunked `getPixels` reader, log reader, token helpers
- wagmi read configs for decimals, balances, allowance, `PRICE` and `MAX_BATCH`
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

Verified in this stage: `typecheck`, `lint`, `build`, mock `/api/canvas` payload
(262,144 bytes, 3,126 seeded pixels), mock tap → Paint → pixel byte update,
mock deposit/faucet, undo, zoom, and the not-deployed state.

## Deploy to Vercel

1. Push the repository and import it into Vercel.
2. Add the env vars from `.env.example` (Project → Settings → Environment Variables).
   `NEXT_PUBLIC_*` vars are inlined at build time; redeploy after changing them.
   `MOCK_MODE` is read when the page is built and by the API at request time, so set
   it before the build and keep it consistent across build and runtime.
3. Deploy. No database, cron, or serverless storage is required.
4. The canvas route runs as a Node serverless function. RPC env values are public
   endpoints; there are no secrets in this stage.

## Stage 2/3 remaining

- Stage 2: header stats (`totalPixelsPainted`, burned), current/past boards,
  countdown, rank vs `MIN_PIXELS`, WL badges and CSV/copy export.
- Stage 3: About + Proof pages, PNG export, X share, OG image, favicon, tests, final
  deploy notes.

See [ASSUMPTIONS.md](ASSUMPTIONS.md) for the interface assumptions and open items.
