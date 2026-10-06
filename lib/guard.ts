import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { OutboundBlockedError } from "./public-url";

const buckets = new Map<string, { count: number; reset: number }>();
const COOKIE = "csmon_token";

export function tokenRequired() {
  return Boolean(process.env.CSMON_TOKEN?.trim());
}

function expectedToken() {
  return process.env.CSMON_TOKEN?.trim() ?? "";
}

function tokensEqual(got: string, expected: string) {
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function tokenFromRequest(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth && /^bearer\s+/i.test(auth)) {
    const value = auth.replace(/^bearer\s+/i, "").trim();
    if (value) return value;
  }
  const header = request.headers.get("x-csmon-token")?.trim();
  if (header) return header;
  const cookie = request.headers.get("cookie");
  const match = cookie?.match(/(?:^|; )csmon_token=([^;]*)/);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return null;
}

export function isValidToken(got: string | null | undefined) {
  const expected = expectedToken();
  if (!expected) return true;
  if (!got) return false;
  return tokensEqual(got, expected);
}

export function cookieHeader(token: string, maxAge = 60 * 60 * 24 * 30) {
  const parts = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
  ];
  if (process.env.NODE_ENV === "production" && process.env.CSMON_SECURE_COOKIE === "1") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function clearCookieHeader() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export function denyIfUnauthorized(request: Request): NextResponse | null {
  if (!tokenRequired()) return null;
  if (isValidToken(tokenFromRequest(request))) return null;
  return NextResponse.json(
    { error: "Token required." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export function denyIfLimited(
  request: Request,
  bucket: string,
  max: number,
  windowMs = 60_000,
): NextResponse | null {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return null;
  }
  current.count += 1;
  if (current.count > max) {
    return NextResponse.json(
      { error: "Slow down and try again." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }
  return null;
}

export function gate(request: Request, bucket: string, max = 30): NextResponse | null {
  return denyIfUnauthorized(request) ?? denyIfLimited(request, bucket, max);
}

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(error: unknown, fallback: string, status = 400) {
  let message = fallback;
  if (error instanceof OutboundBlockedError) message = error.message;
  else if (error instanceof Error) {
    if (
      /reddit public rss/i.test(error.message) ||
      /^GDELT /.test(error.message) ||
      /GDELT did not respond/i.test(error.message)
    ) {
      message = error.message;
    }
    else if (/too large/i.test(error.message)) message = "Response too large.";
    else if (/token required/i.test(error.message)) message = error.message;
  }
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readJson<T>(request: Request, maxBytes = 32_768): Promise<T> {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) throw new Error("Body too large.");
  const text = await request.text();
  if (text.length > maxBytes) throw new Error("Body too large.");
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

export function asIdList(value: unknown, cap = 100): number[] {
  if (!Array.isArray(value)) return [];
  const ids: number[] = [];
  for (const item of value.slice(0, cap)) {
    const n = Number(item);
    if (Number.isInteger(n) && n > 0) ids.push(n);
  }
  return ids;
}

export function asIcao24(raw: string | null): string | null {
  const value = raw?.trim().toLowerCase() ?? "";
  if (!/^[0-9a-f]{6}$/.test(value)) return null;
  return value;
}

export function asCoords(latRaw: string | null, lngRaw: string | null) {
  if (latRaw == null || lngRaw == null || latRaw === "" || lngRaw === "") return null;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
