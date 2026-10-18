import type { Metadata } from "next";
import { LeaderboardView } from "@/components/leaderboard/LeaderboardView";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Current and past PixelFun round boards, live countdown, your rank and whitelist spot, with CSV and copy export.",
};

export default function LeaderboardPage() {
  return <LeaderboardView />;
}
