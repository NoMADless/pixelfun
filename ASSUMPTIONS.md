# PixelFun — Stages 1–2 assumptions

## Stage selection

The original prompt contained the literal placeholder `<STAGE>` rather than a
number. Since the repository was empty, **Stage 1** was built first, then **Stage 2**
was run explicitly. Stage 3 is not implemented yet.

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
- Native gas token is ETH. Only one chain is configured in Stages 1–2.

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
- Stage 2 uses `getBoard`, `epochStart`, `epochEnd`, `epochEnded`, `currentEpoch`,
  `pixelsPaintedIn`, `isWhitelisted`, `BOARD_SIZE`, `MIN_PIXELS`, `EPOCH_LENGTH` and
  `totalPixelsPainted` through the same adapter.
- `getBoard` is treated as already sorted descending, as specified. Rank is the
  array index + 1.
- Exact rank below the returned top 66 cannot be derived from these reads. The UI
  shows the viewer's pixel count and `—` for rank in that case rather than inventing
  a global rank.
- There is no owner, admin, pause or upgrade UI.

## Mock mode

- `MOCK_MODE=true` is read on the server and passed into the client via a runtime
  context. The app does not require `NEXT_PUBLIC_MOCK_MODE`.
- The mock canvas is seeded with a "PIXELFUN" wordmark, frame, heart and speckles,
  stored in server-process memory. `/api/mock/paint` accepts the same ids/colors and
  updates it. It resets on server restart and is not shared across serverless
  instances.
- The mock paint endpoint is disabled when `MOCK_MODE` is off.
- The mock leaderboard starts with two completed rounds and one live round. Epochs
  are three days long, the demo clock is anchored at server start, and board counts
  are synthetic. Mock paints add to the current board and to the cumulative
  `totalPixelsPainted` total, so the header and rank move after a paint.
- The mock vault lives in `localStorage` under `pixelfun:mock-vault:v1`, starts at
  50 IMD per address and has a +100 faucet. Deposit/withdraw are simulated. The
  fake wallet/vault cards show the same demo balance.
- With no wallet, mock painting uses
  `0x000000000000000000000000000000000000dead`. That address is seeded into the
  demo boards so the rank card is populated without a wallet.
- Mock mode is for local/demo testing, not durable production use. Refreshing the
  browser keeps localStorage but restarting the server resets canvas/boards.

## Leaderboard and epochs

- The countdown uses `epochEnd(currentEpoch)` as a Unix timestamp and the server's
  `serverTime` to remove constant client clock skew. If `epochEnd` has passed but
  `epochEnded` is still false, the UI says “awaiting finalization” rather than
  claiming the whitelist is final.
- WL badges for the live board are marked `WL*` and explicitly provisional. Only
  `epochEnded = true` enables the final WL label and past-round export.
- Past rounds are lazy-loaded when expanded. Loading every board for every past
  epoch on page load would create an RPC spike and defeat the no-indexer design.
- Past-round boards are public and cached at the CDN for an hour after `epochEnded`;
  requests that include a viewer address are `private, no-store` because they expose
  that wallet's rank and pixel count.
- CSV means one lowercase address per line, no header, with a trailing newline. It
  is intentionally not comma-separated; the format is for allowlist imports.
- The stats header and live board poll every 10 seconds. A paint by the current
  visitor updates locally immediately; other visitors see it on the next poll or
  canvas refresh.

## Canvas loading

- Default chunk size is 512 slots (=16,384 pixels, 16 calls for the whole canvas),
  concurrency 4, 2 retries. `CANVAS_CHUNK_SLOTS` controls the server route;
  `NEXT_PUBLIC_CANVAS_CHUNK_SLOTS` controls the browser's direct RPC fallback.
- The initial full read captures the block number **before** reading `getPixels`,
  so a paint that lands during the read is replayed from `Painted` logs instead of
  being skipped. Replaying an already-applied paint is idempotent.
- Live polling starts from that block + 1 every 4s. A full resync runs every 60s
  and on tab visibility/focus. A reorg inside the polling gap is corrected by the
  next full resync.
- `/api/canvas` caches for 3s at the CDN (`stale-while-revalidate=30`). This means a
  paint can take a few seconds to appear for other visitors; the painter gets an
  immediate local update after confirmation.
- The client falls back to direct RPC reads if `/api/canvas` is unavailable. The RPC
  endpoint must allow browser CORS for that fallback; the API route is the primary
  path and always works server-side.

## UI scope

- Stage 2 implements Canvas and Leaderboard. About, Proof, PNG export/share and OG
  images are still Stage 3.
- “Tap or hover shows x, y and the color” is implemented locally from the canvas
  bytes. Last-painter metadata is not shown; the contract reads in the specified
  interface do not include a per-pixel painter lookup beyond the board.
- Tap paints in both Move and Draw modes. One-finger drag pans in Move mode and
  paints a line in Draw mode. Shift-drag paints on desktop. This resolves the
  prompt's overlap between drag-to-pan and drag-to-paint.
- A first finger in a two-finger pinch can place one pixel in Draw mode; pinch
  starts on the second pointer. Accepted for this stage.
- Gas is not estimated client-side; wallet errors and failed/reverted transactions
  are surfaced in the toast/step UI with explorer links.
- The Paint button stays disabled until `PRICE`, token decimals and the vault
  balance have loaded, so a transaction cannot be sent with an unknown cost.
- Chain switching is lazy: deposit, withdraw and paint switch to Robinhood Chain
  before the transaction. Connecting a wallet never switches network silently.
- Header controls and the leaderboard gate on a `useMounted` flag so wallet state,
  the browser clock, and the active route do not change markup during hydration.
  The flag flips after the first effect/paint, not from `useSyncExternalStore`,
  which produced a production hydration mismatch in testing.
- The stats header is shown on every page and is hidden when neither mock mode nor
  a configured vault is available.

## Deployment

- `NEXT_PUBLIC_*` values are inlined at build time. Redeploy after changing them.
- Vercel caches `/api/canvas` for 3s, `/api/stats` for 4s, live public boards for
  4s and ended public boards for an hour. No database, cron or persistent storage
  is used.
- Public env vars contain only contract/RPC/explorer/WalletConnect-project values;
  there are no secrets in this stage.
