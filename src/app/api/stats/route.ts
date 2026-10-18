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
  readPrice,
  readTokenDecimals,
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
    const [totalPixelsPainted, price, decimals, currentEpoch, minPixels, boardSize, epochLength] =
      await Promise.all([
        readTotalPixelsPainted(client),
        readPrice(client),
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

    return Response.json(
      {
        mock: false,
        totalPixelsPainted: totalPixelsPainted.toString(),
        price: price.toString(),
        burned: (totalPixelsPainted * price).toString(),
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
