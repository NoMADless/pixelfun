"use client";

import { useSyncExternalStore } from "react";
import { useMounted } from "@/lib/hooks/useMounted";

const CHANGE_EVENT = "pixelfun:theme-change";

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot(): boolean {
  return false;
}

export function ThemeToggle() {
  const mounted = useMounted();
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("pixelfun-theme", next ? "dark" : "light");
    } catch {
      // storage may be unavailable
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="pixel-btn h-9 w-9 text-sm"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      <span aria-hidden className={mounted ? "" : "opacity-0"}>
        {dark ? "☀" : "☾"}
      </span>
    </button>
  );
}
