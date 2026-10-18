"use client";

import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center p-4">
        <div className="pixel-panel-strong w-full max-w-lg p-5">
          <p className="pixel-font text-[11px] text-accent">PIXELFUN FAILED TO LOAD</p>
          <p className="mt-3 break-words text-[11px] leading-relaxed text-muted">
            {error.message || "The application shell could not render."}
          </p>
          <button type="button" onClick={() => retry()} className="pixel-btn mt-4 h-8 px-3 text-[10px]">
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
