export type TrailEntry = { at: number; query: string; summary: string; count: number; unit?: "stories" | "items" };

export const TRAIL_KEY = "csmon.trail";
const MAX = 40;

type TrailState = { entries: TrailEntry[]; cursor: number };

function storage(): Storage | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage;
}

function load(): TrailState {
  try {
    const raw = storage()?.getItem(TRAIL_KEY);
    if (!raw) return { entries: [], cursor: -1 };
    const parsed = JSON.parse(raw) as Partial<TrailState>;
    const entries = Array.isArray(parsed.entries) ? parsed.entries.slice(-MAX) : [];
    const cursor = typeof parsed.cursor === "number" ? Math.min(parsed.cursor, entries.length - 1) : entries.length - 1;
    return { entries, cursor };
  } catch {
    return { entries: [], cursor: -1 };
  }
}

function save(state: TrailState) {
  storage()?.setItem(TRAIL_KEY, JSON.stringify(state));
}

/**
 * Record a view. Consecutive equal queries collapse into one entry.
 * Pushing after stepping back drops the forward entries, like browser history.
 */
export function pushTrail(entry: TrailEntry): void {
  const state = load();
  const current = state.entries[state.cursor];
  if (current && current.query === entry.query) {
    state.entries[state.cursor] = { ...current, count: entry.count, summary: entry.summary };
    save(state);
    return;
  }
  const entries = [...state.entries.slice(0, state.cursor + 1), entry].slice(-MAX);
  save({ entries, cursor: entries.length - 1 });
}

export function trailBack(): TrailEntry | null {
  const state = load();
  if (state.cursor <= 0) return null;
  state.cursor -= 1;
  save(state);
  return state.entries[state.cursor] ?? null;
}

export function trailForward(): TrailEntry | null {
  const state = load();
  if (state.cursor >= state.entries.length - 1) return null;
  state.cursor += 1;
  save(state);
  return state.entries[state.cursor] ?? null;
}

/** Jump to one entry without dropping the rest. */
export function trailGo(index: number): TrailEntry | null {
  const state = load();
  if (index < 0 || index >= state.entries.length) return null;
  state.cursor = index;
  save(state);
  return state.entries[index];
}

export function listTrail(): TrailEntry[] {
  return load().entries;
}

export function trailPosition(): { cursor: number; length: number } {
  const state = load();
  return { cursor: state.cursor, length: state.entries.length };
}

/** "Brief · war · Ukraine · 63 stories · 4 min ago" */
export function trailLine(entry: TrailEntry, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - entry.at) / 60_000));
  const ago = minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
  const unit = entry.unit ?? "stories";
  return `${entry.summary} · ${entry.count} ${entry.count === 1 ? unit.slice(0, -1).replace(/ie$/, "y") : unit} · ${ago}`;
}

/** Method note for a report: one timestamped line per step. */
export function trailMethodNote(entries: TrailEntry[]) {
  return entries
    .map((entry, index) => `${index + 1}. ${new Date(entry.at).toISOString().slice(11, 16)} UTC — ${entry.summary} (${entry.count})`)
    .join("\n");
}
