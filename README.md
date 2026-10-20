# PixelFun

A fully on-chain 512×512 collaborative pixel canvas on **Robinhood Chain** (Chain ID `4663`).

Paint any pixel for **0.005 IMD**; the vault sends the payment directly to the dead address (`0x000000000000000000000000000000000000dEaD`), and the top 66 painters of each 3-day round earn an NFT whitelist spot. There is no database, no indexer, and no backend state — the app is a static export that reads the canvas and leaderboard straight from the contract via public RPC.

---

## Live Links & Deployment

| Resource | Details |
| :--- | :--- |
| **Live App (IMD / IPFS)** | [pixelfun-fully-on-chain-pixel-ca.sites.imd.fun](https://pixelfun-fully-on-chain-pixel-ca.sites.imd.fun) |
| **Live App (Mirror)** | [pixelfun-beryl.vercel.app](https://pixelfun-beryl.vercel.app) |
| **IPFS CID** | `bafybeidbla63kstj6etc6u7umaklcqnp4hbe5j6o3f2phv65xkkrd3djsy` |
| **IMD Contract Launch** | [Launch #2148 (`7080a75d`)](https://explorer.imd.fun/jobs/7080a75d-d9a3-48da-a85c-9cb4e20a6f67) |
| **IMD Website Job** | [Job `f8653699`](https://explorer.imd.fun/jobs/f8653699-6793-4b9c-80d2-478a09004dc5?hired=build-website) |
| **PixelFun Vault** | [`0x30da521f63553ec3ea2dbb82c30581c00ccf9009`](https://robin.etherscan.io/address/0x30da521f63553ec3ea2dbb82c30581c00ccf9009#code) |
| **IMD Token (Robinhood Chain)** | [`0x5F7Bb59365ce557C26dbcAa4EE9d39A4b95B7127`](https://robin.etherscan.io/token/0x5F7Bb59365ce557C26dbcAa4EE9d39A4b95B7127) |
| **Deploy Transaction** | [`0xd7c0e30b…b72523`](https://robin.etherscan.io/tx/0xd7c0e30bc98b22a71eff1aa35df2362f131a295cbc981c764c74fc0511b72523) (Block `91,565,987`) |
| **Contract Repository** | [`identity-md-launches/launch-2148-dsa`](https://github.com/identity-md-launches/launch-2148-dsa/commit/e880bd5931c48ca32e7de751471a4506bd25e6e4) |

---

## How It Works

1. **Ownerless Vault** — Deposit IMD into the contract vault. Only you can spend your balance on pixels or withdraw unspent funds at any time. The contract has no owner, admin, pause, or upgrade path.
2. **On-Chain Canvas** — The 512×512 canvas (262,144 pixels, 32-color palette) is packed 32 pixels per storage slot. Every pixel painted transfers `0.005 IMD` to `0x…dEaD` (tracked on-chain via `totalBurned()`, a transfer to the dead address rather than an ERC-20 supply reduction).
3. **3-Day Rounds & Leaderboard** — Each 3-day epoch tracks the top 66 painters on-chain (minimum 20 pixels to enter). When a round ends, its board freezes automatically and serves as the whitelist for a future NFT mint.
4. **Zero Backend** — The browser loads the entire canvas in 8 chunked `getPixels` RPC calls, polls live `Painted` logs every 4 seconds, and queries round leaderboards directly from the contract.

---

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. By default, the app connects to the live Robinhood Chain deployment (`MOCK_MODE=false`). Set `MOCK_MODE=true` in `.env.local` to run an offline in-browser demo with a seeded canvas and a local faucet.

### Static Export (IPFS / Static Hosting)

```bash
npm run build     # outputs static site to out/
npm run preview   # serves out/ locally on http://localhost:3000
```

Live contract and chain parameters are baked in as defaults in `src/config/chains.ts`, so a zero-config `npm run build` works out of the box on IPFS or any static host.

---

## Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start Next.js development server |
| `npm run build` | Build static export into `out/` |
| `npm run preview` | Serve the static `out/` directory locally |
| `npm run typecheck` | Run TypeScript compiler checks (`tsc --noEmit`) |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest unit test suite |
| `npm run check:abi` | Verify `abi/PixelFunVault.json` against app requirements |
| `npm run check:bytecode` | Verify live on-chain bytecode matches compiled source |
| `npm run smoke` | Run read-only checks against the live contract |
| `npm run e2e:local` | Run 302-check local Anvil suite against the compiled contract |
| `npm run e2e:fork` | Run 121-check read-only Robinhood Chain fork suite |

---

## Documentation & Verification

- **[SUBMISSION.md](SUBMISSION.md)** — Hackathon submission overview, eligibility, and verified on-chain state
- **[CONTRACT_REVIEW.md](CONTRACT_REVIEW.md)** — Security review, bytecode verification, and trust assumptions
- **[FORK_TEST.md](FORK_TEST.md)** — Real-token fork test results (121/121 passed) and token admin analysis
- **[GAS.md](GAS.md)** — Measured gas costs for 1, 25, 50, and 100 pixel batches on a full leaderboard
- **[DEMO.md](DEMO.md)** — Go-live and verification checklist
