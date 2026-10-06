import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent } from "undici";
import {
  isBlockedIp,
  OutboundBlockedError,
  parsePublicHttpUrl,
} from "./public-url";

export { OutboundBlockedError, parsePublicHttpUrl, isBlockedIp };

function fail(message = "That address is not allowed."): never {
  throw new OutboundBlockedError(message);
}

export async function assertOutboundUrl(raw: string): Promise<URL> {
  const parsed = parsePublicHttpUrl(raw);
  const host = parsed.hostname.replace(/^\[/, "").replace(/\]$/, "");
  if (isIP(host)) {
    if (isBlockedIp(host)) fail();
    return parsed;
  }
  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    fail("Could not resolve that host.");
  }
  if (!records.length) fail("Could not resolve that host.");
  for (const record of records) {
    if (isBlockedIp(record.address)) fail();
  }
  return parsed;
}

const outboundAgents = new Map<number, Agent>();

function outboundAgent(connectTimeoutMs: number) {
  let agent = outboundAgents.get(connectTimeoutMs);
  if (!agent) {
    agent = new Agent({
      connectTimeout: connectTimeoutMs,
      headersTimeout: connectTimeoutMs * 2,
      bodyTimeout: connectTimeoutMs * 2,
    });
    outboundAgents.set(connectTimeoutMs, agent);
  }
  return agent;
}

export async function fetchOutbound(
  raw: string,
  init: RequestInit & { timeoutMs?: number; maxBytes?: number; connectTimeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 12000, maxBytes = 2_000_000, connectTimeoutMs, ...rest } = init;
  const dispatcher = connectTimeoutMs ? outboundAgent(connectTimeoutMs) : undefined;
  let current = await assertOutboundUrl(raw);
  let redirect = 0;
  while (redirect <= 5) {
    const signal = rest.signal ?? AbortSignal.timeout(timeoutMs);
    const res = await fetch(current, {
      ...rest,
      redirect: "manual",
      signal,
      ...(dispatcher ? { dispatcher } : {}),
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirect missing location");
      current = await assertOutboundUrl(new URL(location, current).toString());
      redirect += 1;
      continue;
    }
    const length = Number(res.headers.get("content-length") || 0);
    if (length > maxBytes) throw new Error("Response too large");
    return res;
  }
  throw new OutboundBlockedError("Too many redirects.");
}

export async function readLimited(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    if (text.length > maxBytes) throw new Error("Response too large");
    return text;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("Response too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
