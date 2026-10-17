function envBool(key: string): boolean {
  const value = process.env[key]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

/**
 * MOCK_MODE is the documented switch. NEXT_PUBLIC_MOCK_MODE is accepted as a
 * convenience so the same value can be exposed to tooling if needed.
 */
export function isMockMode(): boolean {
  return envBool("MOCK_MODE") || envBool("NEXT_PUBLIC_MOCK_MODE");
}

export function serverCanvasChunkSlots(): number {
  const parsed = Number.parseInt(process.env.CANVAS_CHUNK_SLOTS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(8192, parsed) : 512;
}
