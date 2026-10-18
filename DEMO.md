# PixelFun demo checklist

Use this after `PixelFunVault` and the IMD token are live. Record every demo
transaction hash; they become the public proof on `/proof`.

## 0. Configure

```bash
MOCK_MODE=false
NEXT_PUBLIC_CHAIN_ID=4663
NEXT_PUBLIC_RPC_URL=https://rpc.mainnet.chain.robinhood.com
NEXT_PUBLIC_EXPLORER_URL=https://robinhoodchain.blockscout.com
NEXT_PUBLIC_VAULT_ADDRESS=0x...
NEXT_PUBLIC_IMD_ADDRESS=0x...
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

Then run the read-only checks before sending anything:

```bash
npm run check:abi
npm run typecheck
npm test
npm run build
npm run smoke
```

`check:abi` must pass against the final ABI. `smoke` must print all `PASS` lines
for `PRICE`, `WIDTH`, `HEIGHT`, `MIN_PIXELS`, `EPOCH_START`, `currentEpoch`,
`totalPixelsPainted`, one `getPixels` chunk and `getBoard(currentEpoch)`.

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
   decreased by the same amount.

## 3. Paint a small image

1. Choose **Draw**, pick a color, and paint a recognizable 8×8 to 16×16 mark.
2. Check the cost bar: pixels × `PRICE` in IMD.
3. Press **Paint** and confirm the transaction.
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
  contractAddress: "0x...",
  explorerUrl: "https://robinhoodchain.blockscout.com/address/0x...?tab=contract",
  imdLaunchNumber: "...",
  imdJobUrl: "https://...",
  auditReportUrl: "https://...",
  deployedUnchanged: true,
  demoTxUrls: [
    "https://robinhoodchain.blockscout.com/tx/0x...", // approval (optional)
    "https://robinhoodchain.blockscout.com/tx/0x...", // deposit
    "https://robinhoodchain.blockscout.com/tx/0x...", // paint
  ],
  xAccountUrl: "https://x.com/...",
  repoUrl: "https://github.com/...",
};
```

Only set `deployedUnchanged: true` after comparing the deployed bytecode with the
audited build. Empty fields are hidden on `/proof`; leave unknown values out rather
than guessing.

## 6. Final verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

- Open `/`, `/leaderboard`, `/about` and `/proof` at 375px and desktop widths in both
  light and dark themes.
- Confirm `/proof` links resolve to the correct explorer pages and that the live
  totals match the explorer reads.
- Confirm the OG preview at `/og.png` and the X share intent include the production
  site URL.
- Keep the demo wallet funded only with what the demo needs.
