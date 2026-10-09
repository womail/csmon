import "server-only";

import { acledConfigured } from "../acled";
import { getDb } from "../db";
import { fetchOutbound, readLimited } from "../safe-url";
import { UA } from "../http";

export const ACLED_PROBE_KEY = "meta:acled:probe";
export const ACLED_LAST_ERROR_KEY = "meta:acled:last_error";

export type AcledProbeResult = {
  at: number;
  configured: boolean;
  usernameLooksLikeEmail: boolean;
  tokenHttp: number | null;
  tokenError: string | null;
  readHttp: number | null;
  readMessage: string | null;
  apiAccessDenied: boolean;
  hint: string;
};

export function acledDebugEnabled() {
  return process.env.CSMON_ACLED_DEBUG === "1" || process.env.CSMON_ACLED_DEBUG === "true";
}

export function acledDebugLog(message: string, extra?: Record<string, unknown>) {
  if (!acledDebugEnabled()) return;
  if (extra) console.info(`[acled] ${message}`, extra);
  else console.info(`[acled] ${message}`);
}

function metaGet(key: string) {
  const row = getDb().prepare("SELECT body FROM fetch_cache WHERE cache_key = ?").get(key) as
    | { body: string }
    | undefined;
  return row?.body ?? "";
}

function metaSet(key: string, body: string, ttlMs: number) {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO fetch_cache (cache_key, kind, body, fetched_at, expires_at)
       VALUES (?, 'live', ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at`,
    )
    .run(key, body, now, now + ttlMs);
}

export function loadAcledProbe(): AcledProbeResult | null {
  const raw = metaGet(ACLED_PROBE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AcledProbeResult;
  } catch {
    return null;
  }
}

export function storeAcledProbe(result: AcledProbeResult) {
  metaSet(ACLED_PROBE_KEY, JSON.stringify(result), 7 * 24 * 60 * 60 * 1000);
}

export function storeAcledLastError(message: string) {
  metaSet(ACLED_LAST_ERROR_KEY, message.slice(0, 2000), 7 * 24 * 60 * 60 * 1000);
}

export function loadAcledLastError(): string | null {
  const raw = metaGet(ACLED_LAST_ERROR_KEY);
  return raw || null;
}

export function parseAcledReadError(
  status: number,
  body: string,
): { message: string; apiAccessDenied: boolean; hint: string } {
  let apiMessage = "";
  try {
    const json = JSON.parse(body) as { message?: string; error?: string; error_description?: string };
    apiMessage = String(json.message ?? json.error ?? json.error_description ?? "").trim();
  } catch {
    apiMessage = body.trim().slice(0, 400);
  }
  const lower = apiMessage.toLowerCase();
  const apiAccessDenied =
    status === 403 &&
    (lower.includes("access denied") ||
      lower.includes("api") ||
      lower.includes("access group") ||
      lower.includes("required fields") ||
      apiMessage === "");
  const hint = apiAccessDenied
    ? "OAuth succeeded but ACLED denied data access. Email access@acleddata.com from your myACLED login address to request API access, complete your myACLED profile, and accept site consent in the browser."
    : status === 403
      ? "ACLED returned forbidden — check profile fields and API access on myACLED."
      : status === 401
        ? "ACLED rejected the bearer token — try Load again to refresh OAuth."
        : apiMessage || `ACLED read HTTP ${status}`;
  const message = apiMessage ? `ACLED read HTTP ${status}: ${apiMessage}` : `ACLED read HTTP ${status}`;
  return { message, apiAccessDenied, hint };
}

export async function runAcledProbe(options?: { bearerToken?: string }): Promise<AcledProbeResult> {
  const username = process.env.ACLED_USERNAME?.trim() ?? "";
  const base: AcledProbeResult = {
    at: Date.now(),
    configured: acledConfigured(),
    usernameLooksLikeEmail: username.includes("@"),
    tokenHttp: null,
    tokenError: null,
    readHttp: null,
    readMessage: null,
    apiAccessDenied: false,
    hint: "",
  };
  if (!base.configured) {
    base.hint = "Set ACLED_USERNAME (myACLED email) and ACLED_PASSWORD in .env.local, then restart the server.";
    storeAcledProbe(base);
    return base;
  }
  if (!base.usernameLooksLikeEmail) {
    base.hint = "ACLED_USERNAME should be your myACLED email address, not a display name.";
  }

  let bearer = options?.bearerToken?.trim() ?? process.env.ACLED_ACCESS_TOKEN?.trim() ?? "";
  if (!bearer) {
    const password = process.env.ACLED_PASSWORD?.trim() ?? "";
    const body = new URLSearchParams({
      username,
      password,
      grant_type: "password",
      client_id: "acled",
      scope: "authenticated",
    });
    acledDebugLog("probe: requesting OAuth token");
    const tokRes = await fetchOutbound("https://acleddata.com/oauth/token", {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
      timeoutMs: 25_000,
      maxBytes: 64_000,
    });
    base.tokenHttp = tokRes.status;
    const tokText = await readLimited(tokRes, 64_000).catch(() => "");
    if (!tokRes.ok) {
      base.tokenError = tokText.slice(0, 300) || `HTTP ${tokRes.status}`;
      base.hint = base.hint || "OAuth login failed — verify email/password match myACLED.";
      storeAcledProbe(base);
      return base;
    }
    try {
      bearer = (JSON.parse(tokText) as { access_token?: string }).access_token ?? "";
    } catch {
      base.tokenError = "Invalid token JSON";
      storeAcledProbe(base);
      return base;
    }
    if (!bearer) {
      base.tokenError = "Missing access_token";
      storeAcledProbe(base);
      return base;
    }
  }

  const readUrl = "https://acleddata.com/api/acled/read?limit=1";
  acledDebugLog("probe: read", { url: readUrl });
  const readRes = await fetchOutbound(readUrl, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Authorization: `Bearer ${bearer}`,
    },
    timeoutMs: 30_000,
    maxBytes: 256_000,
  });
  base.readHttp = readRes.status;
  const readBody = await readLimited(readRes, 256_000).catch(() => "");
  if (!readRes.ok) {
    const parsed = parseAcledReadError(readRes.status, readBody);
    base.readMessage = parsed.message;
    base.apiAccessDenied = parsed.apiAccessDenied;
    base.hint = parsed.hint;
    storeAcledLastError(parsed.message);
  } else {
    base.hint = "ACLED API access OK — event reads should work.";
    try {
      const json = JSON.parse(readBody) as { count?: number; data?: unknown[] };
      const n = Array.isArray(json.data) ? json.data.length : json.count;
      if (n != null) base.readMessage = `Probe OK (${n} event(s) in sample)`;
      else base.readMessage = "Probe OK";
    } catch {
      base.readMessage = "Probe OK";
    }
  }
  storeAcledProbe(base);
  return base;
}
