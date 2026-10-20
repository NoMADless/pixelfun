"use client";

import { useQuery } from "@tanstack/react-query";
import { isAddress, type Address } from "viem";
import { fetchBoard, fetchStats } from "@/lib/chain-reads";
import { getMockBoard, getMockStats } from "@/lib/mock-leaderboard";
import { useRuntimeConfig } from "@/lib/runtime";
import type { BoardResponse, LeaderboardStats } from "@/shared/leaderboard";

/**
 * Stats and boards are read straight from the contract in the browser: this app
 * is a static export, so there is no `/api/*` to call.
 */
export function useStats(enabled: boolean) {
  const { mockMode } = useRuntimeConfig();
  return useQuery<LeaderboardStats>({
    queryKey: ["pixelfun-stats", mockMode],
    queryFn: () => (mockMode ? Promise.resolve(getMockStats()) : fetchStats()),
    enabled,
    staleTime: 4_000,
    refetchInterval: enabled ? 10_000 : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}

export function useBoard(
  epoch: string | null,
  viewer: string | null,
  live: boolean,
  enabled = true,
) {
  const { mockMode } = useRuntimeConfig();
  const viewerAddress = viewer && isAddress(viewer) ? (viewer as Address) : null;

  return useQuery<BoardResponse>({
    queryKey: ["pixelfun-board", mockMode, epoch, viewerAddress?.toLowerCase() ?? null],
    queryFn: async () => {
      if (!epoch) throw new Error("Round is not loaded yet.");
      if (mockMode) {
        const board = getMockBoard(Number(epoch), viewerAddress ?? undefined);
        if (!board) throw new Error("That round has not started yet.");
        return board;
      }
      return fetchBoard(BigInt(epoch), viewerAddress);
    },
    enabled: enabled && Boolean(epoch),
    staleTime: live ? 4_000 : Number.POSITIVE_INFINITY,
    refetchInterval: live && enabled ? 10_000 : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
