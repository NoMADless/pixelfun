import { connection } from "next/server";
import { CONTRACTS_CONFIGURED, VAULT_ADDRESS } from "@/config/chains";
import { isMockMode } from "@/config/server";
import {
  getReadClient,
  readBoardSize,
  readCurrentEpoch,
  readEpochEnd,
  readEpochEnded,
  readEpochLength,
  readEpochStart,
  readMinPixels,
  readPriceWithFallback,
  readTokenDecimals,
  readTotalBurned,
  readTotalPixelsPainted,
} from "@/lib/contract";
import { getMockStats } from "@/server/mock-leaderboard";

const PUBLIC_HEADERS = {
  "Cache-Control": "public, s-maxage=4, stale-while-revalidate=30",
};

export async function GET() {
  await connection();

  if (isMockMode()) {
    return Response.json(getMockStats(), { headers: PUBLIC_HEADERS });
  }

  if (!VAULT_ADDRESS || !CONTRACTS_CONFIGURED) {
    return Response.json(
      {
        error: "not_deployed",
        message:
          "PixelFunVault is not configured. Set NEXT_PUBLIC_VAULT_ADDRESS and NEXT_PUBLIC_IMD_ADDRESS, or run with MOCK_MODE=true.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const client = getReadClient();
    const [totalPixelsPainted, priceRead, decimals, currentEpoch, minPixels, boardSize, epochLength] =
      await Promise.all([
        readTotalPixelsPainted(client),
        readPriceWithFallback(client),
        readTokenDecimals(client),
        readCurrentEpoch(client),
        readMinPixels(client),
        readBoardSize(client),
        readEpochLength(client),
      ]);
    const [epochStart, epochEnd, epochEnded] = await Promise.all([
      readEpochStart(currentEpoch, client),
      readEpochEnd(currentEpoch, client),
      readEpochEnded(currentEpoch, client),
    ]);

    // totalBurned() is the contract's own counter. Keep the old
    // totalPixelsPainted × PRICE math as a fallback for RPC builds without it.
    let totalBurned: bigint | null = null;
    try {
      totalBurned = await readTotalBurned(client);
    } catch {
      totalBurned = null;
    }
    const price = priceRead.price ?? 0n;
    const burned = totalBurned ?? totalPixelsPainted * price;

    return Response.json(
      {
        mock: false,
        totalPixelsPainted: totalPixelsPainted.toString(),
        price: price.toString(),
        priceSource: priceRead.source,
        burned: burned.toString(),
        burnedSource: totalBurned === null ? "painted-times-price" : "totalBurned",
        decimals,
        currentEpoch: currentEpoch.toString(),
        epochStart: epochStart.toString(),
        epochEnd: epochEnd.toString(),
        epochEnded,
        epochLength: epochLength.toString(),
        minPixels,
        boardSize,
        serverTime: Date.now(),
      },
      { headers: PUBLIC_HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: "rpc_failed", message },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
