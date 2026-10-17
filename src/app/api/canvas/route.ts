import { connection } from "next/server";
import { VAULT_ADDRESS } from "@/config/chains";
import { isMockMode, serverCanvasChunkSlots } from "@/config/server";
import {
  getLatestBlockNumber,
  getReadClient,
  readCanvasFromRpc,
} from "@/lib/contract";
import { getMockCanvas } from "@/server/mock-canvas";
import { pixelsToBase64 } from "@/shared/canvas";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/shared/palette";

export async function GET() {
  await connection();
  const lastSync = new Date().toISOString();

  if (isMockMode()) {
    const input = getMockCanvas();
    return Response.json(
      {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        pixels: pixelsToBase64(input.bytes),
        lastSync,
        blockNumber: null,
        mock: true,
        totalPainted: input.totalPainted,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3, stale-while-revalidate=30",
        },
      },
    );
  }

  if (!VAULT_ADDRESS) {
    return Response.json(
      {
        error: "not_deployed",
        message:
          "PixelFunVault is not configured. Set NEXT_PUBLIC_VAULT_ADDRESS or run with MOCK_MODE=true.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const client = getReadClient();
    const bytes = await readCanvasFromRpc({
      client,
      chunkSlots: serverCanvasChunkSlots(),
      concurrency: 4,
      retries: 2,
    });
    const blockNumber = await getLatestBlockNumber(client);
    return Response.json(
      {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        pixels: pixelsToBase64(bytes),
        lastSync,
        blockNumber: blockNumber.toString(),
        mock: false,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3, stale-while-revalidate=30",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: "rpc_failed", message },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
