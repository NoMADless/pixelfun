import {
  CANVAS_PIXEL_COUNT,
  PALETTE_SIZE,
  SLOT_BYTES,
  TOTAL_SLOTS,
  byteFromPaletteIndex,
} from "./palette";

export { CANVAS_PIXEL_COUNT, SLOT_BYTES, TOTAL_SLOTS };

export function createEmptyCanvas(): Uint8Array {
  return new Uint8Array(CANVAS_PIXEL_COUNT);
}

export function isValidPixelId(id: number): boolean {
  return Number.isInteger(id) && id >= 0 && id < CANVAS_PIXEL_COUNT;
}

/** Apply paint(ids, colors) where colors are palette indexes 0..31. */
export function applyPaint(
  canvas: Uint8Array,
  ids: readonly number[],
  colors: readonly number[],
): number {
  const length = Math.min(ids.length, colors.length);
  let applied = 0;
  for (let i = 0; i < length; i++) {
    const id = ids[i];
    const color = colors[i];
    if (!isValidPixelId(id)) continue;
    if (!Number.isInteger(color) || color < 0 || color >= PALETTE_SIZE) continue;
    canvas[id] = byteFromPaletteIndex(color);
    applied++;
  }
  return applied;
}

export function pixelsToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToPixels(base64: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  return new Uint8Array(Buffer.from(base64, "base64"));
}

export function assertCanvasLength(bytes: Uint8Array | ArrayLike<number>): Uint8Array {
  const result = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (result.length !== CANVAS_PIXEL_COUNT) {
    throw new Error(`Canvas has ${result.length} bytes, expected ${CANVAS_PIXEL_COUNT}.`);
  }
  return result;
}

export function chunkSlots(total = TOTAL_SLOTS, chunkSize = 512): Array<{
  startSlot: number;
  slotCount: number;
}> {
  const chunks: Array<{ startSlot: number; slotCount: number }> = [];
  const size = Math.max(1, Math.min(TOTAL_SLOTS, Math.floor(chunkSize)));
  for (let start = 0; start < total; start += size) {
    chunks.push({ startSlot: start, slotCount: Math.min(size, total - start) });
  }
  return chunks;
}
