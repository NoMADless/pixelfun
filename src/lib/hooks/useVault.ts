"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import type { Hash } from "viem";
import { CHAIN_ID, CONTRACTS_CONFIGURED } from "@/config/chains";
import {
  approveCall,
  depositCall,
  readAllowance,
  readAllowanceConfig,
  readMaxBatchConfig,
  readPriceConfig,
  readTokenBalanceConfig,
  readTokenDecimalsConfig,
  readVaultBalanceConfig,
  withdrawCall,
} from "@/lib/contract";
import { getErrorMessage } from "@/lib/format";
import {
  MOCK_DECIMALS,
  MOCK_MAX_BATCH,
  MOCK_PRICE_RAW,
} from "@/shared/mock";

export interface VaultTxState {
  busy: boolean;
  step: string | null;
  error: string | null;
  hashes: Hash[];
}

const INITIAL_TX: VaultTxState = { busy: false, step: null, error: null, hashes: [] };

export function useVault(mockMode: boolean) {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const queryClient = useQueryClient();
  const [tx, setTx] = useState<VaultTxState>(INITIAL_TX);

  const enabled = !mockMode && CONTRACTS_CONFIGURED;

  const decimalsQuery = useReadContract({
    ...readTokenDecimalsConfig(),
    query: { enabled },
  });

  const walletBalanceQuery = useReadContract({
    ...readTokenBalanceConfig(address),
    query: { enabled: enabled && Boolean(address) },
  });

  const vaultBalanceQuery = useReadContract({
    ...readVaultBalanceConfig(address),
    query: { enabled: enabled && Boolean(address) },
  });

  const allowanceQuery = useReadContract({
    ...readAllowanceConfig(address),
    query: { enabled: enabled && Boolean(address) },
  });

  const priceQuery = useReadContract({
    ...readPriceConfig(),
    query: { enabled },
  });

  const maxBatchQuery = useReadContract({
    ...readMaxBatchConfig(),
    query: { enabled },
  });

  const decimals = mockMode ? MOCK_DECIMALS : (decimalsQuery.data as number | undefined);
  const walletBalance = mockMode ? undefined : (walletBalanceQuery.data as bigint | undefined);
  const vaultBalance = mockMode ? undefined : (vaultBalanceQuery.data as bigint | undefined);
  const allowance = allowanceQuery.data as bigint | undefined;
  const price = mockMode ? MOCK_PRICE_RAW : (priceQuery.data as bigint | undefined);
  const maxBatch = mockMode ? MOCK_MAX_BATCH : (maxBatchQuery.data as number | undefined);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries();
  }, [queryClient]);

  const ensureChain = useCallback(async () => {
    if (chainId !== CHAIN_ID) {
      await switchChainAsync({ chainId: CHAIN_ID });
    }
  }, [chainId, switchChainAsync]);

  const waitForSuccess = useCallback(
    async (hash: Hash) => {
      if (!publicClient) throw new Error("No RPC client for Robinhood Chain.");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The transaction reverted.");
    },
    [publicClient],
  );

  const deposit = useCallback(
    async (amount: bigint): Promise<Hash[]> => {
      if (!enabled) throw new Error("Vault is not deployed.");
      if (!address) throw new Error("Connect a wallet first.");
      if (!publicClient) throw new Error("No RPC client for Robinhood Chain.");
      if (amount <= 0n) throw new Error("Enter an amount above zero.");

      setTx({ busy: true, step: "Checking allowance…", error: null, hashes: [] });
      const hashes: Hash[] = [];
      try {
        await ensureChain();
        const freshAllowance = await readAllowance(address, publicClient);
        if (freshAllowance < amount) {
          setTx((prev) => ({ ...prev, step: "Approve IMD…" }));
          const approveHash = await writeContractAsync(approveCall(amount));
          hashes.push(approveHash);
          setTx((prev) => ({
            ...prev,
            step: "Waiting for approval…",
            hashes: [...hashes],
          }));
          await waitForSuccess(approveHash);
        }

        setTx((prev) => ({ ...prev, step: "Deposit IMD…" }));
        const depositHash = await writeContractAsync(depositCall(amount));
        hashes.push(depositHash);
        setTx((prev) => ({
          ...prev,
          step: "Waiting for deposit…",
          hashes: [...hashes],
        }));
        await waitForSuccess(depositHash);
        setTx({ busy: false, step: null, error: null, hashes });
        await refresh();
        return hashes;
      } catch (error) {
        setTx({ busy: false, step: null, error: getErrorMessage(error), hashes });
        throw error;
      }
    },
    [
      address,
      enabled,
      ensureChain,
      publicClient,
      refresh,
      waitForSuccess,
      writeContractAsync,
    ],
  );

  const withdraw = useCallback(
    async (amount: bigint): Promise<Hash[]> => {
      if (!enabled) throw new Error("Vault is not deployed.");
      if (!address) throw new Error("Connect a wallet first.");
      if (amount <= 0n) throw new Error("Enter an amount above zero.");

      setTx({ busy: true, step: "Withdrawing…", error: null, hashes: [] });
      try {
        await ensureChain();
        const hash = await writeContractAsync(withdrawCall(amount));
        setTx((prev) => ({
          ...prev,
          step: "Waiting for withdrawal…",
          hashes: [hash],
        }));
        await waitForSuccess(hash);
        setTx({ busy: false, step: null, error: null, hashes: [hash] });
        await refresh();
        return [hash];
      } catch (error) {
        setTx((prev) => ({
          ...prev,
          busy: false,
          step: null,
          error: getErrorMessage(error),
        }));
        throw error;
      }
    },
    [address, enabled, ensureChain, refresh, waitForSuccess, writeContractAsync],
  );

  return {
    address,
    connectedChainId: chainId,
    enabled,
    configured: CONTRACTS_CONFIGURED,
    isWrongNetwork: Boolean(address) && chainId !== CHAIN_ID,
    decimals,
    walletBalance,
    vaultBalance,
    allowance,
    price,
    maxBatch,
    tx,
    deposit,
    withdraw,
    refresh,
    clearError: () => setTx(INITIAL_TX),
  };
}

export type VaultHandle = ReturnType<typeof useVault>;
