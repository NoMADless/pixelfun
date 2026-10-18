import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type Rgba = readonly [number, number, number, number];

const BG: Rgba = [0x13, 0x11, 0x1c, 255];
const CREAM: Rgba = [0xf4, 0xef, 0xe3, 255];
const MUTED: Rgba = [0x8b, 0x9b, 0xb4, 255];
const ACCENT: Rgba = [0xf7, 0x76, 0x22, 255];
const COLORS: Rgba[] = [
  [0xe4, 0x3b, 0x44, 255],
  [0xf7, 0x76, 0x22, 255],
  [0xfe, 0xe7, 0x61, 255],
  [0x63, 0xc7, 0x4d, 255],
  [0x2c, 0xe8, 0xf5, 255],
  [0x68, 0x38, 0x6c, 255],
  [0xb5, 0x50, 0x88, 255],
  [0x00, 0x99, 0xdb, 255],
];

const FONT: Record<string, readonly string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00000", "00100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
};

interface Canvas {
  width: number;
  height: number;
  data: Uint8Array;
}

function createCanvas(width: number, height: number, background: Rgba): Canvas {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = background[0];
    data[i * 4 + 1] = background[1];
    data[i * 4 + 2] = background[2];
    data[i * 4 + 3] = background[3];
  }
  return { width, height, data };
}

function setPixel(canvas: Canvas, x: number, y: number, color: Rgba): void {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const offset = (y * canvas.width + x) * 4;
  canvas.data[offset] = color[0];
  canvas.data[offset + 1] = color[1];
  canvas.data[offset + 2] = color[2];
  canvas.data[offset + 3] = color[3];
}

function fillRect(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  color: Rgba,
): void {
  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) setPixel(canvas, px, py, color);
  }
}

function drawText(
  canvas: Canvas,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: Rgba | ((index: number, char: string) => Rgba),
): number {
  let cursor = x;
  for (let index = 0; index < text.length; index++) {
    const char = text[index].toUpperCase();
    const glyph = FONT[char] ?? FONT[" "];
    const glyphColor = typeof color === "function" ? color(index, char) : color;
    glyph.forEach((row, gy) => {
      row.split("").forEach((cell, gx) => {
        if (cell !== "1") return;
        fillRect(canvas, cursor + gx * scale, y + gy * scale, scale, scale, glyphColor);
      });
    });
    cursor += 6 * scale;
  }
  return cursor - x;
}

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

function drawBorder(canvas: Canvas, inset: number, thickness: number): void {
  const colors = COLORS;
  const size = 32;
  for (let x = inset; x < canvas.width - inset; x += size) {
    const color = colors[Math.floor(x / size) % colors.length];
    fillRect(canvas, x, inset, Math.min(size, canvas.width - inset - x), thickness, color);
    fillRect(
      canvas,
      x,
      canvas.height - inset - thickness,
      Math.min(size, canvas.width - inset - x),
      thickness,
      color,
    );
  }
  for (let y = inset; y < canvas.height - inset; y += size) {
    const color = colors[Math.floor(y / size) % colors.length];
    fillRect(canvas, inset, y, thickness, Math.min(size, canvas.height - inset - y), color);
    fillRect(
      canvas,
      canvas.width - inset - thickness,
      y,
      thickness,
      Math.min(size, canvas.height - inset - y),
      color,
    );
  }
}

function drawPixelTiles(canvas: Canvas, y: number): void {
  const size = 24;
  const gap = 12;
  const count = 16;
  const total = count * size + (count - 1) * gap;
  let x = Math.floor((canvas.width - total) / 2);
  for (let index = 0; index < count; index++) {
    const color = COLORS[index % COLORS.length];
    fillRect(canvas, x, y, size, size, color);
    x += size + gap;
  }
}

function png(canvas: Canvas): Buffer {
  const raw = Buffer.alloc((canvas.width * 4 + 1) * canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    raw[y * (canvas.width * 4 + 1)] = 0;
    Buffer.from(canvas.data.buffer, y * canvas.width * 4, canvas.width * 4).copy(
      raw,
      y * (canvas.width * 4 + 1) + 1,
    );
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(canvas.width, 0);
  header.writeUInt32BE(canvas.height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let k = 0; k < 8; k++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
}

function ico(pngBuffer: Buffer): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = 64;
  entry[1] = 64;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, pngBuffer]);
}

function makeOg(): Canvas {
  const canvas = createCanvas(1200, 630, BG);
  drawBorder(canvas, 18, 6);

  const word = "PIXELFUN";
  const wordScale = 13;
  const wordX = Math.floor((canvas.width - textWidth(word, wordScale)) / 2);
  drawText(canvas, word, wordX, 138, wordScale, (_index, char) =>
    char === "X" ? ACCENT : CREAM,
  );

  const subtitle = "FULLY ON-CHAIN PIXEL CANVAS";
  const subtitleScale = 4;
  drawText(
    canvas,
    subtitle,
    Math.floor((canvas.width - textWidth(subtitle, subtitleScale)) / 2),
    300,
    subtitleScale,
    MUTED,
  );

  drawPixelTiles(canvas, 410);

  const footer = "512 X 512  /  ROBINHOOD CHAIN";
  const footerScale = 3;
  drawText(
    canvas,
    footer,
    Math.floor((canvas.width - textWidth(footer, footerScale)) / 2),
    505,
    footerScale,
    ACCENT,
  );

  return canvas;
}

function makeIcon(size: number): Canvas {
  const canvas = createCanvas(size, size, BG);
  const unit = Math.max(2, Math.round(size / 16));
  const border = Math.max(4, Math.round(size / 10));
  drawBorder(canvas, border, unit);

  const glyph = FONT.P;
  const scale = Math.max(2, Math.floor((size - border * 2 - 8) / 7));
  const width = 5 * scale;
  const height = 7 * scale;
  const startX = Math.floor((size - width) / 2);
  const startY = Math.floor((size - height) / 2);
  glyph.forEach((row, gy) => {
    row.split("").forEach((cell, gx) => {
      if (cell === "1") fillRect(canvas, startX + gx * scale, startY + gy * scale, scale, scale, CREAM);
    });
  });
  fillRect(canvas, startX + scale * 2, startY + scale * 6, scale * 2, scale, ACCENT);
  return canvas;
}

function write(path: string, buffer: Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
  console.log(`wrote ${path} (${buffer.length} bytes)`);
}

const root = process.cwd();
write(join(root, "public", "og.png"), png(makeOg()));

const icon = png(makeIcon(64));
write(join(root, "public", "favicon.png"), icon);
write(join(root, "src", "app", "favicon.ico"), ico(icon));
write(join(root, "public", "apple-touch-icon.png"), png(makeIcon(180)));
