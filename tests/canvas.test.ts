import { describe, expect, it } from "vitest";
import {
  base64ToPixels,
  pixelIdFromXY,
  pixelsToBase64,
  xyFromPixelId,
} from "@/shared/canvas";
import { byteFromPaletteIndex, paletteIndexFromByte } from "@/shared/palette";

describe("pixel id mapping", () => {
  it("maps the top-left and bottom-right corners", () => {
    expect(pixelIdFromXY(0, 0)).toBe(0);
    expect(pixelIdFromXY(511, 511)).toBe(262_143);
  });

  it("round-trips arbitrary coordinates", () => {
    for (const [x, y] of [
      [0, 1],
      [17, 42],
      [300, 7],
      [511, 0],
    ]) {
      expect(xyFromPixelId(pixelIdFromXY(x, y))).toEqual({ x, y });
    }
  });

  it("rejects coordinates outside the canvas", () => {
    expect(() => pixelIdFromXY(-1, 0)).toThrow(RangeError);
    expect(() => pixelIdFromXY(512, 0)).toThrow(RangeError);
    expect(() => xyFromPixelId(262_144)).toThrow(RangeError);
  });
});

describe("pixel pack/unpack", () => {
  it("round-trips storage bytes through base64", () => {
    const source = new Uint8Array([0, 1, 2, 31, 32, 255, 17, 200]);
    expect(base64ToPixels(pixelsToBase64(source))).toEqual(source);
  });

  it("maps palette indexes to the contract's 1-based storage bytes", () => {
    expect(byteFromPaletteIndex(0)).toBe(1);
    expect(byteFromPaletteIndex(31)).toBe(32);
    expect(paletteIndexFromByte(1)).toBe(0);
    expect(paletteIndexFromByte(32)).toBe(31);
    expect(paletteIndexFromByte(0)).toBeNull();
    expect(paletteIndexFromByte(33)).toBeNull();
  });
});
