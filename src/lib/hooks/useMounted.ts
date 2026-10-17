"use client";

import { useSyncExternalStore } from "react";

function subscribe(): () => void {
  return () => {};
}

export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
