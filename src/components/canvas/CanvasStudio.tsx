"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import type { Hash } from "viem";
import { PixelCanvas, type CanvasTool } from "./PixelCanvas";
import { PaletteBar } from "./PaletteBar";
import { VaultPanel } from "@/components/VaultPanel";
import { ToastStack, type ToastItem } from "@/components/Toast";
import { useCanvasData } from "@/lib/hooks/useCanvasData";
import { useMockVault } from "@/lib/hooks/useMockVault";
import { useVault } from "@/lib/hooks/useVault";
import { useRuntimeConfig } from "@/lib/runtime";
import {
  CHAIN_ID,
  CONTRACTS_CONFIGURED,
  explorerTxUrl,
} from "@/config/chains";
import { paintCall } from "@/lib/contract";
import { formatToken, getErrorMessage, timeAgo } from "@/lib/format";
import { apiPost } from "@/lib/api";
import { canvasPngBlob, downloadBlob } from "@/lib/export";
import { SHARE_TEXT, shareOnXUrl } from "@/lib/share";
import {
  MAX_BATCH_FALLBACK,
  PALETTE,
  PRICE_DISPLAY,
  TOKEN_SYMBOL,
  isPaintedByte,
  paletteIndexFromByte,
} from "@/shared/palette";
import { CANVAS_PIXEL_COUNT } from "@/shared/canvas";
import {
  batchCount,
  gasLimitWithBuffer,
  isOutOfGasError,
  paintCost,
  splitPaintBatches,
} from "@/shared/paint";
import { MOCK_DECIMALS, MOCK_PRICE_RAW } from "@/shared/mock";

interface PaintState {
  busy: boolean;
  step: string | null;
  hashes: Hash[];
}

const EMPTY_CANVAS = new Uint8Array(CANVAS_PIXEL_COUNT);

function NotDeployedState() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10">
      <div className="pixel-panel-strong p-5 sm:p-8">
        <p className="pixel-font text-[10px] text-accent">PX / STATUS</p>
        <h1 className="pixel-font mt-3 text-lg leading-relaxed sm:text-2xl">
          CONTRACT NOT
          <br />
          DEPLOYED YET
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
          The app is running, but no vault address is configured and mock mode is off. Nothing here
          needs a database — only the vault and IMD addresses plus an RPC.
        </p>
        <div className="mt-5 space-y-2 border-2 border-line bg-bg p-3 font-mono text-[11px] leading-relaxed">
          <p className="text-muted"># Option A — preview without a chain</p>
          <p>MOCK_MODE=true</p>
          <p className="pt-2 text-muted"># Option B — point at the deployed contract</p>
          <p>NEXT_PUBLIC_VAULT_ADDRESS=0x…</p>
          <p>NEXT_PUBLIC_IMD_ADDRESS=0x…</p>
          <p>NEXT_PUBLIC_RPC_URL=https://rpc.mainnet.chain.robinhood.com</p>
          <p>NEXT_PUBLIC_CHAIN_ID={CHAIN_ID}</p>
        </div>
        <p className="mt-4 text-xs text-muted">
          The canvas unlocks automatically after a restart with these variables set.
        </p>
      </div>
    </div>
  );
}

export function CanvasStudio({ siteUrl }: { siteUrl: string }) {
  const { mockMode } = useRuntimeConfig();
  const configured = CONTRACTS_CONFIGURED;
  const canvas = useCanvasData();
  const vault = useVault(mockMode);
  const { address, chainId } = useAccount();
  const mockVault = useMockVault(address);
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { writeContractAsync } = useWriteContract();

  const [color, setColor] = useState(8);
  const [tool, setTool] = useState<CanvasTool>("move");
  const [draft, setDraft] = useState<Map<number, number>>(new Map());
  const draftRef = useRef<Map<number, number>>(draft);
  const [undoStack, setUndoStack] = useState<Array<Map<number, number | undefined>>>([]);
  const strokeRef = useRef<Map<number, number | undefined> | null>(null);
  const [inspectId, setInspectId] = useState<number | null>(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(1);
  const [paintState, setPaintState] = useState<PaintState>({
    busy: false,
    step: null,
    hashes: [],
  });
  const [exporting, setExporting] = useState(false);
  // SSR renders the resolved origin; the click handler uses the origin actually
  // being visited, so a share can never point at another domain.
  const shareHref = shareOnXUrl(SHARE_TEXT, siteUrl);

  const notify = useCallback(
    (kind: "success" | "error" | "info", title: string, detail?: string, href?: string) => {
      const id = toastIdRef.current++;
      setToasts((previous) => [...previous.slice(-3), { id, kind, title, detail, href }]);
      setTimeout(() => {
        setToasts((previous) => previous.filter((toast) => toast.id !== id));
      }, 7000);
    },
    [],
  );

  const replaceDraft = useCallback((next: Map<number, number>) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const beginStroke = useCallback(() => {
    strokeRef.current = new Map();
  }, []);

  const applyPixel = useCallback(
    (id: number) => {
      const current = draftRef.current;
      if (current.get(id) === color) return;
      const stroke = strokeRef.current;
      if (stroke && !stroke.has(id)) stroke.set(id, current.get(id));
      const next = new Map(current);
      next.set(id, color);
      replaceDraft(next);
    },
    [color, replaceDraft],
  );

  const endStroke = useCallback(() => {
    const stroke = strokeRef.current;
    strokeRef.current = null;
    if (!stroke || stroke.size === 0) return;
    setUndoStack((previous) => [...previous.slice(-49), stroke]);
  }, []);

  const undo = useCallback(() => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    setUndoStack(undoStack.slice(0, -1));
    const next = new Map(draftRef.current);
    for (const [id, previous] of last) {
      if (previous === undefined) next.delete(id);
      else next.set(id, previous);
    }
    replaceDraft(next);
  }, [replaceDraft, undoStack]);

  const clearDraft = useCallback(() => {
    replaceDraft(new Map());
    setUndoStack([]);
    strokeRef.current = null;
  }, [replaceDraft]);

  const price = mockMode ? MOCK_PRICE_RAW : vault.price;
  const decimals = mockMode ? MOCK_DECIMALS : vault.decimals;
  const maxBatch = mockMode ? 100 : (vault.maxBatch ?? MAX_BATCH_FALLBACK);
  const draftCount = draft.size;
  const cost = price !== undefined ? paintCost(price, draftCount) : undefined;
  const priceLabel =
    price !== undefined && decimals !== undefined
      ? formatToken(price, decimals, 4)
      : PRICE_DISPLAY;
  const costLabel = cost !== undefined && decimals !== undefined ? formatToken(cost, decimals, 4) : "—";
  const splitCount = Math.max(1, batchCount(draftCount, Math.max(1, maxBatch)));
  const availableBalance = mockMode ? mockVault.balance : vault.vaultBalance;
  const insufficient =
    availableBalance !== undefined && cost !== undefined && cost > availableBalance;
  const wrongNetwork = !mockMode && Boolean(address) && chainId !== CHAIN_ID;
  const pricingReady = mockMode || (price !== undefined && decimals !== undefined);
  const balanceReady = mockMode || availableBalance !== undefined;

  const canPaint =
    draftCount > 0 &&
    !paintState.busy &&
    !insufficient &&
    pricingReady &&
    balanceReady &&
    (mockMode || (Boolean(address) && configured));

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  function removeFromDraft(ids: readonly number[]) {
    const next = new Map(draftRef.current);
    for (const id of ids) next.delete(id);
    replaceDraft(next);
  }

  async function handlePaint() {
    if (!canPaint || draftCount === 0) return;
    const entries = Array.from(draft.entries());
    const ids = entries.map(([id]) => id);
    const colors = entries.map(([, index]) => index);
    const totalCost = cost ?? 0n;
    const hashes: Hash[] = [];

    setPaintState({
      busy: true,
      step: mockMode ? "Saving demo pixels…" : "Preparing paint transaction…",
      hashes: [],
    });

    try {
      if (mockMode) {
        mockVault.withdraw(totalCost);
        try {
          const result = await apiPost<{ txHash: string; burnedRaw: string }>("/api/mock/paint", {
            ids,
            colors,
            painter: address ?? mockVault.account,
          });
          canvas.applyLocalPixels(ids, colors);
          clearDraft();
          setPaintState({ busy: false, step: null, hashes: [] });
          notify(
            "success",
            `Painted ${ids.length} px (demo)`,
            `${formatToken(BigInt(result.burnedRaw), MOCK_DECIMALS)} ${TOKEN_SYMBOL} sent to the demo dead address.`,
          );
          void canvas.refreshAfterPaint();
        } catch (error) {
          mockVault.deposit(totalCost);
          throw error;
        }
      } else {
        if (!address) throw new Error("Connect a wallet to paint.");
        if (!publicClient) throw new Error("No RPC client for Robinhood Chain.");
        if (wrongNetwork) await switchChainAsync({ chainId: CHAIN_ID });
        if (vault.vaultBalance !== undefined && totalCost > vault.vaultBalance) {
          throw new Error("Vault balance is too low. Deposit more IMD first.");
        }

        const batches = splitPaintBatches(ids, colors, maxBatch);
        for (const [index, batch] of batches.entries()) {
          const txNumber = index + 1;
          setPaintState({
            busy: true,
            step: splitCount > 1 ? `Paint tx ${txNumber}/${splitCount}…` : "Paint tx…",
            hashes: [...hashes],
          });
          const call = paintCall(batch.ids, batch.colors);
          // Paint writes up to 100 cold slots. Estimate the batch, add 20% and
          // send an explicit limit instead of relying on a wallet default.
          let gas: bigint | undefined;
          try {
            const estimate = await publicClient.estimateContractGas({
              ...call,
              account: address,
            });
            gas = gasLimitWithBuffer(estimate);
          } catch {
            // A failing estimate is reported by the write; let it surface.
            gas = undefined;
          }
          const hash = await writeContractAsync({
            ...call,
            ...(gas !== undefined ? { gas } : {}),
          });
          hashes.push(hash);
          setPaintState({
            busy: true,
            step:
              splitCount > 1
                ? `Confirming ${txNumber}/${splitCount}…`
                : "Confirming paint…",
            hashes: [...hashes],
          });
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          if (receipt.status !== "success") throw new Error("Paint transaction reverted.");
          canvas.applyLocalPixels(batch.ids, batch.colors);
          removeFromDraft(batch.ids);
          setUndoStack([]);
        }

        clearDraft();
        setPaintState({ busy: false, step: null, hashes });
        notify(
          "success",
          `Painted ${ids.length} px`,
          `${costLabel} ${TOKEN_SYMBOL} sent to the dead address on Robinhood Chain.`,
          explorerTxUrl(hashes[hashes.length - 1]),
        );
        void vault.refresh();
        void canvas.refreshAfterPaint();
      }
    } catch (error) {
      notify(
        "error",
        "Paint failed",
        isOutOfGasError(error)
          ? "The transaction ran out of gas and reverted: no pixels were painted, only the network fee was spent. Split the draft into smaller batches and try again."
          : getErrorMessage(error),
      );
      setPaintState((previous) => ({ ...previous, busy: false, step: null }));
      if (hashes.length > 0) void canvas.refreshAfterPaint();
    }
  }

  const pixels = canvas.canvas;

  async function handleExportPng() {
    if (!pixels) {
      notify("info", "Canvas still loading", "Wait for the canvas read to finish, then try again.");
      return;
    }
    setExporting(true);
    try {
      const blob = await canvasPngBlob(pixels, 4);
      downloadBlob(blob, "pixelfun-canvas.png");
      notify("success", "PNG exported", "2048×2048 nearest-neighbour canvas export.");
    } catch (error) {
      notify("error", "PNG export failed", getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  const inspectedByte = pixels && inspectId !== null ? (pixels[inspectId] ?? 0) : 0;
  const inspectedPalette = paletteIndexFromByte(inspectedByte);
  const draftColor = inspectId !== null ? draft.get(inspectId) : undefined;
  const vaultLabel = mockMode
    ? formatToken(mockVault.balance, 18, 2)
    : formatToken(vault.vaultBalance, vault.decimals, 2);
  const paintedCount = useMemo(
    () =>
      pixels
        ? pixels.reduce((count, byte) => count + (isPaintedByte(byte) ? 1 : 0), 0)
        : 0,
    [pixels],
  );

  if (!mockMode && !configured) {
    return <NotDeployedState />;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-2 px-2 py-2 sm:px-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="flex h-8 items-center gap-1.5 border-2 border-line bg-panel px-2 text-[9px] font-bold uppercase tracking-wider text-muted">
          <span className="h-1.5 w-1.5 bg-pfgreen" aria-hidden />
          Robinhood Chain · {CHAIN_ID}
        </span>

        <div className="flex items-center border-2 border-ink bg-panel">
          <button
            type="button"
            onClick={() => setTool("move")}
            className={`h-8 px-2 text-[10px] font-bold uppercase ${
              tool === "move" ? "bg-ink text-bg" : "text-muted hover:text-ink"
            }`}
            title="Drag pans. Tap paints."
          >
            ✋ Move
          </button>
          <button
            type="button"
            onClick={() => setTool("draw")}
            className={`h-8 border-l-2 border-ink px-2 text-[10px] font-bold uppercase ${
              tool === "draw" ? "bg-ink text-bg" : "text-muted hover:text-ink"
            }`}
            title="Drag paints a line. Shift-drag also paints."
          >
            ✏ Draw
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {mockMode && (
            <span className="border-2 border-accent bg-accent/10 px-1.5 py-1 text-[9px] font-bold uppercase text-accent">
              Mock
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleExportPng()}
            disabled={exporting || !pixels}
            className="pixel-btn h-8 px-2 text-[10px] font-bold"
            aria-label="Download the current canvas as a PNG"
            title="Download the on-chain canvas as a 4× PNG"
          >
            {exporting ? "…" : "PNG"}
          </button>
          <a
            href={shareHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => {
              if (typeof window === "undefined") return;
              event.preventDefault();
              window.open(
                shareOnXUrl(SHARE_TEXT, window.location.origin),
                "_blank",
                "noopener,noreferrer",
              );
            }}
            className="pixel-btn h-8 px-2 text-[10px] font-bold"
            aria-label="Share PixelFun on X"
          >
            Share on X
          </a>
          <button
            type="button"
            onClick={() => {
              vault.clearError();
              setVaultOpen(true);
            }}
            className="pixel-btn h-8 px-2 text-[10px] font-bold"
          >
            Vault <span className="font-mono text-muted">{vaultLabel}</span>
          </button>
        </div>
      </div>

      {wrongNetwork && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-2 border-accent bg-accent/10 px-2 py-1.5 text-[10px]">
          <span className="font-bold text-accent">
            Wallet is on chain {chainId}. PixelFun is on Robinhood Chain ({CHAIN_ID}).
          </span>
          <button
            type="button"
            onClick={() => void switchChainAsync({ chainId: CHAIN_ID })}
            className="pixel-btn h-7 px-2 text-[10px]"
          >
            Switch network
          </button>
        </div>
      )}

      <div className="relative flex min-h-[300px] flex-1 border-2 border-ink bg-board">
        <PixelCanvas
          pixels={pixels ?? EMPTY_CANVAS}
          draft={draft}
          color={color}
          tool={tool}
          onPaint={applyPixel}
          onStrokeStart={beginStroke}
          onStrokeEnd={endStroke}
          onInspect={(id) => {
            if (id !== null) setInspectId(id);
          }}
        />

        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap items-center gap-1.5">
          <span className="border-2 border-ink bg-panel/90 px-1.5 py-1 text-[9px] font-bold uppercase">
            {mockMode ? "in-memory demo" : canvas.source === "rpc" ? "direct rpc" : "live · api"}
          </span>
          <span className="hidden border-2 border-ink bg-panel/90 px-1.5 py-1 font-mono text-[9px] sm:inline">
            {paintedCount.toLocaleString()} px painted
          </span>
          <span className="hidden border-2 border-ink bg-panel/90 px-1.5 py-1 font-mono text-[9px] md:inline">
            sync {timeAgo(canvas.lastSync)}
          </span>
        </div>

        {canvas.loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-board/80">
            <span className="pixel-font pf-blink text-[10px] text-white">READING 262,144 PIXELS…</span>
          </div>
        )}
        {canvas.error && !canvas.loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-board/85 p-4">
            <div className="max-w-sm border-2 border-accent bg-panel p-4 text-center">
              <p className="text-xs font-bold text-accent">Canvas read failed</p>
              <p className="mt-1 break-words text-[10px] text-muted">{canvas.error}</p>
              <button
                type="button"
                onClick={() => void canvas.refresh()}
                className="pixel-btn mt-3 h-8 px-3 text-[10px]"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex min-h-8 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-2 border-line bg-panel px-2 py-1 font-mono text-[10px]">
        {inspectId === null ? (
          <span className="text-muted">Tap or hover a pixel to inspect it.</span>
        ) : (
          <>
            <span className="font-bold">
              x {inspectId % 512} · y {Math.floor(inspectId / 512)}
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2.5 w-2.5 border border-ink"
                style={{
                  backgroundColor:
                    draftColor !== undefined
                      ? PALETTE[draftColor]
                      : inspectedPalette !== null
                        ? PALETTE[inspectedPalette]
                        : "#f4efe3",
                }}
              />
              {draftColor !== undefined
                ? `draft #${draftColor}`
                : inspectedPalette !== null
                  ? `#${inspectedPalette}`
                  : "unpainted"}
            </span>
            <button
              type="button"
              onClick={() => setInspectId(null)}
              className="ml-auto text-muted underline underline-offset-2"
            >
              clear
            </button>
          </>
        )}
      </div>

      <PaletteBar color={color} onChange={setColor} />

      <div className="sticky bottom-0 z-20 flex shrink-0 flex-wrap items-center gap-2 border-2 border-ink bg-panel p-2">
        <div className="min-w-[130px] flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="pixel-font text-[11px]">{draftCount} PX</span>
            <span className="font-mono text-[10px] text-muted">
              × {priceLabel} {TOKEN_SYMBOL} ={" "}
              <span className="font-bold text-ink">
                {costLabel} {TOKEN_SYMBOL}
              </span>
            </span>
          </div>
          <div className="mt-0.5 text-[9px] text-muted">
            {draftCount === 0
              ? "Pick a color and tap the canvas"
              : splitCount > 1
                ? `${splitCount} transactions · max ${maxBatch} px each`
                : "One transaction"}
            {insufficient ? " · vault balance too low" : ""}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={undo}
            disabled={undoStack.length === 0 || paintState.busy}
            className="pixel-btn h-9 px-2.5 text-[10px]"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={clearDraft}
            disabled={draftCount === 0 || paintState.busy}
            className="pixel-btn h-9 px-2.5 text-[10px]"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => void handlePaint()}
            disabled={!canPaint}
            className="pixel-btn pixel-btn-primary h-9 min-w-[96px] px-3 text-[11px]"
            title={
              insufficient
                ? "Deposit more IMD into the vault"
                : !pricingReady
                  ? "Loading the on-chain price and token decimals"
                  : !balanceReady
                    ? "Loading your vault balance"
                    : !mockMode && !address
                      ? "Connect a wallet first"
                      : "Send paint transaction"
            }
          >
            {paintState.busy ? "Painting…" : `Paint ${draftCount || ""}`.trim()}
          </button>
        </div>
      </div>

      {paintState.step && (
        <p className="pf-blink text-center text-[10px] text-muted">{paintState.step}</p>
      )}
      {paintState.hashes.length > 0 && (
        <p className="text-center text-[10px] text-muted">
          {paintState.hashes.map((hash, index) => (
            <a
              key={hash}
              href={explorerTxUrl(hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-1 underline underline-offset-2"
            >
              tx {index + 1} ↗
            </a>
          ))}
        </p>
      )}
      {!mockMode && !address && (
        <p className="text-center text-[10px] text-muted">
          Connect a wallet to paint. Reading the canvas works without one.
        </p>
      )}
      {!mockMode && address && wrongNetwork && (
        <p className="text-center text-[10px] text-muted">
          Painting will ask to switch to Robinhood Chain.
        </p>
      )}

      <VaultPanel
        open={vaultOpen}
        onClose={() => setVaultOpen(false)}
        mockMode={mockMode}
        vault={vault}
        mockVault={mockVault}
        onNotify={notify}
      />
      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((previous) => previous.filter((toast) => toast.id !== id))}
      />

      <p className="hidden text-center text-[9px] text-muted sm:block">
        {mockMode
          ? "Demo: canvas in server memory, vault in localStorage."
          : `Canvas read from Robinhood Chain state · chunked getPixels · live Painted logs + 60s resync.`}
      </p>
    </div>
  );
}
