import { NextResponse } from "next/server";
import { itemAsStory } from "@/lib/cluster";
import { buildDeepDive } from "@/lib/dive";
import { readArticle } from "@/lib/read";
import type { Item } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });
  try {
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
    return NextResponse.json({
      article,
      dive: buildDeepDive(itemAsStory(item), article),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Deep dive failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
