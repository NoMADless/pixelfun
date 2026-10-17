# PixelFun — Stage 1 assumptions

## Stage selection

The prompt contained the literal placeholder `<STAGE>` rather than a number. Since
the repository was empty, **Stage 1** was the only stage that could produce a
testable app. Stages 2 and 3 are not implemented yet.

## Network verification

- Chain ID: **4663** (`0x1237`). This was confirmed live:
  `curl` → `eth_chainId` on `https://rpc.mainnet.chain.robinhood.com` returned
  `{"result":"0x1237"}`.
- Explorer: `https://robinhoodchain.blockscout.com` returned HTTP 200.
- RPC: `https://rpc.mainnet.chain.robinhood.com`.
- Official docs (`docs.robinhood.com/chain/connecting`,
  `docs.robinhood.com/chain/add-network-to-wallet`) could not be fetched as full
  pages from this environment because of TLS interception. The values were
  cross-checked against official search-result snippets and the live RPC/explorer.
- Native gas token is ETH. Only one chain is configured in Stage 1.

## Contract/ABI

- `abi/PixelFunVault.json` is a **placeholder** built from the expected interface.
  The final swarm ABI wins. All calls go through `src/lib/contract.ts`.
- `paint(ids, colors)` uses **palette indexes 0..31**. Storage uses 1 byte per
  pixel where `0 = unpainted` and `1..32 = palette index + 1`. This follows the
  interface note in the prompt; if the final contract expects storage indexes in
  `paint`, only the adapter/encode path changes.
- `getPixels(startSlot, slotCount)` is assumed to return exactly
  `slotCount × 32` bytes. The adapter throws on a length mismatch rather than
  silently rendering a skewed canvas.
- `MAX_BATCH` is read from the contract. The UI falls back to 100 only while the
  read is loading. `PRICE` is read from the contract for cost display.
- Token decimals are read from the IMD contract (`decimals()`), never hardcoded for
  real mode. Mock mode uses 18 decimals for its fake token.
- `getBoard`, `pixelAt`, epoch reads, `BOARD_SIZE`, `MIN_PIXELS`, `totalPixelsPainted`
  and `isWhitelisted` are present in the placeholder ABI but are not used by the
  Stage 1 UI. They are ready for Stage 2.
- There is no owner, admin, pause or upgrade UI.

## Mock mode

- `MOCK_MODE=true` is read on the server and passed into the client via a runtime
  context. The app does not require `NEXT_PUBLIC_MOCK_MODE`.
- The mock canvas is seeded with a "PIXELFUN" wordmark, frame, heart and speckles,
  stored in server-process memory. `/api/mock/paint` accepts the same ids/colors and
  updates it. It resets on server restart and is not shared across serverless
  instances.
- The mock paint endpoint is disabled when `MOCK_MODE` is off.
- The mock vault lives in `localStorage` under `pixelfun:mock-vault:v1`, starts at
  50 IMD per address and has a +100 faucet. Deposit/withdraw are simulated. The
  fake wallet/vault cards show the same demo balance in Stage 1.
- With no wallet, mock painting uses
  `0x000000000000000000000000000000000000dead`.
- Mock mode is for local/demo testing, not durable production use.

## Canvas loading

- Default chunk size is 512 slots (=16,384 pixels, 16 calls for the whole canvas),
  concurrency 4, 2 retries. `CANVAS_CHUNK_SLOTS` controls the server route;
  `NEXT_PUBLIC_CANVAS_CHUNK_SLOTS` controls the browser's direct RPC fallback.
- The initial full read establishes the last processed block. Live polling starts
  from the following block every 4s. A full resync runs every 60s and on tab
  visibility/focus. A reorg inside the polling gap is corrected by the next full
  resync.
- `/api/canvas` caches for 3s at the CDN (`stale-while-revalidate=30`). This means a
  paint can take a few seconds to appear for other visitors; the painter gets an
  immediate local update after confirmation.
- The client falls back to direct RPC reads if `/api/canvas` is unavailable. The RPC
  endpoint must allow browser CORS for that fallback; the API route is the primary
  path and always works server-side.

## UI scope

- Stage 1 implements Canvas only. There are no Leaderboard, About or Proof routes
  yet, and no PNG export/share/OG image.
- “Tap or hover shows x, y and the color” is implemented locally from the canvas
  bytes. Last-painter metadata is a Stage 2 concern.
- Tap paints in both Move and Draw modes. One-finger drag pans in Move mode and
  paints a line in Draw mode. Shift-drag paints on desktop. This resolves the
  prompt's overlap between drag-to-pan and drag-to-paint.
- A first finger in a two-finger pinch can place one pixel in Draw mode; pinch
  starts on the second pointer. Acceptable for Stage 1.
- Gas is not estimated client-side; wallet errors and failed/reverted transactions
  are surfaced in the toast/step UI with explorer links.

## Deployment

- `NEXT_PUBLIC_*` values are inlined at build time. Redeploy after changing them.
- Vercel caches `/api/canvas` at the CDN for 3s. No database, cron or persistent
  storage is used.
- Public env vars contain only contract/RPC/explorer/WalletConnect-project values;
  there are no secrets in this stage.
