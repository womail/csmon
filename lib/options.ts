import {
  clampBoardItemLimit,
  DEFAULT_BOARD_ITEM_LIMIT,
} from "./board-limit";
import { detectBrowserLanguage, normalizeLang } from "./lang";
import { applyPalette, resolvePalette, type Palette } from "./theme";
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
  palette: Palette;
  /** Default max item age when a layer has no per-source retention (days). null = keep until manual purge. */
  defaultRetentionDays: number | null;
  /** Max items loaded from enabled sources onto the board (SQLite LIMIT). */
  boardItemLimit: number;
  /** Optional HTTPS manifest URL (must match server allow suffix when set). */
  updateManifestUrl: string;
  /** Reserved for post–Reddit-RSS OAuth (not wired yet). */
  redditOAuthClientId: string;
  redditOAuthClientSecret: string;
  /** 0 = off. When set (e.g. 30), refresh enabled RSS layers while the tab is visible (skips GDELT/Reddit/ACLED). */
  autoRefreshMinutes: number;
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
  palette: "light",
  defaultRetentionDays: 30,
  boardItemLimit: DEFAULT_BOARD_ITEM_LIMIT,
  updateManifestUrl: "",
  redditOAuthClientId: "",
  redditOAuthClientSecret: "",
  autoRefreshMinutes: 0,
};

export function loadOptions(): UserOptions {
  if (typeof window === "undefined") return DEFAULT_OPTIONS;
  try {
    const raw = window.localStorage.getItem(OPTIONS_KEY);
    if (!raw) {
      return {
        ...DEFAULT_OPTIONS,
        homeLanguage: detectBrowserLanguage(),
        palette: resolvePalette(null),
      };
    }
    const parsed = JSON.parse(raw) as Partial<UserOptions>;
    const merged = { ...DEFAULT_OPTIONS, ...parsed };
    if (!parsed.homeLanguage) merged.homeLanguage = detectBrowserLanguage();
    else merged.homeLanguage = normalizeLang(parsed.homeLanguage) || "en";
    merged.palette = resolvePalette(parsed.palette);
    merged.boardItemLimit = clampBoardItemLimit(
      parsed.boardItemLimit ?? DEFAULT_BOARD_ITEM_LIMIT,
    );
    merged.updateManifestUrl =
      typeof parsed.updateManifestUrl === "string" ? parsed.updateManifestUrl.trim() : "";
    merged.redditOAuthClientId =
      typeof parsed.redditOAuthClientId === "string" ? parsed.redditOAuthClientId.trim() : "";
    merged.redditOAuthClientSecret =
      typeof parsed.redditOAuthClientSecret === "string" ? parsed.redditOAuthClientSecret.trim() : "";
    merged.autoRefreshMinutes = Math.max(
      0,
      Math.min(120, Math.round(Number(parsed.autoRefreshMinutes) || 0)),
    );
    return merged;
  } catch {
    return DEFAULT_OPTIONS;
  }
}

export function saveOptions(options: UserOptions) {
  window.localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
  if (options.stack) window.localStorage.setItem("csmon.stack", options.stack);
  applyPalette(options.palette);
}
