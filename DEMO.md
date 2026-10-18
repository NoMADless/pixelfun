# PixelFun demo and go-live checklist

IMD has deployed `PixelFun` (launch `2148`): vault
`0x30da521f63553ec3ea2dbb82c30581c00ccf9009`, deploy tx `0xd7c0e30b…b72523` at
block 91,565,987. Record every demo transaction hash; they become the public
proof on `/proof`.

## 0. Configure and verify before launch

```bash
MOCK_MODE=false
NEXT_PUBLIC_CHAIN_ID=4663
NEXT_PUBLIC_RPC_URL=https://rpc.mainnet.chain.robinhood.com
NEXT_PUBLIC_EXPLORER_URL=https://robin.etherscan.io
NEXT_PUBLIC_VAULT_ADDRESS=0x30da521f63553ec3ea2dbb82c30581c00ccf9009
NEXT_PUBLIC_IMD_ADDRESS=0x5F7Bb59365ce557C26dbcAa4EE9d39A4b95B7127
PIXELFUN_DEPLOY_TX=0xd7c0e30bc98b22a71eff1aa35df2362f131a295cbc981c764c74fc0511b72523
CANVAS_CHUNK_SLOTS=1024
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

Before touching the live vault, run the real-token fork suite and the local suite
against the same compiled artifact and ABI:

```bash
ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com npm run e2e:fork
(cd ../launch-2148-dsa && forge build)
npm run check:bytecode
npm run check:abi
npm run e2e:local
npm test
npm run typecheck
npm run lint
```

`e2e:fork` must pass 121/121. It is read-only on Robinhood Chain and sends
impersonated transactions only on a local Anvil fork. Read
[FORK_TEST.md](FORK_TEST.md) before announcing: IMD has an owner who can block
recipients, including the vault and the dead address. The site says this in About;
the launch post must not call the payment a supply burn.

Then run the read-only live checks before sending anything:

```bash
npm run smoke
npm run build
```

`check:bytecode` must match the 6,921-byte runtime with immutables masked and find
the creation code in the deploy calldata. `check:abi` must pass 33/33
requirements. `e2e:fork` must end in `121/121 checks passed`; `e2e:local` must end
in `302/302 checks passed`. `smoke` must print all `PASS` lines for `imd()`,
`MIN_PIXELS = 20`, `PRICE = 0.005 IMD`, `WIDTH`/`HEIGHT`, `EPOCH_START`,
`currentEpoch = 0`, an empty epoch-0 board, `totalPixelsPainted = 0` and an
all-zero `getPixels` chunk.

## 0b. Deploy the website

1. Set `MOCK_MODE=false` and the env above in Vercel for both build and runtime.
2. Deploy. `NEXT_PUBLIC_*` values are inlined at build time.
3. Open `/` and confirm the header is not in Demo mode, the canvas renders and
   the round countdown is live.

Never set `NEXT_PUBLIC_LOCAL_DEV` in production. The build fails if it is set
with a chain other than 31337.

## 1. Prepare a demo wallet

- Use a dedicated demo wallet, not a personal or treasury wallet.
- Hold enough ETH for gas and enough IMD for the pixels.
- Open the site, connect the wallet, and switch to Robinhood Chain when prompted.
- Confirm the header shows the live round number and that the canvas is not in
  “Demo” mode.

## 2. Deposit IMD into the vault

1. Open **Vault** in the canvas toolbar.
2. Enter an amount and press **Deposit**.
3. Approve IMD if the wallet asks (approval is skipped when the allowance is
   sufficient).
4. Wait for both transactions to confirm and copy their hashes from the explorer:
   - approval tx: `0x...`
   - deposit tx: `0x...`
5. Confirm the Vault panel shows the deposited balance and the wallet balance
   decreased by the same amount. The deposit must credit exactly what arrived; any
   difference means the token charged a fee and the launch should stop.

## 3. Paint a small image

1. Choose **Draw**, pick a color, and paint a recognizable 8×8 to 16×16 mark.
2. Check the cost bar: pixels × `PRICE` in IMD.
3. Press **Paint** and confirm the transaction. The payment goes to the dead
   address `0x000000000000000000000000000000000000dEaD`; it is a transfer, not a
   supply burn.
4. Copy the paint transaction hash: `0x...`
5. Wait for confirmation. The toast links to the transaction and the local canvas
   should update immediately; another browser should see it after the next poll.
6. Optional: refresh the page, reconnect, and confirm the pixels persist.

If the draft exceeds `MAX_BATCH`, the UI sends several paint transactions. Record
each hash; the proof can list them as separate demo transactions.

## 4. Verify the board and rank

1. Open **Leaderboard**.
2. Confirm your address appears with the pixels from step 3 and a `WL*` badge if it
   is inside the top 66.
3. Confirm the “My rank” card shows your rank and, when outside the top 66, the
   exact pixels still needed to enter it.
4. If the round has ended, expand the past round and confirm the final WL badge.
5. Optional: download the CSV and verify it contains one lowercase address per line.

## 5. Record proof links

Fill the fields you actually have in `src/config/proof.ts`:

```ts
export const PROOF: ProofConfig = {
  contractAddress: "0x30da521f63553ec3ea2dbb82c30581c00ccf9009",
  explorerUrl: "https://robin.etherscan.io/address/0x30da521f63553ec3ea2dbb82c30581c00ccf9009#code",
  deployTxHash: "0xd7c0e30bc98b22a71eff1aa35df2362f131a295cbc981c764c74fc0511b72523",
  deployBlock: 91565987,
  imdLaunchNumber: 2148,
  imdJobUrl: "https://...",
  auditReportUrl: undefined, // IMD's verifier is not a third-party audit
  deployedUnchanged: true, // check:bytecode matched runtime and creation code
  demoTxUrls: [], // add approval, deposit and paint after the demo
  xAccountUrl: "https://x.com/...",
};
```

`deployedUnchanged` is already `true`: `npm run check:bytecode` matched the live
runtime with immutables masked and found the creation code in the deploy
calldata. Empty fields are hidden on `/proof`; leave unknown values out rather
than guessing, and never describe the IMD verification gates as a third-party
audit.

## 6. Final verification

```bash
npm run typecheck
npm run lint
npm test
npm run check:abi
npm run check:bytecode
npm run build
```

- Open `/`, `/leaderboard`, `/about` and `/proof` at 375px and desktop widths in both
  light and dark themes.
- Confirm `/proof` links resolve to the correct explorer pages and that the live
  totals match the explorer reads.
- Confirm the OG preview at `/og.png` and the X share intent include the production
  site URL.
- Keep the demo wallet funded only with what the demo needs.
