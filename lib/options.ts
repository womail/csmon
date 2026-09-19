import { detectBrowserLanguage, normalizeLang } from "./lang";
import type { Desk, TimeRange } from "./types";

export type UserOptions = {
  defaultDesk: Desk;
  defaultRange: TimeRange;
  compact: boolean;
  autoLoadSecurity: boolean;
  autoLoadKev: boolean;
  autoLoadHazards: boolean;
  stack: string;
  homeLanguage: string;
  autoTranslate: boolean;
  homePlace: string;
};

export const OPTIONS_KEY = "csmon.options";

export const DEFAULT_OPTIONS: UserOptions = {
  defaultDesk: "home",
  defaultRange: "24h",
  compact: false,
  autoLoadSecurity: false,
  autoLoadKev: false,
  autoLoadHazards: false,
  stack: "",
  homeLanguage: "en",
  autoTranslate: false,
  homePlace: "Dublin",
};

export function loadOptions(): UserOptions {
  if (typeof window === "undefined") return DEFAULT_OPTIONS;
  try {
    const raw = window.localStorage.getItem(OPTIONS_KEY);
    if (!raw) return { ...DEFAULT_OPTIONS, homeLanguage: detectBrowserLanguage() };
    const parsed = JSON.parse(raw) as Partial<UserOptions>;
    const merged = { ...DEFAULT_OPTIONS, ...parsed };
    if (!parsed.homeLanguage) merged.homeLanguage = detectBrowserLanguage();
    else merged.homeLanguage = normalizeLang(parsed.homeLanguage) || "en";
    return merged;
  } catch {
    return DEFAULT_OPTIONS;
  }
}

export function saveOptions(options: UserOptions) {
  window.localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
  if (options.stack) window.localStorage.setItem("csmon.stack", options.stack);
}
