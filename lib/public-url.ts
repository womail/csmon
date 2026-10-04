import { isIP } from "node:net";

const ALLOWED_PORTS = new Set([80, 443]);
const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google",
  "kubernetes",
  "kubernetes.default",
  "kubernetes.default.svc",
  "host.docker.internal",
  "gateway.docker.internal",
  "0.0.0.0",
  "255.255.255.255",
]);

export class OutboundBlockedError extends Error {
  constructor(message = "That address is not allowed.") {
    super(message);
    this.name = "OutboundBlockedError";
  }
}

function fail(message = "That address is not allowed."): never {
  throw new OutboundBlockedError(message);
}

function ipv4Tuple(ip: string): [number, number, number, number] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums as [number, number, number, number];
}

function isPrivateIPv4(ip: string): boolean {
  const t = ipv4Tuple(ip);
  if (!t) return true;
  const [a, b] = t;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  // 192.0.0.0/24 (IETF special) — not all of 192.0.0.0/16 (WordPress VIP and others use 192.0.66.x).
  if (a === 192 && b === 0 && t[2] === 0) return true;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return true;
  if (a === 203 && b === 113) return true;
  if (a >= 224) return true;
  return false;
}

function stripIpv6(ip: string) {
  return ip.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
}

function isPrivateIPv6(ip: string): boolean {
  const v = stripIpv6(ip);
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fe80:") || v.startsWith("ff")) return true;
  if (v.startsWith("fc") || v.startsWith("fd")) return true;
  if (v.startsWith("::ffff:")) {
    const mapped = v.slice("::ffff:".length);
    if (mapped.includes(".")) return isPrivateIPv4(mapped);
  }
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true;
}

function hostLooksLocal(host: string): boolean {
  const name = host.replace(/\.$/, "").toLowerCase();
  if (BLOCKED_HOSTS.has(name)) return true;
  if (name.endsWith(".localhost") || name.endsWith(".local") || name.endsWith(".internal")) return true;
  if (name.endsWith(".lan") || name.endsWith(".home") || name.endsWith(".corp")) return true;
  if (name.endsWith(".localdomain")) return true;
  return false;
}

export function parsePublicHttpUrl(raw: string): URL {
  if (!raw || raw.length > 2048) fail("URL is too long.");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    fail("Could not parse that URL.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    fail("Only http and https URLs are allowed.");
  }
  if (parsed.username || parsed.password) fail("URLs with credentials are not allowed.");
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) fail("That port is not allowed.");
  const host = parsed.hostname.replace(/^\[/, "").replace(/\]$/, "");
  if (!host || hostLooksLocal(host)) fail();
  const kind = isIP(host);
  if (kind && isBlockedIp(host)) fail();
  return parsed;
}
