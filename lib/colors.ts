const PALETTE = [
  "#e11d48",
  "#f97316",
  "#d97706",
  "#65a30d",
  "#0d9488",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#4f46e5",
];

export function colorFor(key: string) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export const TAG_COLORS: Record<string, { bg: string; fg: string }> = {
  conflict: { bg: "#fee2e2", fg: "#b91c1c" },
  cyber: { bg: "#ede9fe", fg: "#6d28d9" },
  markets: { bg: "#dcfce7", fg: "#15803d" },
  tech: { bg: "#dbeafe", fg: "#1d4ed8" },
  ai: { bg: "#fae8ff", fg: "#86198f" },
  media: { bg: "#ffedd5", fg: "#c2410c" },
  climate: { bg: "#ccfbf1", fg: "#0f766e" },
  politics: { bg: "#fef9c3", fg: "#a16207" },
  science: { bg: "#e0f2fe", fg: "#0369a1" },
  energy: { bg: "#fce7f3", fg: "#be185d" },
  health: { bg: "#d1fae5", fg: "#047857" },
  diplomacy: { bg: "#e0e7ff", fg: "#4338ca" },
  disaster: { bg: "#ffe4e6", fg: "#9f1239" },
  weather: { bg: "#e0f2fe", fg: "#0369a1" },
  quake: { bg: "#ffedd5", fg: "#c2410c" },
  war: { bg: "#fee2e2", fg: "#991b1b" },
  unrest: { bg: "#ede9fe", fg: "#6d28d9" },
  nuclear: { bg: "#fef3c7", fg: "#b45309" },
  defense: { bg: "#e2e8f0", fg: "#1e3a5f" },
  sports: { bg: "#ecfccb", fg: "#3f6212" },
  world: { bg: "#e2e8f0", fg: "#334155" },
  place: { bg: "#ecfeff", fg: "#0e7490" },
};

export function tagStyle(tag: string) {
  return TAG_COLORS[tag] ?? TAG_COLORS.place;
}
