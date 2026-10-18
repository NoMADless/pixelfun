# PixelFun — Stages 1–4 assumptions

## Stage selection

The original prompt contained the literal placeholder `<STAGE>` rather than a
number. Since the repository was empty, **Stage 1** was built first, then Stage 2
and Stage 3 were run explicitly.

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

- `abi/PixelFunVault.json` is now the **real** `abi` array extracted from
  `out/PixelFun.sol/PixelFun.json` in `identity-md-launches/launch-2148-dsa`
  (commit `e880bd5`, solc 0.8.26). All calls still go through
  `src/lib/contract.ts`, and `npm run check:abi` verifies 33 required entries.
- The real signatures differ from the placeholder: `getPixels(uint256,uint256)`,
  epoch helpers/constants are `uint256`, `pixelsPaintedIn` returns `uint32`, and
  `totalBurned`, `totalDeposited`, `BURN_ADDRESS` and `MAX_READ_SLOTS` exist.
- `paint(ids, colors)` uses **palette indexes 0..31**. Storage uses 1 byte per
  pixel where `0 = unpainted` and `1..32 = palette index + 1`. This follows the
  interface note in the prompt; if the final contract expects storage indexes in
  `paint`, only the adapter/encode path changes.
- `getPixels(startSlot, slotCount)` returns exactly `slotCount × 32` bytes (verified
  on Anvil). The adapter throws on a length mismatch rather than silently
  rendering a skewed canvas. Chunks default to 1024 slots and are clamped to the
  contract's `MAX_READ_SLOTS` at runtime, so the full canvas is 8 calls.
- `MAX_BATCH` is read from the contract (`uint256`, converted to a number). The UI
  falls back to 100 only while the read is loading. `PRICE` is read from the
  contract for cost display; if it reverts, the app computes
  `5 * 10^(decimals-3)` from the token's `decimals()`.
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

- Default chunk size is 1024 slots (=32,768 pixels, 8 calls for the whole canvas),
  concurrency 4, 2 retries, clamped to `MAX_READ_SLOTS` read from the contract.
  `CANVAS_CHUNK_SLOTS` controls the server route; `NEXT_PUBLIC_CANVAS_CHUNK_SLOTS`
  controls the browser's direct RPC fallback.
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

- Stages 1–3 implement Canvas, Leaderboard, About and Proof, PNG export, X share,
  OG/Twitter metadata, favicons, skeletons, empty states and route error boundaries.
- “Tap or hover shows x, y and the color” is implemented locally from the canvas
  bytes. Last-painter metadata is not shown; the contract reads in the specified
  interface do not include a per-pixel painter lookup beyond the board.
- Tap paints in both Move and Draw modes. One-finger drag pans in Move mode and
  paints a line in Draw mode. Shift-drag paints on desktop. This resolves the
  prompt's overlap between drag-to-pan and drag-to-paint.
- A first finger in a two-finger pinch can place one pixel in Draw mode; pinch
  starts on the second pointer. Accepted for this stage.
- Each paint batch is estimated with `eth_estimateGas`; the UI adds a 20% buffer
  and sends an explicit `gas` limit. Out-of-gas errors get a specific message.
  Other wallet/revert errors are surfaced in the toast/step UI with explorer links.
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

## Stage 3 decisions

- The rank-gap rule treats a board as full when it has at least `BOARD_SIZE`
  entries. On a full board the target is `max(MIN_PIXELS, lowestCount + 1)`. The
  extra `+1` is required because the contract rejects ties. A viewer whose rank is
  inside the top 66 gets a gap of 0.
- About reads live `PRICE`, token decimals, round length and burned totals from
  `/api/stats`; the 0.005 IMD copy is only a fallback while the read is loading or
  the vault is not configured. “330 NFTs = 5 rounds × 66” is product copy, not a
  contract read.
- `src/config/proof.ts` records the known launch number `2148`, the
  `launch-2148-dsa` repo URL, the vault and its explorer page, the deploy tx and
  block, the verified source commit, the bytecode match and the seven labelled
  demo transactions. The audit report stays unset because IMD's verifier is not a
  third-party audit, and the X account stays unset until it exists. Mock-mode
  numbers on `/proof` are labeled demo data.
- PNG export renders the on-chain canvas bytes at 4× with nearest-neighbour
  scaling. Draft pixels are excluded so the downloaded image is the canonical
  canvas, not a private preview. The X intent uses the resolved public origin: the
  server-rendered `href` comes from `resolveSiteUrl()`, and the click handler
  rewrites it to `window.location.origin`. There is no owned custom domain, so the
  live origin is the Vercel production host.
- OG image, favicon PNG/ICO and apple-touch icon are generated as static files by
  `scripts/generate-assets.ts`, so no runtime image service or font fetch is needed.
- Error boundaries use Next 16's `retry` prop. Each route has a boundary; the root
  `global-error.tsx` handles a root-layout failure.
- Environment validation runs in `instrumentation.ts`. A production server throws
  if `MOCK_MODE=false` and required addresses are missing; development logs the same
  list and keeps the not-deployed UI. `PIXELFUN_ALLOW_UNDEPLOYED=1` intentionally
  downgrades the production failure for preview hosting.
- The `/api/canvas` shared cache is per server instance. It coalesces concurrent
  reads and serves a 3s snapshot; Vercel's CDN cache is still the outer layer. A
  multi-instance deployment can perform one read per instance per 3s.
- Unit tests cover pure logic only. Wallet writes, RPC reads and visual rendering
  are not unit-tested; they are exercised manually or with the read-only smoke
  script against a deployed vault.

## Stage 4 decisions

- The contract repo is cloned next to this repo (`../launch-2148-dsa`) and its
  compiled artifact is the source of truth. `forge build` is required before the
  local e2e suite; `PIXELFUN_CONTRACT_REPO` overrides the path.
- The local e2e suite deploys the real `PixelFun` plus the contract repo's
  `CanvasToken` as a mock IMD, funding Anvil's public test accounts only. It runs
  at 18 and 6 decimals and never touches a real network.
- `PRICE()` is readable on a fresh deployment (verified for 18/6 decimals). It does
  revert for a token with fewer than 3 decimals, so the app keeps
  `priceFromDecimals()` as a tested fallback; for `< 3` decimals the price is shown
  as unavailable rather than invented.
- `totalBurned()` is preferred for the burned stat. `totalPixelsPainted × PRICE`
  remains as a fallback for an RPC that cannot serve the new getter.
- 100 pixels with a full board measured 2,712,676 gas, under the ~3M threshold, so
  the default batch stays at the contract's `MAX_BATCH = 100`; there is no 50-pixel
  default or advanced toggle.
- `NEXT_PUBLIC_LOCAL_DEV=true` adds a dev connector that signs with the first
  well-known Anvil private key (a public test key) and forwards other RPC calls to
  `NEXT_PUBLIC_RPC_URL`. Import throws when the chain id is not 31337; a production
  build with the flag and chain 4663 was verified to exit 1. It is never enabled in
  production deployments.
- `NEXT_PUBLIC_*` values must be read with literal `process.env.NEXT_PUBLIC_X`
  access. The previous computed lookup silently fell back to mainnet in the browser
  bundle; this was found and fixed during the local browser check.
- The browser check used `anvil --chain-id 31337`, the fixture in
  `scripts/local-e2e/fixture.ts`, and the dev connector. Deposit (approve and
  deposit), one paint with the gas estimate, full withdraw, live updates from
  another wallet, leaderboard/countdown, About and `/proof` were exercised against
  that chain. The fixture's `.env.local` was restored afterwards.
- `CONTRACT_REVIEW.md` reports findings only; the contract source was not modified.
  `npm run smoke` still cannot be proven against the real vault because IMD has not
  deployed it in this environment.

## Stage 5: real IMD fork test

- The fork suite (`npm run e2e:fork`) is opt-in. It reads `ROBINHOOD_RPC_URL` and
  skips with exit 0 when it is unset, so a normal `npm test`/CI run never depends on
  a public RPC. The official RPC was reachable from this machine; no alternate
  endpoint was needed.
- The token `0x5F7Bb59365ce557C26dbcAa4EE9d39A4b95B7127` is **not source-verified**
  on Blockscout or Sourcify. Its facts were established with `eth_call`,
  `eth_getCode`, `eth_getStorageAt`, runtime-selector scanning and fork
  transactions. That is enough to test the paths PixelFun uses, not a substitute
  for auditing the token.
- IMD is treated as a LayerZero v2 OFT because `token()` returns itself, `endpoint()`
  is set, `sharedDecimals()` is 6 and `decimalConversionRate()` is `1e12`. The
  source is not available, so this classification is behavioral, not a source
  claim. Local supply can change through LayerZero messages even though no public
  `mint`/`burn` selector is exposed.
- The owner is a single EOA (`0x047F606fD5b2BaA5f5C6c4aB8958E45CB6B054B7`) with a
  recipient blocklist. The fork test impersonated that owner to call
  `setBlocked(address,bool)` and then unblocked every address. No real owner key or
  real transaction was used.
- The blocklist is recipient-side. Blocking a painter stops a withdrawal **to** that
  painter but does not stop the painter from spending an existing vault balance on
  a paint, because the token transfer is `vault → dead`. An earlier test assumed
  otherwise; the suite was corrected and the behavior is recorded in
  [FORK_TEST.md](FORK_TEST.md).
- The fork suite uses a publicly visible EOA holder from the top-holder list,
  verifies that it has no code, a balance of at least 2 IMD and is not blocked, then
  impersonates it on the fork. `IMD_HOLDER` overrides the list. If all listed
  holders become unusable, the suite fails with a clear error rather than guessing.
- The fork block and gas numbers in [FORK_TEST.md](FORK_TEST.md) are from the
  2026-10-18 run at block `91,614,538`. The fork board was not full, so its
  100-pixel gas (2,517,034) is lower than the full-board local number (2,712,676).
- `setV4Config(address,address,bool)` and `poolManager()` exist; `poolManager()`
  read zero at the test block. Their semantics are not exercised, and an unlisted
  admin function cannot be ruled out without verified source.
- The UI copy now says the pixel payment is **sent to the dead address** and is a
  transfer, not a supply burn. Contract field names (`totalBurned`, `BURN_ADDRESS`,
  the `burned` event field) and the `/api/stats` `burned` key are unchanged for ABI
  and API compatibility; user-facing labels explain them.
- No contract source was modified. The fork suite only deploys the existing
  compiled artifact to a local Anvil fork.
- The recommendation is a contract-integration **GO**. The announcement hold was
  the IMD owner's blocklist power: it is now disclosed and accepted, and the owner
  confirmed in writing that the vault, `0x…dEaD` and participants will not be
  blocklisted. That was a product/trust decision, not a code result.

## Deployment

- `NEXT_PUBLIC_*` values are inlined at build time. Redeploy after changing them.
- Vercel caches `/api/canvas` for 3s, `/api/stats` for 4s, live public boards for
  4s and ended public boards for an hour. No database, cron or persistent storage
  is used.
- Public env vars contain only contract/RPC/explorer/WalletConnect-project values;
  there are no secrets in this stage.

## Live deployment (2026-10-18)

- The vault address `0x30da521f63553ec3ea2dbb82c30581c00ccf9009`, deploy tx
  `0xd7c0e30b…b72523`, block 91,565,987, constructor args and commit `e880bd5`
  come from IMD's launch receipt. The address, deploy tx, constructor args and
  immutables were re-read from the RPC, not trusted from the receipt.
- `npm run check:bytecode` masks the 12 immutable references from the build
  artifact's `immutableReferences` before comparing, and locates the creation
  code inside the deploy factory calldata rather than assuming a direct
  `CREATE`. The deploy tx targets factory `0x9c9d2fcb…47265e`, so its receipt
  has no `contractAddress`; the vault address comes from the receipt.
- The explorer is `https://robin.etherscan.io`. Address, tx and token pages all
  returned HTTP 200 and the expected content; the app uses `/address/…`,
  `/tx/…` and `/token/…` respectively. Etherscan's contract page is
  JavaScript-rendered and its API requires a key, so **source verification on
  the explorer was not confirmed**; the site says “contract page” and points at
  the published commit instead of claiming “verified source”.
- “IMD verification gates passed” refers to the token launcher's own verifier
  0.1.0 (seven named gates). It is not a third-party audit, and the UI says so.
  The deploy calldata carries eight 32-byte artifact hashes; only the seven named
  gates are shown, because that is what the receipt states.
- Round timing is derived entirely from the contract: `EPOCH_START = 1792305520`
  (`2026-10-18T06:38:40Z`), `EPOCH_LENGTH = 259200`, so epoch 0 ends
  `2026-10-21T06:38:40Z`. The live `/api/stats` response matched those values and
  `epochEnd - epochStart = 259200`.
- `npm run check:bytecode` needs `PIXELFUN_DEPLOY_TX` for the creation-code check;
  without it, that one check is reported as skipped. It reads the artifact from
  `PIXELFUN_CONTRACT_REPO` (default `../launch-2148-dsa`).
