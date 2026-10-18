"use client";

import { useEffect, useState } from "react";

/**
 * False during SSR and the hydration pass, true after the first paint. Use this
 * to render server-stable markup for values owned by the browser (wallet
 * session, clock, pathname-dependent chrome).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  return mounted;
}
