import { itemAsStory } from "@/lib/cluster";
import { buildDeepDive } from "@/lib/dive";
import { fail, gate, jsonOk } from "@/lib/guard";
import { parsePublicHttpUrl } from "@/lib/public-url";
import { readArticle } from "@/lib/read";
import type { Item } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = gate(request, "dive", 20);
  if (blocked) return blocked;
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return jsonOk({ error: "Missing url" }, 400);
  try {
    parsePublicHttpUrl(url);
    const article = await readArticle(url);
    const item: Item = {
      id: 0,
      sourceId: 0,
      externalId: url,
      title: article.title,
      summary: article.description,
      url,
      author: null,
      publishedAt: null,
      tags: [],
      topics: [],
      locations: [],
      fetchedAt: Date.now(),
    };
    return jsonOk({
      article,
      dive: buildDeepDive(itemAsStory(item), article),
    });
  } catch (error) {
    return fail(error, "Deep dive failed");
  }
}
