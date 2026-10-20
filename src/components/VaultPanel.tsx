"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatUnits, parseUnits } from "viem";
import { CHAIN_ID, EXPLORER_URL, IMD_ADDRESS, explorerTokenUrl } from "@/config/chains";
import type { VaultHandle } from "@/lib/hooks/useVault";
import { formatToken, getErrorMessage, shortenAddress } from "@/lib/format";
import { TOKEN_SYMBOL } from "@/shared/palette";

interface MockVault {
  account: string;
  balance: bigint;
  deposit: (amount: bigint) => void;
  withdraw: (amount: bigint) => void;
  faucet: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  mockMode: boolean;
  vault: VaultHandle;
  mockVault: MockVault;
  onNotify: (kind: "success" | "error" | "info", title: string, detail?: string, href?: string) => void;
}

function TxLinks({ hashes }: { hashes: string[] }) {
  if (hashes.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {hashes.map((hash, index) => (
        <a
          key={hash}
          href={`${EXPLORER_URL}/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-line bg-bg px-1.5 py-0.5 font-mono text-[9px] hover:border-ink"
        >
          tx {index + 1} ↗
        </a>
      ))}
    </div>
  );
}

export function VaultPanel({ open, onClose, mockMode, vault, mockVault, onNotify }: Props) {
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [mockBusy, setMockBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const decimals = mockMode ? 18 : vault.decimals;
  const walletBalance = mockMode ? mockVault.balance : vault.walletBalance;
  const vaultBalance = mockMode ? mockVault.balance : vault.vaultBalance;
  const connected = mockMode || Boolean(vault.address);
  const busy = mockBusy || vault.tx.busy;
  const error = localError || vault.tx.error;

  function parseAmount(value: string): bigint {
    if (!value.trim()) throw new Error("Enter an amount.");
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Enter an amount above zero.");
    if (decimals === undefined) throw new Error("Token decimals are still loading.");
    return parseUnits(value.trim(), decimals);
  }

  function fillMax(kind: "deposit" | "withdraw") {
    const raw = kind === "deposit" ? walletBalance : vaultBalance;
    if (raw === undefined || decimals === undefined) return;
    const value = formatUnits(raw, decimals);
    if (kind === "deposit") setDepositAmount(value);
    else setWithdrawAmount(value);
  }

  async function handleDeposit() {
    setLocalError(null);
    try {
      const amount = parseAmount(depositAmount);
      if (mockMode) {
        if (amount > mockVault.balance) throw new Error("Not enough demo IMD.");
        setMockBusy(true);
        mockVault.deposit(amount);
        setDepositAmount("");
        onNotify("success", "Demo deposit", `${formatToken(amount, 18)} ${TOKEN_SYMBOL} added.`);
      } else {
        if (walletBalance !== undefined && amount > walletBalance) {
          throw new Error(`Wallet only holds ${formatToken(walletBalance, decimals)} ${TOKEN_SYMBOL}.`);
        }
        await vault.deposit(amount);
        setDepositAmount("");
        onNotify("success", "Deposit confirmed", `${formatToken(amount, decimals)} ${TOKEN_SYMBOL} is in your vault.`);
      }
    } catch (error) {
      setLocalError(getErrorMessage(error));
    } finally {
      setMockBusy(false);
    }
  }

  async function handleWithdraw() {
    setLocalError(null);
    try {
      const amount = parseAmount(withdrawAmount);
      if (mockMode) {
        if (amount > mockVault.balance) throw new Error("Not enough demo IMD in the vault.");
        setMockBusy(true);
        mockVault.withdraw(amount);
        setWithdrawAmount("");
        onNotify("success", "Demo withdrawal", `${formatToken(amount, 18)} ${TOKEN_SYMBOL} returned.`);
      } else {
        await vault.withdraw(amount);
        setWithdrawAmount("");
        onNotify("success", "Withdrawal confirmed", `${formatToken(amount, decimals)} ${TOKEN_SYMBOL} returned.`);
      }
    } catch (error) {
      setLocalError(getErrorMessage(error));
    } finally {
      setMockBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Vault"
      onClick={onClose}
    >
      <div
        className="pixel-panel-strong pf-rise max-h-[92dvh] w-full max-w-md overflow-y-auto p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="pixel-font text-[11px]">VAULT</h2>
            <p className="mt-1 text-[10px] text-muted">
              {mockMode ? "demo balances" : `Robinhood Chain · ${CHAIN_ID}`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="pixel-btn h-7 w-7 text-xs" aria-label="Close">
            ✕
          </button>
        </div>

        {!mockMode && !vault.configured && (
          <div className="border-2 border-accent bg-accent/10 p-3 text-xs">
            <p className="font-bold text-accent">Vault not deployed yet.</p>
            <p className="mt-1 text-muted">
              Set <code className="font-mono">NEXT_PUBLIC_VAULT_ADDRESS</code> and{" "}
              <code className="font-mono">NEXT_PUBLIC_IMD_ADDRESS</code>, or run with{" "}
              <code className="font-mono">MOCK_MODE=true</code>.
            </p>
          </div>
        )}

        {!mockMode && vault.configured && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="border-2 border-line bg-bg p-2.5">
                <div className="text-[9px] font-bold uppercase tracking-wide text-muted">
                  Wallet {TOKEN_SYMBOL}
                </div>
                <div className="mt-1 font-mono text-sm">
                  {formatToken(walletBalance, decimals)}
                </div>
              </div>
              <div className="border-2 border-ink bg-panel2 p-2.5">
                <div className="text-[9px] font-bold uppercase tracking-wide text-muted">
                  Vault {TOKEN_SYMBOL}
                </div>
                <div className="mt-1 font-mono text-sm">
                  {formatToken(vaultBalance, decimals)}
                </div>
              </div>
            </div>

            <p className="text-[9px] leading-relaxed text-muted">
              Need {TOKEN_SYMBOL}?{" "}
              {IMD_ADDRESS && (
                <>
                  <a
                    href={explorerTokenUrl(IMD_ADDRESS)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-accent"
                  >
                    Token page ↗
                  </a>{" "}
                  ·{" "}
                </>
              )}
              <Link href="/about" className="underline underline-offset-2 hover:text-accent">
                How to get it
              </Link>
            </p>

            {!connected && (
              <div className="border-2 border-line bg-bg p-3 text-xs text-muted">
                Connect a wallet from the header to deposit, withdraw or paint.
              </div>
            )}

            {vault.isWrongNetwork && (
              <div className="border-2 border-line bg-glow/20 p-2 text-[10px]">
                Wrong network. The first transaction will ask to switch to Robinhood Chain.
              </div>
            )}

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">
                Deposit {TOKEN_SYMBOL}
              </label>
              <div className="flex gap-2">
                <input
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0.0"
                  disabled={busy || !connected}
                  className="pf-input h-9 min-w-0 flex-1 px-2 font-mono text-xs"
                  aria-label="Deposit amount"
                />
                <button
                  type="button"
                  onClick={() => fillMax("deposit")}
                  className="pixel-btn h-9 px-2 text-[10px]"
                  disabled={busy || walletBalance === undefined}
                >
                  MAX
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeposit()}
                  disabled={busy || !connected || !depositAmount}
                  className="pixel-btn pixel-btn-primary h-9 px-3 text-[10px]"
                >
                  Deposit
                </button>
              </div>
              <p className="mt-1 text-[9px] text-muted">
                Approval is requested only if the current allowance is too low.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">
                Withdraw {TOKEN_SYMBOL}
              </label>
              <div className="flex gap-2">
                <input
                  value={withdrawAmount}
                  onChange={(event) => setWithdrawAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0.0"
                  disabled={busy || !connected}
                  className="pf-input h-9 min-w-0 flex-1 px-2 font-mono text-xs"
                  aria-label="Withdraw amount"
                />
                <button
                  type="button"
                  onClick={() => fillMax("withdraw")}
                  className="pixel-btn h-9 px-2 text-[10px]"
                  disabled={busy || vaultBalance === undefined}
                >
                  MAX
                </button>
                <button
                  type="button"
                  onClick={() => void handleWithdraw()}
                  disabled={busy || !connected || !withdrawAmount}
                  className="pixel-btn h-9 px-3 text-[10px]"
                >
                  Withdraw
                </button>
              </div>
              <p className="mt-1 text-[9px] text-muted">
                Withdrawals always work. There is no admin and no pause.
              </p>
            </div>

            {vault.tx.step && <p className="pf-blink text-[10px] text-muted">{vault.tx.step}</p>}
            {error && (
              <p className="border-2 border-accent bg-accent/10 p-2 text-[10px] text-accent">
                {error}
              </p>
            )}
            <TxLinks hashes={vault.tx.hashes} />
          </div>
        )}

        {mockMode && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="border-2 border-line bg-bg p-2.5">
                <div className="text-[9px] font-bold uppercase tracking-wide text-muted">
                  Demo wallet
                </div>
                <div className="mt-1 font-mono text-sm">{formatToken(walletBalance, 18)}</div>
              </div>
              <div className="border-2 border-ink bg-panel2 p-2.5">
                <div className="text-[9px] font-bold uppercase tracking-wide text-muted">
                  Demo vault
                </div>
                <div className="mt-1 font-mono text-sm">{formatToken(vaultBalance, 18)}</div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-2 border-line bg-bg p-2 text-[10px]">
              <span className="text-muted">
                Painter <span className="font-mono">{shortenAddress(mockVault.account, 5)}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  mockVault.faucet();
                  onNotify("info", "Faucet used", "Added 100 demo IMD.");
                }}
                className="pixel-btn h-7 px-2 text-[10px]"
              >
                +100 faucet
              </button>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">
                Demo deposit
              </label>
              <div className="flex gap-2">
                <input
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0.0"
                  className="pf-input h-9 min-w-0 flex-1 px-2 font-mono text-xs"
                  aria-label="Demo deposit amount"
                />
                <button
                  type="button"
                  onClick={() => void handleDeposit()}
                  disabled={busy || !depositAmount}
                  className="pixel-btn pixel-btn-primary h-9 px-3 text-[10px]"
                >
                  Deposit
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">
                Demo withdraw
              </label>
              <div className="flex gap-2">
                <input
                  value={withdrawAmount}
                  onChange={(event) => setWithdrawAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0.0"
                  className="pf-input h-9 min-w-0 flex-1 px-2 font-mono text-xs"
                  aria-label="Demo withdraw amount"
                />
                <button
                  type="button"
                  onClick={() => void handleWithdraw()}
                  disabled={busy || !withdrawAmount}
                  className="pixel-btn h-9 px-3 text-[10px]"
                >
                  Withdraw
                </button>
              </div>
            </div>

            {error && (
              <p className="border-2 border-accent bg-accent/10 p-2 text-[10px] text-accent">
                {error}
              </p>
            )}
            <p className="text-[9px] leading-relaxed text-muted">
              Demo balances live in localStorage. The canvas lives in server memory and resets when
              the dev server restarts. Set <code className="font-mono">MOCK_MODE=false</code> and
              fill the contract env vars for the real flow.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
