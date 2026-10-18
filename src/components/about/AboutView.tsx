"use client";

import Link from "next/link";
import { CONTRACTS_CONFIGURED, VAULT_ADDRESS, IMD_ADDRESS, explorerAddressUrl } from "@/config/chains";
import { useStats } from "@/lib/hooks/useLeaderboard";
import { formatToken } from "@/lib/format";
import { useRuntimeConfig } from "@/lib/runtime";
import { TOKEN_SYMBOL, PRICE_DISPLAY } from "@/shared/palette";
import { formatDurationSeconds } from "@/shared/time";

const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

function AddressLink({ label, address }: { label: string; address: string | null }) {
  if (!address) return <span className="text-muted">{label}: configured after deploy</span>;
  return (
    <a
      href={explorerAddressUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono underline underline-offset-2 hover:text-accent"
    >
      {label}: {address}
    </a>
  );
}

export function AboutView() {
  const { mockMode } = useRuntimeConfig();
  const enabled = mockMode || CONTRACTS_CONFIGURED;
  const statsQuery = useStats(enabled);
  const stats = statsQuery.data;
  const price =
    stats?.price !== undefined && stats.decimals !== undefined
      ? formatToken(BigInt(stats.price), stats.decimals, 6)
      : PRICE_DISPLAY;
  const burned =
    stats?.burned !== undefined
      ? formatToken(BigInt(stats.burned), stats.decimals, 4)
      : null;
  const roundLength = stats ? formatDurationSeconds(Number(stats.epochLength)) : "3 days";
  const boardSize = stats?.boardSize ?? 66;
  const minPixels = stats?.minPixels ?? 20;
  const nftSupply = 5 * boardSize;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-3 py-4 sm:py-6">
      <header className="pixel-panel-strong p-4 sm:p-6">
        <p className="text-[8px] font-bold uppercase tracking-wider text-muted">PX / ABOUT</p>
        <h1 className="pixel-font mt-2 text-lg leading-relaxed sm:text-2xl">
          A SHARED 512×512 CANVAS.
          <br />
          <span className="text-accent">NO MIDDLEMAN.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          PixelFun is a collaborative pixel canvas on Robinhood Chain. You buy pixels with{" "}
          {TOKEN_SYMBOL}, paint them, and the vault sends the full payment to the dead address —
          permanently out of circulation. Every read in this app goes straight to the vault
          contract: there is no database, indexer or backend state.
        </p>
        <p className="pixel-font mt-5 border-2 border-ink bg-ink px-3 py-3 text-[10px] leading-relaxed text-bg sm:text-[12px]">
          The vault has no owner, admin, pause or upgrade. Fully on-chain.
        </p>
        <p className="mt-3 border-2 border-line bg-panel p-3 text-[10px] leading-relaxed text-muted">
          <span className="font-bold uppercase tracking-wide text-ink">Token power, stated plainly.</span>{" "}
          IMD is not ownerless: the fork test confirmed its owner can block an address from
          receiving IMD. If that owner blocked the vault, the dead address or a user, deposits,
          paints or withdrawals would revert. PixelFun cannot override the token&apos;s own admin
          powers.
        </p>
      </header>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="pixel-panel p-3">
          <p className="text-[8px] font-bold uppercase tracking-wider text-muted">Price per pixel</p>
          <p className="pixel-font mt-1 text-[12px]">
            {price} <span className="text-accent">{TOKEN_SYMBOL}</span>
          </p>
          <p className="mt-1 text-[9px] leading-relaxed text-muted">
            Read from <code className="font-mono">PRICE</code>
            {stats?.decimals !== undefined ? ` and ${stats.decimals} token decimals` : ""}. 100%
            sent to the dead address on every paint.
          </p>
        </div>
        <div className="pixel-panel p-3">
          <p className="text-[8px] font-bold uppercase tracking-wider text-muted">Round length</p>
          <p className="pixel-font mt-1 text-[12px]">{roundLength}</p>
          <p className="mt-1 text-[9px] leading-relaxed text-muted">
            The top {boardSize} painters each round earn a whitelist spot. Rank is paid paints;
            repainting a pixel counts again.
          </p>
        </div>
        <div className="pixel-panel p-3">
          <p className="text-[8px] font-bold uppercase tracking-wider text-muted">
            Paid to the dead address
          </p>
          <p className="pixel-font mt-1 text-[12px] text-accent">
            {burned ?? (statsQuery.isLoading ? "…" : "—")} {TOKEN_SYMBOL}
          </p>
          <p className="mt-1 text-[9px] leading-relaxed text-muted">
            The contract&apos;s <code className="font-mono">totalBurned()</code> counter. It is a
            transfer to {" "}
            <a
              href={explorerAddressUrl(DEAD_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-accent"
            >
              0x…dEaD
            </a>
            , not a reduction of IMD totalSupply.
          </p>
        </div>
      </section>

      <section className="mt-5 space-y-4">
        <h2 className="pixel-font text-[11px]">HOW IT WORKS</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <article className="pixel-panel p-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wide">1 · Deposit into the vault</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Approve {TOKEN_SYMBOL} once, then deposit any amount into the vault. Your balance is
              yours: withdrawing returns only what you have not spent on pixels. There is no
              lock-up and no vault admin who can move it.
            </p>
          </article>
          <article className="pixel-panel p-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wide">2 · Paint a pixel</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Each pixel costs {price} {TOKEN_SYMBOL}. The vault transfers {price} {TOKEN_SYMBOL}
              per pixel to the dead address and writes your color into contract storage. That is a
              transfer, not a supply burn: IMD <code className="font-mono">totalSupply</code> is
              unchanged. Large drafts are split into multiple transactions at{" "}
              <code className="font-mono">MAX_BATCH</code>.
            </p>
          </article>
          <article className="pixel-panel p-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wide">3 · Rounds and WL</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Rounds are {roundLength} long. Rank is the number of paid paints: IMD sent to the
              dead address divided by 0.005. Painting the same pixel again counts again, and every
              paint costs the same, so duplicates do not make points cheaper. A spot needs at
              least {minPixels} paints; the top {boardSize} qualify. WL badges are provisional
              until the round ends and <code className="font-mono">epochEnded</code> is true.
              Ties do not earn a spot.
            </p>
          </article>
          <article className="pixel-panel p-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wide">4 · 330 NFTs</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {nftSupply} = 5 rounds × {boardSize} whitelist spots. The art is the canvas itself;
              provenance is the contract, not a metadata server.
            </p>
          </article>
        </div>

        <div className="border-2 border-line bg-panel p-3 text-[10px] leading-relaxed text-muted">
          <p className="font-bold uppercase tracking-wide text-ink">Verify it yourself</p>
          <p className="mt-1">
            Every number on this site comes from public contract reads. Use the explorer to inspect
            the verified source, <code className="font-mono">PRICE</code>,{" "}
            <code className="font-mono">totalPixelsPainted</code>,{" "}
            <code className="font-mono">getBoard</code>, the <code className="font-mono">Painted</code>{" "}
            events and the dead address balance.
          </p>
          <div className="mt-2 flex flex-col gap-1">
            <AddressLink label="Vault" address={VAULT_ADDRESS} />
            <AddressLink label="IMD" address={IMD_ADDRESS} />
          </div>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="pixel-font text-[11px]">FAQ</h2>
        <div className="mt-2 space-y-2">
          <details className="border-2 border-line bg-panel p-3" open>
            <summary className="cursor-pointer text-[11px] font-bold">
              Where does the payment go?
            </summary>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              The full pixel price in {TOKEN_SYMBOL} goes to the dead address{" "}
              <a
                href={explorerAddressUrl(DEAD_ADDRESS)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-accent"
              >
                {DEAD_ADDRESS}
              </a>{" "}
              in the paint transaction. It is not sent to a treasury or team wallet. This is a
              transfer, not a supply burn: IMD <code className="font-mono">totalSupply</code> does
              not change. The site shows the contract&apos;s own{" "}
              <code className="font-mono">totalBurned()</code> counter for payments made.
            </p>
          </details>
          <details className="border-2 border-line bg-panel p-3">
            <summary className="cursor-pointer text-[11px] font-bold">
              Can anyone take my vault balance?
            </summary>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              The vault has no owner, admin, pause or upgrade path. Your balance can only be spent
              by your own paint calls or returned to you through withdraw. One caveat lives in the
              token itself: IMD has an owner with a recipient blocklist. If that owner blocked you,
              your withdraw transfer would revert until you were unblocked. The vault cannot
              override it.
            </p>
          </details>
          <details className="border-2 border-line bg-panel p-3">
            <summary className="cursor-pointer text-[11px] font-bold">
              How do I verify it on the explorer?
            </summary>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Open the vault address on the Robinhood Chain explorer and check the verified source,
              then read <code className="font-mono">PRICE</code>,{" "}
              <code className="font-mono">totalPixelsPainted</code>, and your address with{" "}
              <code className="font-mono">pixelsPaintedIn</code>. The{" "}
              <Link href="/proof" className="underline underline-offset-2 hover:text-accent">
                Proof page
              </Link>{" "}
              collects launch links and demo transactions once they are published.
            </p>
          </details>
          <details className="border-2 border-line bg-panel p-3">
            <summary className="cursor-pointer text-[11px] font-bold">
              How is rank calculated?
            </summary>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Rank is the number of paid paints. It equals the IMD you sent to the dead address
              divided by 0.005, because every paint costs exactly that. Painting the same pixel
              again counts as another paid paint and costs the same, so duplicates are not a
              cheaper way to climb. A round&apos;s whitelist needs at least {minPixels} paints and
              is final only after the round ends; ties do not earn a spot.
            </p>
          </details>
          <details className="border-2 border-line bg-panel p-3">
            <summary className="cursor-pointer text-[11px] font-bold">
              Why is my rank sometimes “—”?
            </summary>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              The contract exposes the top {boardSize} only. If you are below that cutoff, the app
              shows your pixel count and the pixels needed to enter the board instead of inventing
              a global rank.
            </p>
          </details>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/" className="pixel-btn pixel-btn-primary h-9 px-3 text-[10px]">
          Open the canvas
        </Link>
        <Link href="/leaderboard" className="pixel-btn h-9 px-3 text-[10px]">
          View the leaderboard
        </Link>
        <Link href="/proof" className="pixel-btn h-9 px-3 text-[10px]">
          Proof and launch details
        </Link>
      </div>
    </div>
  );
}
