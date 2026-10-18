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

interface CanvasPayload {
  width: number;
  height: number;
  pixels: string;
  lastSync: string;
  blockNumber: string | null;
  mock: boolean;
}

const SHARED_CACHE_MS = 3_000;
let sharedCache: { at: number; payload: CanvasPayload } | null = null;
let inflight: Promise<CanvasPayload> | null = null;

async function readChainCanvas(): Promise<CanvasPayload> {
  const client = getReadClient();
  // Capture the block first: anything painted while the chunks are read is
  // then replayed from Painted logs instead of falling into a gap.
  const blockNumber = await getLatestBlockNumber(client);
  const bytes = await readCanvasFromRpc({
    client,
    chunkSlots: serverCanvasChunkSlots(),
    concurrency: 4,
    retries: 2,
  });
  return {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    pixels: pixelsToBase64(bytes),
    lastSync: new Date().toISOString(),
    blockNumber: blockNumber.toString(),
    mock: false,
  };
}

/**
 * Coalesce concurrent and near-simultaneous reads so a burst of visitors does
 * not trigger one full 16-call canvas sweep each. CDN caching covers the rest.
 */
async function getSharedCanvas(): Promise<CanvasPayload> {
  const now = Date.now();
  if (sharedCache && now - sharedCache.at < SHARED_CACHE_MS) {
    return sharedCache.payload;
  }
  if (!inflight) {
    inflight = readChainCanvas()
      .then((payload) => {
        sharedCache = { at: Date.now(), payload };
        return payload;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

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
    const payload = await getSharedCanvas();
    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=3, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: "rpc_failed", message },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
