"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { BoardResponse, LeaderboardStats } from "@/shared/leaderboard";

export function useStats(enabled: boolean) {
  return useQuery<LeaderboardStats>({
    queryKey: ["pixelfun-stats"],
    queryFn: () => apiGet<LeaderboardStats>("/api/stats"),
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
  const query = new URLSearchParams();
  if (epoch) query.set("epoch", epoch);
  if (viewer) query.set("viewer", viewer.toLowerCase());

  return useQuery<BoardResponse>({
    queryKey: ["pixelfun-board", epoch, viewer?.toLowerCase() ?? null],
    queryFn: () => apiGet<BoardResponse>(`/api/leaderboard?${query.toString()}`),
    enabled: enabled && Boolean(epoch),
    staleTime: live ? 4_000 : Number.POSITIVE_INFINITY,
    refetchInterval: live && enabled ? 10_000 : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
