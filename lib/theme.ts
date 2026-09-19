export type Palette = "light" | "dark";

export function prefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyPalette(palette: Palette) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", palette === "dark");
  document.documentElement.style.colorScheme = palette;
}

export function resolvePalette(stored?: string | null): Palette {
  if (stored === "dark" || stored === "light") return stored;
  return prefersDark() ? "dark" : "light";
}
