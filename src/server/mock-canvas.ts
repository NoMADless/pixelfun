import { keccak256, stringToHex } from "viem";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PALETTE_SIZE,
} from "@/shared/palette";
import { applyPaint, createEmptyCanvas, isValidPixelId } from "@/shared/canvas";
import { MOCK_PRICE_RAW } from "@/shared/mock";

interface MockState {
  bytes: Uint8Array;
  seeded: boolean;
  nonce: number;
  lastSync: string;
  totalPainted: number;
}

const globalForMock = globalThis as unknown as { __pixelfunMockCanvas?: MockState };

function state(): MockState {
  if (!globalForMock.__pixelfunMockCanvas) {
    globalForMock.__pixelfunMockCanvas = {
      bytes: createEmptyCanvas(),
      seeded: false,
      nonce: 0,
      lastSync: new Date().toISOString(),
      totalPainted: 0,
    };
  }
  const current = globalForMock.__pixelfunMockCanvas;
  if (!current.seeded) {
    seed(current);
    current.seeded = true;
  }
  return current;
}

const FONT: Record<string, string[]> = {
  P: ["1111.", "1001.", "1001.", "1111.", "100..", "100..", "100.."],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
};

function seed(current: MockState): void {
  const set = (x: number, y: number, paletteIndex: number) => {
    if (x < 0 || y < 0 || x >= CANVAS_WIDTH || y >= CANVAS_HEIGHT) return;
    if (paletteIndex < 0 || paletteIndex >= PALETTE_SIZE) return;
    current.bytes[y * CANVAS_WIDTH + x] = paletteIndex + 1;
  };

  // Frame.
  for (let x = 10; x < CANVAS_WIDTH - 10; x++) {
    set(x, 10, 24);
    set(x, CANVAS_HEIGHT - 11, 24);
  }
  for (let y = 10; y < CANVAS_HEIGHT - 10; y++) {
    set(10, y, 24);
    set(CANVAS_WIDTH - 11, y, 24);
  }

  // PIXELFUN wordmark.
  const word = "PIXELFUN";
  const scale = 3;
  const charWidth = 6 * scale;
  const startX = Math.floor((CANVAS_WIDTH - word.length * charWidth) / 2);
  const startY = 232;
  word.split("").forEach((char, charIndex) => {
    const glyph = FONT[char];
    if (!glyph) return;
    glyph.forEach((row, gy) => {
      row.split("").forEach((cell, gx) => {
        if (cell !== "1") return;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            set(startX + charIndex * charWidth + gx * scale + sx, startY + gy * scale + sy, 11);
          }
        }
      });
    });
  });

  // Heart.
  const heart = [
    "01100110",
    "11111111",
    "11111111",
    "11111111",
    "01111110",
    "00111100",
    "00011000",
  ];
  heart.forEach((row, y) =>
    row.split("").forEach((cell, x) => {
      if (cell === "1") set(110 + x * 5, 130 + y * 5, 8);
    }),
  );

  // Speckles.
  for (let i = 0; i < 60; i++) {
    set(30 + ((i * 83) % 450), 40 + ((i * 149) % 420), (i * 7) % PALETTE_SIZE);
  }

  current.totalPainted = current.bytes.reduce(
    (count, byte) => count + (byte !== 0 ? 1 : 0),
    0,
  );
  current.lastSync = new Date().toISOString();
}

export function getMockCanvas(): {
  bytes: Uint8Array;
  lastSync: string;
  totalPainted: number;
} {
  const current = state();
  return {
    bytes: current.bytes,
    lastSync: current.lastSync,
    totalPainted: current.totalPainted,
  };
}

export interface MockPaintInput {
  ids: unknown[];
  colors: unknown[];
  painter: string;
}

export function applyMockPaint(input: MockPaintInput): {
  txHash: `0x${string}`;
  burnedRaw: string;
  pixelCount: number;
} {
  const current = state();
  const ids = input.ids.map((value) => Number(value));
  const colors = input.colors.map((value) => Number(value));
  if (ids.length === 0 || ids.length !== colors.length) {
    throw new Error("ids and colors must be non-empty arrays of equal length.");
  }
  if (ids.length > 2000) throw new Error("Too many pixels in one mock request.");

  const validIds: number[] = [];
  const validColors: number[] = [];
  for (let i = 0; i < ids.length; i++) {
    if (!isValidPixelId(ids[i])) continue;
    if (!Number.isInteger(colors[i]) || colors[i] < 0 || colors[i] >= PALETTE_SIZE) continue;
    validIds.push(ids[i]);
    validColors.push(colors[i]);
  }
  if (validIds.length === 0) throw new Error("No valid pixels in request.");

  const before = new Set<number>();
  validIds.forEach((id) => {
    if (current.bytes[id] === 0) before.add(id);
  });
  applyPaint(current.bytes, validIds, validColors);
  current.totalPainted += before.size;
  current.nonce += 1;
  current.lastSync = new Date().toISOString();

  const txHash = keccak256(
    stringToHex(`mock-${input.painter}-${current.nonce}-${Date.now()}`),
  );
  return {
    txHash,
    burnedRaw: (BigInt(validIds.length) * MOCK_PRICE_RAW).toString(),
    pixelCount: validIds.length,
  };
}
