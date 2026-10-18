import { isAddress } from "viem";
import { isMockMode } from "@/config/server";
import { applyMockPaint } from "@/server/mock-canvas";
import { recordMockPaint } from "@/server/mock-leaderboard";

export async function POST(request: Request) {
  if (!isMockMode()) {
    return Response.json({ error: "not_available" }, { status: 404 });
  }

  let body: { ids?: unknown; colors?: unknown; painter?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_body", message: "Expected JSON." }, { status: 400 });
  }

  if (!Array.isArray(body.ids) || !Array.isArray(body.colors)) {
    return Response.json(
      { error: "invalid_pixels", message: "ids and colors must be arrays." },
      { status: 400 },
    );
  }
  if (typeof body.painter !== "string" || !isAddress(body.painter)) {
    return Response.json(
      { error: "invalid_painter", message: "painter must be an EVM address." },
      { status: 400 },
    );
  }

  try {
    const result = applyMockPaint({
      ids: body.ids,
      colors: body.colors,
      painter: body.painter,
    });
    recordMockPaint(body.painter, result.pixelCount);
    return Response.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: "mock_paint_failed", message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
