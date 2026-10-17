/** Contract palette: color argument is an index 0..31. */
export const PALETTE = [
  "#be4a2f",
  "#d77643",
  "#ead4aa",
  "#e4a672",
  "#b86f50",
  "#733e39",
  "#3e2731",
  "#a22633",
  "#e43b44",
  "#f77622",
  "#feae34",
  "#fee761",
  "#63c74d",
  "#3e8948",
  "#265c42",
  "#193c3e",
  "#124e89",
  "#0099db",
  "#2ce8f5",
  "#ffffff",
  "#c0cbdc",
  "#8b9bb4",
  "#5a6988",
  "#3a4466",
  "#262b44",
  "#181425",
  "#ff0044",
  "#68386c",
  "#b55088",
  "#f6757a",
  "#e8b796",
  "#c28569",
] as const;

export const PALETTE_SIZE = PALETTE.length;
export const CANVAS_WIDTH = 512;
export const CANVAS_HEIGHT = 512;
export const CANVAS_PIXEL_COUNT = CANVAS_WIDTH * CANVAS_HEIGHT; // 262144
export const SLOT_BYTES = 32;
export const TOTAL_SLOTS = CANVAS_PIXEL_COUNT / SLOT_BYTES; // 8192
export const PAPER = "#f4efe3";
export const UNPAINTED_BYTE = 0;
export const MAX_BATCH_FALLBACK = 100;
export const TOKEN_SYMBOL = "IMD";
export const PRICE_DISPLAY = "0.005";

export type PaletteIndex = number;

/** Stored byte 1..32 maps to palette index 0..31. Byte 0 is unpainted. */
export function paletteIndexFromByte(byte: number): number | null {
  if (!Number.isInteger(byte) || byte < 1 || byte > PALETTE_SIZE) return null;
  return byte - 1;
}

export function byteFromPaletteIndex(index: number): number {
  return index + 1;
}

export function isPaintedByte(byte: number): boolean {
  return byte >= 1 && byte <= PALETTE_SIZE;
}

export function paletteColor(index: number): string {
  return Number.isInteger(index) && index >= 0 && index < PALETTE_SIZE
    ? PALETTE[index]
    : PAPER;
}

export function isPaletteIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < PALETTE_SIZE;
}
