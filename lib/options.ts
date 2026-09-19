import type { Desk, TimeRange } from "./types";

export type UserOptions = {
  defaultDesk: Desk;
  defaultRange: TimeRange;
  compact: boolean;
  autoLoadSecurity: boolean;
  autoLoadKev: boolean;
  stack: string;
};

export const OPTIONS_KEY = "csmon.options";

export const DEFAULT_OPTIONS: UserOptions = {
  defaultDesk: "brief",
  defaultRange: "24h",
  compact: false,
  autoLoadSecurity: false,
  autoLoadKev: false,
  stack: "",
};

export function loadOptions(): UserOptions {
  if (typeof window === "undefined") return DEFAULT_OPTIONS;
  try {
    const raw = window.localStorage.getItem(OPTIONS_KEY);
    if (!raw) return DEFAULT_OPTIONS;
    const parsed = JSON.parse(raw) as Partial<UserOptions>;
    return { ...DEFAULT_OPTIONS, ...parsed };
  } catch {
    return DEFAULT_OPTIONS;
  }
}

export function saveOptions(options: UserOptions) {
  window.localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
  if (options.stack) window.localStorage.setItem("csmon.stack", options.stack);
}
