"use client";

import { useCallback, useSyncExternalStore } from "react";
import { parseUnits } from "viem";
import { DEMO_PAINTER } from "@/shared/mock";

const STORAGE_KEY = "pixelfun:mock-vault:v1";
const DEFAULT_BALANCE = parseUnits("50", 18);
const FAUCET_AMOUNT = parseUnits("100", 18);
const EMPTY: Balances = {};

type Balances = Record<string, string>;

let cached: Balances | null = null;
const listeners = new Set<() => void>();

function readBalances(): Balances {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return EMPTY;
    const result: Balances = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string" && /^\d+$/.test(value)) result[key] = value;
    }
    return result;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): Balances {
  if (!cached) cached = readBalances();
  return cached;
}

function getServerSnapshot(): Balances {
  return EMPTY;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cached = null;
    callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function writeBalances(next: Balances): void {
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage can be unavailable
  }
  for (const listener of listeners) listener();
}

export function useMockVault(address: string | undefined) {
  const account = (address ?? DEMO_PAINTER).toLowerCase();
  const balances = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const balance = BigInt(balances[account] ?? DEFAULT_BALANCE.toString());

  const update = useCallback(
    (delta: bigint) => {
      const current = BigInt(getSnapshot()[account] ?? DEFAULT_BALANCE.toString());
      const next = current + delta;
      if (next < 0n) throw new Error("Not enough demo IMD in the vault.");
      writeBalances({ ...getSnapshot(), [account]: next.toString() });
      return next;
    },
    [account],
  );

  const deposit = useCallback(
    (amount: bigint) => {
      if (amount <= 0n) throw new Error("Enter an amount above zero.");
      update(amount);
    },
    [update],
  );

  const withdraw = useCallback(
    (amount: bigint) => {
      if (amount <= 0n) throw new Error("Enter an amount above zero.");
      update(-amount);
    },
    [update],
  );

  const faucet = useCallback(() => update(FAUCET_AMOUNT), [update]);

  return { account, balance, deposit, withdraw, faucet };
}
