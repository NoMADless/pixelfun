import { describe, expect, it } from "vitest";
import { countdownParts, formatCountdown, formatDurationSeconds } from "@/shared/time";

describe("countdown formatting", () => {
  it("splits days, hours, minutes and seconds", () => {
    const remaining =
      1 * 86_400_000 + 8 * 3_600_000 + 56 * 60_000 + 21_000;
    expect(countdownParts(remaining)).toEqual({
      days: 1,
      hours: 8,
      minutes: 56,
      seconds: 21,
      totalSeconds: 1 * 86_400 + 8 * 3_600 + 56 * 60 + 21,
    });
    expect(formatCountdown(remaining)).toBe("1d 08h 56m 21s");
  });

  it("clamps expired and invalid durations to zero", () => {
    expect(formatCountdown(-5_000)).toBe("0d 00h 00m 00s");
    expect(formatCountdown(Number.NaN)).toBe("0d 00h 00m 00s");
  });

  it("pads single-digit cells", () => {
    expect(formatCountdown(5_000)).toBe("0d 00h 00m 05s");
  });
});

describe("formatDurationSeconds", () => {
  it("formats round and partial day lengths", () => {
    expect(formatDurationSeconds(3 * 86_400)).toBe("3 days");
    expect(formatDurationSeconds(1.5 * 86_400)).toBe("1.5 days");
    expect(formatDurationSeconds(2 * 3_600)).toBe("2 hours");
  });
});
