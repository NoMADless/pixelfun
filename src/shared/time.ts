export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

const DAY_SECONDS = 86_400;
const HOUR_SECONDS = 3_600;

/** Split a millisecond duration into whole countdown cells, clamped at zero. */
export function countdownParts(remainingMs: number): CountdownParts {
  const safe = Number.isFinite(remainingMs) ? Math.max(0, remainingMs) : 0;
  const totalSeconds = Math.floor(safe / 1_000);
  return {
    days: Math.floor(totalSeconds / DAY_SECONDS),
    hours: Math.floor((totalSeconds % DAY_SECONDS) / HOUR_SECONDS),
    minutes: Math.floor((totalSeconds % HOUR_SECONDS) / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
  };
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

/** Compact, stable text form used in tests and copy strings. */
export function formatCountdown(remainingMs: number): string {
  const parts = countdownParts(remainingMs);
  return `${parts.days}d ${pad(parts.hours)}h ${pad(parts.minutes)}m ${pad(parts.seconds)}s`;
}

/** Human duration for static copy such as "3 days" or "12 hours". */
export function formatDurationSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds === 0) return "0 days";
  if (seconds >= DAY_SECONDS) {
    const days = seconds / DAY_SECONDS;
    return `${Number.isInteger(days) ? days : days.toFixed(1)} days`;
  }
  if (seconds >= HOUR_SECONDS) {
    const hours = seconds / HOUR_SECONDS;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hours`;
  }
  return `${Math.round(seconds)} seconds`;
}
