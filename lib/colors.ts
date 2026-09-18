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
  media: { bg: "#ffedd5", fg: "#c2410c" },
  climate: { bg: "#ccfbf1", fg: "#0f766e" },
  politics: { bg: "#fef9c3", fg: "#a16207" },
  science: { bg: "#e0f2fe", fg: "#0369a1" },
  world: { bg: "#e2e8f0", fg: "#334155" },
};

export function tagStyle(tag: string) {
  return TAG_COLORS[tag] ?? { bg: "#f1f5f9", fg: "#475569" };
}
