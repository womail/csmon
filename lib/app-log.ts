/** Opt-in diagnostic log. Off unless Options → Data → Logging is turned on. */
import "server-only";

import { getDb } from "./db";

export type AppLogLevel = "info" | "warn" | "error";

export type AppLogRow = {
  id: number;
  at: number;
  level: AppLogLevel;
  scope: string;
  message: string;
  detail: unknown;
};

const SETTING_KEY = "logging";
const MAX_ROWS = 2000;

const globalForLog = globalThis as unknown as { csmonLoggingEnabled?: boolean };

function readEnabled(): boolean {
  const row = getDb()
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(SETTING_KEY) as { value: string } | undefined;
  return row?.value === "on";
}

export function isLoggingEnabled() {
  if (globalForLog.csmonLoggingEnabled === undefined) {
    try {
      globalForLog.csmonLoggingEnabled = readEnabled();
    } catch {
      globalForLog.csmonLoggingEnabled = false;
    }
  }
  return globalForLog.csmonLoggingEnabled === true;
}

export function setLoggingEnabled(enabled: boolean) {
  const db = getDb();
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(SETTING_KEY, enabled ? "on" : "off");
  globalForLog.csmonLoggingEnabled = enabled;
}

function encodeDetail(detail: unknown) {
  if (detail == null) return null;
  try {
    return JSON.stringify(detail);
  } catch {
    return JSON.stringify({ note: "detail not serializable" });
  }
}

function decodeDetail(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function trimLogs(db: ReturnType<typeof getDb>) {
  const row = db.prepare("SELECT COUNT(*) AS n FROM app_logs").get() as { n: number };
  const extra = Number(row.n) - MAX_ROWS;
  if (extra <= 0) return;
  db.prepare(
    `DELETE FROM app_logs WHERE id IN (
      SELECT id FROM app_logs ORDER BY at ASC, id ASC LIMIT ?
    )`,
  ).run(extra);
}

/** Write a row when logging is on. Never throws into the caller. */
export function appLog(
  level: AppLogLevel,
  scope: string,
  message: string,
  detail?: unknown,
) {
  if (!isLoggingEnabled()) return;
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO app_logs (at, level, scope, message, detail) VALUES (?, ?, ?, ?, ?)`,
    ).run(Date.now(), level, scope.slice(0, 40), message.slice(0, 500), encodeDetail(detail));
    trimLogs(db);
  } catch (error) {
    console.error("[app-log] write failed", error);
  }
}

export function listAppLogs(limit = 200): { enabled: boolean; count: number; logs: AppLogRow[] } {
  const db = getDb();
  const enabled = isLoggingEnabled();
  const count = Number(
    (db.prepare("SELECT COUNT(*) AS n FROM app_logs").get() as { n: number }).n,
  );
  const rows = db
    .prepare(
      `SELECT id, at, level, scope, message, detail FROM app_logs
       ORDER BY at DESC, id DESC LIMIT ?`,
    )
    .all(Math.max(1, Math.min(500, Math.round(limit) || 200))) as {
    id: number;
    at: number;
    level: string;
    scope: string;
    message: string;
    detail: string | null;
  }[];
  return {
    enabled,
    count,
    logs: rows.map((row) => ({
      id: row.id,
      at: row.at,
      level: row.level === "warn" || row.level === "error" ? row.level : "info",
      scope: row.scope,
      message: row.message,
      detail: decodeDetail(row.detail),
    })),
  };
}

export function deleteAppLogs(ids?: number[]): { deleted: number } {
  const db = getDb();
  if (!ids?.length) {
    const row = db.prepare("SELECT COUNT(*) AS n FROM app_logs").get() as { n: number };
    db.prepare("DELETE FROM app_logs").run();
    return { deleted: Number(row.n) };
  }
  const valid = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (!valid.length) return { deleted: 0 };
  const placeholders = valid.map(() => "?").join(",");
  const result = db.prepare(`DELETE FROM app_logs WHERE id IN (${placeholders})`).run(...valid);
  return { deleted: Number(result.changes ?? 0) };
}
