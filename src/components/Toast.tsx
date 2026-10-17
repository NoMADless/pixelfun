"use client";

export interface ToastItem {
  id: number;
  kind: "success" | "error" | "info";
  title: string;
  detail?: string;
  href?: string;
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col items-center gap-2 sm:items-end">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pf-rise pointer-events-auto w-full max-w-sm border-2 border-ink p-3 text-xs shadow-[3px_3px_0_0_var(--pf-ink)] ${
            toast.kind === "error"
              ? "bg-accent text-accentink"
              : toast.kind === "success"
                ? "bg-panel"
                : "bg-panel2"
          }`}
          role="status"
        >
          <div className="flex items-start gap-2">
            <span className="mt-[1px] text-sm" aria-hidden>
              {toast.kind === "error" ? "✕" : toast.kind === "success" ? "✓" : "!"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-bold leading-snug">{toast.title}</div>
              {toast.detail && <div className="mt-1 break-words opacity-85">{toast.detail}</div>}
              {toast.href && (
                <a
                  href={toast.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block underline underline-offset-2"
                >
                  View transaction ↗
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="ml-1 shrink-0 opacity-70 hover:opacity-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
