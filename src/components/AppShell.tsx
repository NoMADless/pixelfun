"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { StatsBar } from "./StatsBar";
import { ThemeToggle } from "./ThemeToggle";
import { WalletButton } from "./WalletButton";
import { explorerAddressUrl } from "@/config/chains";
import { useMounted } from "@/lib/hooks/useMounted";
import { useRuntimeConfig } from "@/lib/runtime";

const TABS = [
  { href: "/", label: "Canvas" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/about", label: "About" },
  { href: "/proof", label: "Proof" },
] as const;

/** Wallet yang membakar 0.1 IMD di kanvas; ditampilkan sebagai bukti partisipasi. */
const PROOF_WALLET = "0xC4a8Ea10819d341D19d1dFBBa7Bb0E0F2295d952";

function Logo() {
  return (
    <Link
      href="/"
      prefetch={false}
      className="flex shrink-0 items-center gap-2"
      aria-label="PixelFun home"
    >
      <span className="grid grid-cols-3 gap-[2px]" aria-hidden>
        {["#e43b44", "#f77622", "#fee761", "#63c74d", "#2ce8f5", "#68386c", "#b55088", "#ffffff", "#0099db"].map(
          (color, index) => (
            <span key={index} className="h-[6px] w-[6px]" style={{ backgroundColor: color }} />
          ),
        )}
      </span>
      <span className="pixel-font text-[13px] leading-none tracking-tight sm:text-sm">
        PIXEL<span className="text-accent">FUN</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { mockMode } = useRuntimeConfig();
  const mounted = useMounted();
  const pathname = usePathname();

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:border-2 focus:border-ink focus:bg-panel focus:px-3 focus:py-2 focus:text-[11px] focus:font-bold"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b-2 border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-3 py-2 sm:py-3">
          <Logo />
          <a
            href={explorerAddressUrl(PROOF_WALLET)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Paint wallet ${PROOF_WALLET} on the Robinhood Chain explorer`}
            className="max-w-full break-all border-2 border-line bg-panel px-2 py-1 font-mono text-[9px] font-bold tracking-tight text-ink sm:text-[11px]"
          >
            {PROOF_WALLET}
          </a>
          <span className="hidden border-2 border-line px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted sm:inline">
            Robinhood Chain · 512×512
          </span>
          {mockMode && (
            <span className="border-2 border-accent bg-accent/10 px-1.5 py-1 text-[9px] font-bold uppercase text-accent">
              Demo
            </span>
          )}
          <nav
            aria-label="Main"
            className="order-last flex w-full items-center gap-1 border-t-2 border-line pt-1.5 sm:order-none sm:ml-2 sm:w-auto sm:border-0 sm:pt-0"
          >
            {TABS.map((tab) => {
              const active =
                mounted &&
                (tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href));
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  className={`border-2 px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${
                    active
                      ? "border-ink bg-ink text-bg"
                      : "border-line text-muted hover:border-ink hover:text-ink"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          <span className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <WalletButton />
          </span>
        </div>
        <StatsBar />
      </header>
      <main id="main-content" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>
      <footer className="border-t-2 border-line px-3 py-3 text-center text-[10px] text-muted">
        <p>No database. No indexer. The canvas is read straight from Robinhood Chain.</p>
        <p className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
          <Link href="/about" prefetch={false} className="underline underline-offset-2 hover:text-ink">
            About
          </Link>
          <Link href="/proof" prefetch={false} className="underline underline-offset-2 hover:text-ink">
            Proof
          </Link>
          <Link
            href="/leaderboard"
            prefetch={false}
            className="underline underline-offset-2 hover:text-ink"
          >
            Leaderboard
          </Link>
        </p>
      </footer>
    </>
  );
}
