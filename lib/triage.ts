export type TriageState = {
  hidden: string[];
  read: string[];
};

export type TriageUndo = {
  kind: "hide" | "read";
  ids: string[];
};

const KEY = "csmon.triage";
const UNDO_KEY = "csmon.triage-undo";

function empty(): TriageState {
  return { hidden: [], read: [] };
}

export function loadTriage(): TriageState {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<TriageState>;
    return {
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden.slice(0, 2000) : [],
      read: Array.isArray(parsed.read) ? parsed.read.slice(0, 2000) : [],
    };
  } catch {
    return empty();
  }
}

export function loadTriageUndo(): TriageUndo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(UNDO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TriageUndo[];
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function save(state: TriageState, undo: TriageUndo[]) {
  window.localStorage.setItem(KEY, JSON.stringify(state));
  window.localStorage.setItem(UNDO_KEY, JSON.stringify(undo.slice(0, 20)));
}

function unique(ids: string[]) {
  return [...new Set(ids.filter(Boolean))];
}

export function hideKeys(state: TriageState, undo: TriageUndo[], ids: string[]): {
  state: TriageState;
  undo: TriageUndo[];
} {
  const nextIds = unique(ids);
  return {
    state: { ...state, hidden: unique([...state.hidden, ...nextIds]) },
    undo: [...undo, { kind: "hide", ids: nextIds }],
  };
}

export function readKeys(state: TriageState, undo: TriageUndo[], ids: string[]): {
  state: TriageState;
  undo: TriageUndo[];
} {
  const nextIds = unique(ids);
  return {
    state: { ...state, read: unique([...state.read, ...nextIds]) },
    undo: [...undo, { kind: "read", ids: nextIds }],
  };
}

export function undoTriage(state: TriageState, undo: TriageUndo[]): {
  state: TriageState;
  undo: TriageUndo[];
} {
  const last = undo.at(-1);
  if (!last) return { state, undo };
  const drop = new Set(last.ids);
  const next =
    last.kind === "hide"
      ? { ...state, hidden: state.hidden.filter((id) => !drop.has(id)) }
      : { ...state, read: state.read.filter((id) => !drop.has(id)) };
  return { state: next, undo: undo.slice(0, -1) };
}

export function persistTriage(state: TriageState, undo: TriageUndo[]) {
  save(state, undo);
}

export function storyKeys(storyId: string, itemIds: number[]) {
  return [`story:${storyId}`, ...itemIds.map((id) => `item:${id}`)];
}

export function itemKey(id: number) {
  return `item:${id}`;
}

export function kevKey(cveId: string) {
  return `kev:${cveId}`;
}
