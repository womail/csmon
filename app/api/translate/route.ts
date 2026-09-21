import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fail, gate, jsonOk, readJson } from "@/lib/guard";
import { normalizeLang } from "@/lib/lang";
import { fetchOutbound, readLimited } from "@/lib/safe-url";
import { UA } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MemoryResponse = {
  responseStatus?: number;
  responseData?: { translatedText?: string };
};

function chunks(text: string, max = 450) {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length) {
    if (rest.length <= max) {
      parts.push(rest);
      break;
    }
    let cut = rest.lastIndexOf(". ", max);
    if (cut < 80) cut = rest.lastIndexOf(" ", max);
    if (cut < 40) cut = max;
    parts.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  return parts.filter(Boolean);
}

async function translateChunk(text: string, from: string, to: string) {
  const key = `translate:${from}:${to}:${text}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
  const res = await fetchOutbound(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    timeoutMs: 12000,
    maxBytes: 200_000,
  });
  if (!res.ok) throw new Error("Translate failed");
  const data = JSON.parse(await readLimited(res, 200_000)) as MemoryResponse;
  const translated = data.responseData?.translatedText?.trim();
  if (!translated || (data.responseStatus && data.responseStatus >= 400)) {
    throw new Error("Translate returned no text");
  }
  cacheSet(key, "translate", translated, TTL.translate);
  return translated;
}

export async function POST(request: Request) {
  const blocked = gate(request, "translate", 10);
  if (blocked) return blocked;
  try {
    const body = await readJson<{ texts?: string[]; from?: string; to?: string }>(request, 64_000);
    const to = normalizeLang(body.to);
    const from = normalizeLang(body.from) || "en";
    const texts = (body.texts ?? [])
      .map((text) => String(text ?? "").slice(0, 4000))
      .filter(Boolean)
      .slice(0, 12);
    if (!to) return jsonOk({ error: "Missing target language" }, 400);
    if (from === to) return jsonOk({ texts, from, to });
    const translated: string[] = [];
    for (const text of texts) {
      const parts = [];
      for (const piece of chunks(text)) {
        parts.push(await translateChunk(piece, from, to));
      }
      translated.push(parts.join(" "));
    }
    return jsonOk({ texts: translated, from, to });
  } catch (error) {
    return fail(error, "Translate failed");
  }
}
