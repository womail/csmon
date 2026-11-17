export type Palette = "light" | "dark";
/** Saved choice. `system` follows the browser light or dark setting. */
export type PaletteMode = Palette | "system";

export function prefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

let systemListener: ((event: MediaQueryListEvent) => void) | null = null;

export function effectivePalette(mode: PaletteMode): Palette {
  if (mode === "dark" || mode === "light") return mode;
  return prefersDark() ? "dark" : "light";
}

export function applyPalette(mode: PaletteMode) {
  if (typeof document === "undefined") return;
  if (systemListener && typeof window !== "undefined") {
    window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", systemListener);
    systemListener = null;
  }
  const paint = () => {
    const dark = effectivePalette(mode) === "dark";
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = mode === "system" ? "light dark" : dark ? "dark" : "light";
  };
  paint();
  if (mode === "system" && typeof window !== "undefined") {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    systemListener = () => paint();
    query.addEventListener("change", systemListener);
  }
}

export function resolvePalette(stored?: string | null): PaletteMode {
  if (stored === "dark" || stored === "light" || stored === "system") return stored;
  return "system";
}
