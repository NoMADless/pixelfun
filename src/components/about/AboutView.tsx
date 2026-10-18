"use client";

import Link from "next/link";
import { CONTRACTS_CONFIGURED, VAULT_ADDRESS, IMD_ADDRESS, explorerAddressUrl } from "@/config/chains";
import { useStats } from "@/lib/hooks/useLeaderboard";
import { formatToken } from "@/lib/format";
import { useRuntimeConfig } from "@/lib/runtime";
import { TOKEN_SYMBOL, PRICE_DISPLAY } from "@/shared/palette";
import { formatDurationSeconds } from "@/shared/time";

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
          {TOKEN_SYMBOL}, paint them, and the payment is burned at paint time. Every read in this
          app goes straight to the vault contract — there is no database, indexer or backend
          state.
        </p>
        <p className="pixel-font mt-5 border-2 border-ink bg-ink px-3 py-3 text-[10px] leading-relaxed text-bg sm:text-[12px]">
          No owner. No admin. No upgrades. Fully on-chain.
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
            burned on every paint.
          </p>
        </div>
        <div className="pixel-panel p-3">
          <p className="text-[8px] font-bold uppercase tracking-wider text-muted">Round length</p>
          <p className="pixel-font mt-1 text-[12px]">{roundLength}</p>
          <p className="mt-1 text-[9px] leading-relaxed text-muted">
            The top {boardSize} painters each round earn a whitelist spot.
          </p>
        </div>
        <div className="pixel-panel p-3">
          <p className="text-[8px] font-bold uppercase tracking-wider text-muted">Burn so far</p>
          <p className="pixel-font mt-1 text-[12px] text-accent">
            {burned ?? (statsQuery.isLoading ? "…" : "—")}
          </p>
          <p className="mt-1 text-[9px] leading-relaxed text-muted">
            {TOKEN_SYMBOL} destroyed by painting, read from chain.
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
              lock-up and no admin who can move it.
            </p>
          </article>
          <article className="pixel-panel p-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wide">2 · Paint a pixel</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Each pixel costs {price} {TOKEN_SYMBOL}. The vault burns {price} {TOKEN_SYMBOL} at
              paint time and writes your color into contract storage. Large drafts are split into
              multiple transactions at <code className="font-mono">MAX_BATCH</code>.
            </p>
          </article>
          <article className="pixel-panel p-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wide">3 · Rounds and WL</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Rounds are {roundLength} long. The top {boardSize} painters by pixel count earn the
              whitelist. WL badges are provisional until the round ends and{" "}
              <code className="font-mono">epochEnded</code> is true. Ties do not earn a spot.
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
            <code className="font-mono">getBoard</code> and the burn events.
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
            <summary className="cursor-pointer text-[11px] font-bold">What is burned?</summary>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              The full pixel price in {TOKEN_SYMBOL}. It is not sent to a treasury or team wallet;
              the vault burns it in the paint transaction. The site displays cumulative burned{" "}
              {TOKEN_SYMBOL} from <code className="font-mono">totalPixelsPainted × PRICE</code>.
            </p>
          </details>
          <details className="border-2 border-line bg-panel p-3">
            <summary className="cursor-pointer text-[11px] font-bold">
              Can anyone take my vault balance?
            </summary>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              No. The vault has no owner, admin, pause or upgrade path. Your balance can only be
              spent by your own paint calls or returned to you through withdraw. Nobody else can
              move it.
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
