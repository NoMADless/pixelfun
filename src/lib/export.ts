import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PALETTE,
  PAPER,
  paletteIndexFromByte,
} from "@/shared/palette";

const MAX_EXPORT_SCALE = 8;

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

/**
 * Render the canvas bytes to a PNG at `scale`x using nearest-neighbour scaling.
 * Draft pixels are intentionally excluded: the export is the on-chain canvas.
 */
export async function canvasPngBlob(pixels: Uint8Array, scale = 4): Promise<Blob> {
  if (typeof document === "undefined") throw new Error("PNG export needs a browser.");
  if (!Number.isInteger(scale) || scale < 1 || scale > MAX_EXPORT_SCALE) {
    throw new RangeError(`scale must be an integer between 1 and ${MAX_EXPORT_SCALE}.`);
  }
  if (pixels.length !== CANVAS_WIDTH * CANVAS_HEIGHT) {
    throw new Error(`Canvas has ${pixels.length} bytes, expected 262,144.`);
  }

  const source = document.createElement("canvas");
  source.width = CANVAS_WIDTH;
  source.height = CANVAS_HEIGHT;
  const sourceContext = source.getContext("2d");
  if (!sourceContext) throw new Error("Could not create the canvas export context.");

  const image = sourceContext.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
  const paper = hexToRgb(PAPER);
  const palette = PALETTE.map(hexToRgb);
  for (let id = 0; id < pixels.length; id++) {
    const index = paletteIndexFromByte(pixels[id] ?? 0);
    const [r, g, b] = index === null ? paper : palette[index];
    const offset = id * 4;
    image.data[offset] = r;
    image.data[offset + 1] = g;
    image.data[offset + 2] = b;
    image.data[offset + 3] = 255;
  }
  sourceContext.putImageData(image, 0, 0);

  const output = document.createElement("canvas");
  output.width = CANVAS_WIDTH * scale;
  output.height = CANVAS_HEIGHT * scale;
  const outputContext = output.getContext("2d");
  if (!outputContext) throw new Error("Could not create the export canvas.");
  outputContext.imageSmoothingEnabled = false;
  outputContext.drawImage(source, 0, 0, output.width, output.height);

  return new Promise<Blob>((resolve, reject) => {
    output.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not encode the PNG."));
    }, "image/png");
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
