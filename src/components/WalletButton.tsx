"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { CHAIN_ID, WALLETCONNECT_PROJECT_ID } from "@/config/chains";
import { getErrorMessage, shortenAddress } from "@/lib/format";
import { useMounted } from "@/lib/hooks/useMounted";

function ConnectorIcon({ id }: { id: string }) {
  if (id.toLowerCase().includes("walletconnect")) return <span aria-hidden>📱</span>;
  if (id.toLowerCase().includes("injected")) return <span aria-hidden>🦊</span>;
  return <span aria-hidden>🔑</span>;
}

export function WalletButton() {
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connect, error, isPending, reset } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const showAccount = mounted && isConnected && Boolean(address);
  const wrongNetwork = showAccount && chainId !== CHAIN_ID;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className={`pixel-btn h-9 px-2.5 text-[11px] sm:px-3 ${
          wrongNetwork ? "border-accent text-accent" : ""
        }`}
      >
        {showAccount && address ? (
          <span className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 ${wrongNetwork ? "bg-accent" : "bg-pfgreen"}`}
              aria-hidden
            />
            <span className="font-mono">{shortenAddress(address, 3)}</span>
          </span>
        ) : (
          "Connect"
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Wallet"
          onClick={() => setOpen(false)}
        >
          <div
            className="pixel-panel-strong pf-rise w-full max-w-sm p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="pixel-font text-[11px]">
                {isConnected ? "WALLET" : "CONNECT"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="pixel-btn h-7 w-7 text-xs"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {showAccount && address ? (
              <div className="space-y-3">
                <div className="border-2 border-line bg-bg p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
                    Address
                  </div>
                  <div className="mt-1 break-all font-mono text-xs">{address}</div>
                  <div className={`mt-2 text-[10px] ${wrongNetwork ? "text-accent" : "text-muted"}`}>
                    {wrongNetwork
                      ? `Wrong network. Switch to Robinhood Chain (${CHAIN_ID}).`
                      : `Robinhood Chain · ${CHAIN_ID}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(address);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      } catch {
                        // clipboard can be blocked
                      }
                    }}
                    className="pixel-btn h-9 flex-1 text-[11px]"
                  >
                    {copied ? "Copied!" : "Copy address"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      disconnect();
                      setOpen(false);
                    }}
                    className="pixel-btn h-9 flex-1 text-[11px]"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {connectors.map((connector) => (
                  <button
                    key={connector.uid}
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      connect(
                        { connector },
                        {
                          onSuccess: () => setOpen(false),
                        },
                      )
                    }
                    className="pixel-btn flex h-11 w-full items-center justify-between px-3 text-xs"
                  >
                    <span className="flex items-center gap-2">
                      <ConnectorIcon id={connector.id} />
                      {connector.name}
                    </span>
                    <span className="text-[10px] text-muted">
                      {isPending ? "Opening…" : "→"}
                    </span>
                  </button>
                ))}
                {!WALLETCONNECT_PROJECT_ID && (
                  <p className="text-[10px] leading-relaxed text-muted">
                    Mobile wallets need NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. Injected
                    wallets work without it.
                  </p>
                )}
                {error && (
                  <p className="border-2 border-accent bg-accent/10 p-2 text-[11px] text-accent">
                    {getErrorMessage(error)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
