import { describe, expect, it } from "vitest";
import { pixelsToEnterTop, whitelistCsv } from "@/shared/leaderboard";

const fullBoard = Array.from({ length: 66 }, (_, index) => 1_000 - index * 10);
// Lowest entry on the full board is 1_000 - 65 * 10 = 350.

describe("pixelsToEnterTop", () => {
  it("requires strictly more than the lowest entry when the board is full", () => {
    expect(
      pixelsToEnterTop({
        myPixels: 50,
        minPixels: 20,
        boardSize: 66,
        boardCounts: fullBoard,
        myRank: null,
      }),
    ).toBe(301);
  });

  it("uses MIN_PIXELS when the board is not full", () => {
    expect(
      pixelsToEnterTop({
        myPixels: 5,
        minPixels: 20,
        boardSize: 66,
        boardCounts: [100, 80, 60],
        myRank: null,
      }),
    ).toBe(15);
  });

  it("returns zero for a player already on the board", () => {
    expect(
      pixelsToEnterTop({
        myPixels: 500,
        minPixels: 20,
        boardSize: 66,
        boardCounts: fullBoard,
        myRank: 10,
      }),
    ).toBe(0);
  });

  it("handles a player below MIN_PIXELS on a non-full board", () => {
    expect(
      pixelsToEnterTop({
        myPixels: 3,
        minPixels: 20,
        boardSize: 66,
        boardCounts: [90, 70],
        myRank: null,
      }),
    ).toBe(17);
  });

  it("applies the tie-break rule to a player below MIN_PIXELS on a full board", () => {
    expect(
      pixelsToEnterTop({
        myPixels: 5,
        minPixels: 20,
        boardSize: 66,
        boardCounts: fullBoard,
        myRank: null,
      }),
    ).toBe(346);
  });

  it("never returns a negative gap when the viewer already clears the bar", () => {
    expect(
      pixelsToEnterTop({
        myPixels: 9_999,
        minPixels: 20,
        boardSize: 66,
        boardCounts: [100, 80],
        myRank: null,
      }),
    ).toBe(0);
  });
});

describe("whitelistCsv", () => {
  it("writes one lowercase address per line with a trailing newline", () => {
    const csv = whitelistCsv([
      { address: "0xABC0000000000000000000000000000000000001" },
      { address: "0xdef0000000000000000000000000000000000002" },
    ]);
    expect(csv).toBe(
      "0xabc0000000000000000000000000000000000001\n0xdef0000000000000000000000000000000000002\n",
    );
  });

  it("returns an empty string for an empty board", () => {
    expect(whitelistCsv([])).toBe("");
  });
});
