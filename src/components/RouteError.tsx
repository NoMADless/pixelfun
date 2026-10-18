"use client";

import { useEffect } from "react";
import { ErrorPanel } from "./PageState";

export function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("PixelFun route error:", error);
  }, [error]);

  return (
    <ErrorPanel
      title="VIEW FAILED"
      message={
        error.message ||
        "An unexpected error stopped this view. The chain can be retried without reloading the page."
      }
      onRetry={() => retry()}
    />
  );
}
