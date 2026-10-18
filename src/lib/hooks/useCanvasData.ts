"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CONTRACTS_CONFIGURED } from "@/config/chains";
import {
  getLatestBlockNumber,
  getPaintedLogs,
  getReadClient,
  readCanvasFromRpc,
} from "@/lib/contract";
import { useRuntimeConfig } from "@/lib/runtime";
import { applyPaint, base64ToPixels } from "@/shared/canvas";
import { CANVAS_PIXEL_COUNT } from "@/shared/palette";

interface CanvasApiResponse {
  width: number;
  height: number;
  pixels: string;
  lastSync: string;
  blockNumber: string | null;
  mock?: boolean;
}

interface CanvasState {
  canvas: Uint8Array | null;
  loading: boolean;
  error: string | null;
  lastSync: string | null;
  source: "api" | "rpc" | "mock" | null;
}

const API_URL = "/api/canvas";
const FULL_RESYNC_MS = 60_000;
const EVENT_POLL_MS = 4_000;

function decodeCanvas(payload: CanvasApiResponse): Uint8Array {
  const bytes = base64ToPixels(payload.pixels);
  if (bytes.length !== CANVAS_PIXEL_COUNT) {
    throw new Error(`Canvas API returned ${bytes.length} bytes, expected ${CANVAS_PIXEL_COUNT}.`);
  }
  return bytes;
}

export function useCanvasData() {
  const { mockMode } = useRuntimeConfig();
  const configured = CONTRACTS_CONFIGURED;
  const enabled = mockMode || configured;
  const [state, setState] = useState<CanvasState>({
    canvas: null,
    loading: enabled,
    error: null,
    lastSync: null,
    source: null,
  });
  const lastBlockRef = useRef<bigint | null>(null);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadFull = useCallback(
    async (silent: boolean) => {
      if (!enabled || loadingRef.current) return;
      loadingRef.current = true;
      if (!silent) setState((prev) => ({ ...prev, loading: prev.canvas === null }));

      try {
        let bytes: Uint8Array;
        let source: CanvasState["source"] = "api";
        let blockNumber: bigint | null = null;

        try {
          const response = await fetch(API_URL, { cache: "no-store" });
          if (!response.ok) {
            let message = `Canvas API failed (${response.status}).`;
            try {
              const body = (await response.json()) as { message?: string };
              if (body.message) message = body.message;
            } catch {
              // non-JSON error
            }
            throw new Error(message);
          }
          const payload = (await response.json()) as CanvasApiResponse;
          bytes = decodeCanvas(payload);
          blockNumber = payload.blockNumber ? BigInt(payload.blockNumber) : null;
          source = mockMode ? "mock" : "api";
        } catch (apiError) {
          if (!configured) throw apiError;
          // Fall back to direct RPC reads from the browser. Capture the block
          // before reading so paints during the read are replayed, not skipped.
          const client = getReadClient();
          blockNumber = await getLatestBlockNumber(client);
          bytes = await readCanvasFromRpc({ client, concurrency: 4, retries: 2 });
          source = "rpc";
        }

        if (!mountedRef.current) return;
        lastBlockRef.current = blockNumber;
        setState({
          canvas: bytes,
          loading: false,
          error: null,
          lastSync: new Date().toISOString(),
          source,
        });
      } catch (error) {
        if (!mountedRef.current) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      } finally {
        loadingRef.current = false;
      }
    },
    [configured, enabled, mockMode],
  );

  // Initial load.
  useEffect(() => {
    if (!enabled) return;
    void loadFull(false);
  }, [enabled, loadFull]);

  // Live Painted events every 4s.
  useEffect(() => {
    if (!enabled || mockMode || !configured) return;
    const client = getReadClient();
    let cancelled = false;

    async function poll() {
      // Do not spend RPC calls while the tab is in the background.
      if (document.visibilityState !== "visible") return;
      try {
        const latest = await getLatestBlockNumber(client);
        const previous = lastBlockRef.current;
        if (previous === null) {
          lastBlockRef.current = latest;
          return;
        }
        if (latest <= previous) return;
        const logs = await getPaintedLogs(previous + 1n, latest, client);
        if (cancelled) return;
        if (logs.length > 0) {
          setState((prev) => {
            if (!prev.canvas) return prev;
            const next = new Uint8Array(prev.canvas);
            for (const log of logs) {
              const args = log.args as {
                ids?: readonly number[];
                colors?: readonly number[];
              };
              if (args.ids && args.colors) applyPaint(next, args.ids, args.colors);
            }
            return { ...prev, canvas: next, lastSync: new Date().toISOString() };
          });
        }
        lastBlockRef.current = latest;
      } catch {
        // transient RPC failures are handled by the next poll / full resync
      }
    }

    const timer = setInterval(() => void poll(), EVENT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [configured, enabled, mockMode]);

  // Full resync every 60s and when the tab becomes visible again.
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => void loadFull(true), FULL_RESYNC_MS);
    function onVisibility() {
      if (document.visibilityState === "visible") void loadFull(true);
    }
    function onFocus() {
      void loadFull(true);
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, loadFull]);

  const refresh = useCallback(() => loadFull(true), [loadFull]);

  const applyLocalPixels = useCallback((ids: readonly number[], colors: readonly number[]) => {
    setState((prev) => {
      if (!prev.canvas) return prev;
      const next = new Uint8Array(prev.canvas);
      applyPaint(next, ids, colors);
      return { ...prev, canvas: next, lastSync: new Date().toISOString() };
    });
  }, []);

  const refreshAfterPaint = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await loadFull(true);
  }, [loadFull]);

  return {
    ...state,
    configured,
    mockMode,
    enabled,
    refresh,
    applyLocalPixels,
    refreshAfterPaint,
  };
}
