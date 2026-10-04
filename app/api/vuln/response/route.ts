import { createHash } from "node:crypto";
import type { Story } from "@/lib/cluster";
import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fail, gate, jsonOk } from "@/lib/guard";
import { fetchCweBriefs } from "@/lib/cwe-fetch";
import { buildInsights } from "@/lib/laya-insights";
import { buildLayaState } from "@/lib/laya-state";
import { rulesFallback } from "@/lib/laya-rules-fallback";
import type { ArticleBlock } from "@/lib/article-body";
import type { ArticleRead } from "@/lib/article";
import type { KevEntry } from "@/lib/kev";
import type { NvdCveBrief } from "@/lib/nvd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN_VERSION = 1;

type Body = {
  story: Story;
  article?: ArticleRead | null;
  articleBlocks?: ArticleBlock[];
  kevHits?: KevEntry[];
  nvdEntries?: NvdCveBrief[];
  stack?: string;
};

function cacheKey(body: Body) {
  const raw = JSON.stringify({
    id: body.story.id,
    url: body.story.url,
    stack: body.stack ?? "",
    cves: body.nvdEntries?.map((e) => e.cveId).join(","),
    kev: body.kevHits?.map((e) => e.cveId).join(","),
    v: PLAN_VERSION,
    cwe: 1,
  });
  return `vuln:${createHash("sha256").update(raw).digest("hex").slice(0, 24)}`;
}

export async function POST(request: Request) {
  const blocked = gate(request, "vuln", 40);
  if (blocked) return blocked;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonOk({ error: "Invalid JSON body" }, 400);
  }
  if (!body?.story?.id || !body.story.title) {
    return jsonOk({ error: "Missing story" }, 400);
  }

  const key = cacheKey(body);
  const cached = cacheGet(key);
  if (cached) {
    try {
      return jsonOk(JSON.parse(cached));
    } catch {
      /* refresh */
    }
  }

  try {
    const cweIds = (body.nvdEntries ?? []).flatMap((e) => e.cwes);
    const cweEntries = await fetchCweBriefs(cweIds, 4);
    const state = buildLayaState({
      story: body.story,
      article: body.article,
      articleBlocks: body.articleBlocks,
      kevHits: body.kevHits ?? [],
      nvdEntries: body.nvdEntries ?? [],
      cweEntries,
      stack: body.stack ?? "",
    });
    const excerptForIoc = [state.excerpt, ...(body.article?.paragraphs ?? [])].join("\n");
    const referenceUrls = [
      body.story.url,
      ...body.story.items.map((i) => i.url),
      ...(body.article?.related?.map((r) => r.href) ?? []),
    ].filter(Boolean);
    const answers = rulesFallback(state);
    const insights = buildInsights({
      state,
      answers,
      excerptForIoc,
      referenceUrls,
      nvdEntries: body.nvdEntries ?? [],
      kevHits: body.kevHits ?? [],
      stack: body.stack ?? "",
      cweEntries,
    });
    const payload = { insights, cweEntries };
    cacheSet(key, "json", JSON.stringify(payload), TTL.json);
    return jsonOk(payload);
  } catch (error) {
    return fail(error, "Vulnerability plan failed");
  }
}
