"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { WalletButton } from "./WalletButton";
import { useRuntimeConfig } from "@/lib/runtime";

function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="PixelFun home">
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

  return (
    <>
      <header className="sticky top-0 z-40 border-b-2 border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-3 py-2 sm:py-3">
          <Logo />
          <span className="hidden border-2 border-line px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted sm:inline">
            Robinhood Chain · 512×512
          </span>
          {mockMode && (
            <span className="border-2 border-accent bg-accent/10 px-1.5 py-1 text-[9px] font-bold uppercase text-accent">
              Demo
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <WalletButton />
          </span>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      <footer className="border-t-2 border-line px-3 py-3 text-center text-[10px] text-muted">
        No database. No indexer. The canvas is read straight from Robinhood Chain.
      </footer>
    </>
  );
}
