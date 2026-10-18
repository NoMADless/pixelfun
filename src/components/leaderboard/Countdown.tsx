"use client";

import { useEffect, useState } from "react";
import { useMounted } from "@/lib/hooks/useMounted";
import { countdownParts } from "@/shared/time";

interface Props {
  epochEnd: string;
  ended: boolean;
  serverTime: number;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function Countdown({ epochEnd, ended, serverTime }: Props) {
  const mounted = useMounted();
  const [now, setNow] = useState(() => Date.now());
  // Clock skew is constant for the life of the page; keep the first offset.
  const [offset] = useState(() => serverTime - Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  // Date.now differs between the server pass and hydration; render a stable
  // placeholder until the client owns the clock.
  if (!mounted) {
    return (
      <div className="border-2 border-ink bg-bg px-2 py-2">
        <p className="mb-1 text-[8px] font-bold uppercase tracking-wider text-muted">
          Until round ends
        </p>
        <div className="flex items-start gap-1">
          {["Days", "Hrs", "Min", "Sec"].map((label) => (
            <div key={label} className="min-w-[42px] text-center">
              <div className="border-2 border-ink bg-panel px-1 py-1 font-mono text-sm leading-none text-muted sm:text-base">
                --
              </div>
              <div className="mt-0.5 text-[7px] font-bold uppercase tracking-wider text-muted">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const endMs = Number(epochEnd) * 1_000;
  const remaining = Math.max(0, endMs - (now + offset));
  const { days, hours, minutes, seconds } = countdownParts(remaining);

  if (ended) {
    return (
      <div className="border-2 border-pfgreen bg-pfgreen/10 px-3 py-2">
        <p className="text-[8px] font-bold uppercase tracking-wider text-muted">Round status</p>
        <p className="pixel-font mt-1 text-[11px] text-pfgreen">FINAL · EPOCH ENDED</p>
        <p className="mt-1 text-[9px] text-muted">This round&apos;s whitelist is locked.</p>
      </div>
    );
  }

  if (remaining <= 0) {
    return (
      <div className="border-2 border-accent bg-accent/10 px-3 py-2">
        <p className="text-[8px] font-bold uppercase tracking-wider text-muted">Round status</p>
        <p className="pixel-font mt-1 text-[10px] text-accent">AWAITING FINALIZATION</p>
        <p className="mt-1 text-[9px] text-muted">
          Time is up. Whitelist is not final until epochEnded is true.
        </p>
      </div>
    );
  }

  const cells = [
    { label: "Days", value: pad(days) },
    { label: "Hrs", value: pad(hours) },
    { label: "Min", value: pad(minutes) },
    { label: "Sec", value: pad(seconds) },
  ];

  return (
    <div className="border-2 border-ink bg-bg px-2 py-2">
      <p className="mb-1 text-[8px] font-bold uppercase tracking-wider text-muted">
        Until round ends
      </p>
      <div className="flex items-start gap-1" aria-live="off">
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-[42px] text-center">
            <div className="border-2 border-ink bg-panel px-1 py-1 font-mono text-sm leading-none tabular-nums sm:text-base">
              {cell.value}
            </div>
            <div className="mt-0.5 text-[7px] font-bold uppercase tracking-wider text-muted">
              {cell.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
