"use client";

import { PALETTE } from "@/shared/palette";

export function PaletteBar({
  color,
  onChange,
}: {
  color: number;
  onChange: (index: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-2 border-line bg-panel px-2 py-1.5">
      <div
        className="hidden h-8 w-8 shrink-0 border-2 border-ink sm:block"
        style={{ backgroundColor: PALETTE[color] }}
        aria-hidden
      />
      <div className="pf-scroll flex min-w-0 flex-1 gap-1 overflow-x-auto py-0.5">
        {PALETTE.map((hex, index) => (
          <button
            key={hex}
            type="button"
            onClick={() => onChange(index)}
            title={`Color ${index} · ${hex.toUpperCase()}`}
            aria-label={`Color ${index} ${hex}`}
            aria-pressed={color === index}
            className={`h-7 w-7 shrink-0 border-2 transition-transform ${
              color === index
                ? "scale-110 border-ink ring-2 ring-glow ring-offset-1 ring-offset-panel"
                : "border-ink/25 hover:scale-105 hover:border-ink"
            }`}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
      <span className="hidden shrink-0 font-mono text-[10px] text-muted md:inline">
        #{color.toString().padStart(2, "0")} {PALETTE[color].toUpperCase()}
      </span>
    </div>
  );
}
