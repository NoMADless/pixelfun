import Link from "next/link";
import type { ReactNode } from "react";

export function PageSkeleton({ label = "LOADING…" }: { label?: string }) {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-2 py-3 sm:px-3" aria-busy="true" aria-label={label}>
      <div className="pixel-panel-strong p-4">
        <div className="h-3 w-24 animate-pulse bg-panel2" />
        <div className="mt-3 h-8 w-64 max-w-full animate-pulse bg-panel2" />
        <div className="mt-4 h-3 w-80 max-w-full animate-pulse bg-panel2" />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="h-64 animate-pulse border-2 border-line bg-panel" />
        <div className="h-44 animate-pulse border-2 border-line bg-panel" />
      </div>
      <p className="pf-blink mt-4 text-center text-[10px] text-muted">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="border-2 border-line bg-panel px-4 py-8 text-center">
      <p className="pixel-font text-[10px] text-muted">{title}</p>
      {children ? <div className="mx-auto mt-3 max-w-md text-[11px] leading-relaxed text-muted">{children}</div> : null}
      {action ? (
        <Link href={action.href} className="pixel-btn mt-4 inline-flex h-8 px-3 text-[10px]">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function ErrorPanel({
  title = "SOMETHING BROKE",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10">
      <div className="border-2 border-accent bg-panel p-5">
        <p className="pixel-font text-[10px] text-accent">{title}</p>
        <p className="mt-3 break-words text-[11px] leading-relaxed text-muted">
          {message ?? "An unexpected error stopped this view from rendering."}
        </p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="pixel-btn mt-4 h-8 px-3 text-[10px]">
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
