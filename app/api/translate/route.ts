import { NextResponse } from "next/server";
import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { normalizeLang } from "@/lib/lang";

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
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "csmon/0.1" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Translate failed ${res.status}`);
  const data = (await res.json()) as MemoryResponse;
  const translated = data.responseData?.translatedText?.trim();
  if (!translated || (data.responseStatus && data.responseStatus >= 400)) {
    throw new Error("Translate returned no text");
  }
  cacheSet(key, "translate", translated, TTL.translate);
  return translated;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      texts?: string[];
      from?: string;
      to?: string;
    };
    const to = normalizeLang(body.to);
    const from = normalizeLang(body.from) || "en";
    const texts = (body.texts ?? []).map((text) => String(text ?? "")).filter(Boolean).slice(0, 12);
    if (!to) return NextResponse.json({ error: "Missing target language" }, { status: 400 });
    if (from === to) return NextResponse.json({ texts, from, to });
    const translated: string[] = [];
    for (const text of texts) {
      const parts = [];
      for (const piece of chunks(text)) {
        parts.push(await translateChunk(piece, from, to));
      }
      translated.push(parts.join(" "));
    }
    return NextResponse.json({ texts: translated, from, to });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translate failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
