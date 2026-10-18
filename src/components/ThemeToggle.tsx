"use client";

export function ThemeToggle() {
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("pixelfun-theme", next ? "dark" : "light");
    } catch {
      // storage may be unavailable
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="pixel-btn h-9 w-9 text-sm"
      aria-label="Toggle color theme"
      title="Toggle theme"
    >
      <span aria-hidden className="dark:hidden">
        ☾
      </span>
      <span aria-hidden className="hidden dark:inline">
        ☀
      </span>
    </button>
  );
}
