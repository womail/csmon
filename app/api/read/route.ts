import { saveExtractForUrl } from "@/lib/evidence";
import { fail, gate, jsonOk } from "@/lib/guard";
import { parsePublicHttpUrl } from "@/lib/public-url";
import { readArticle } from "@/lib/read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = gate(request, "read", 20);
  if (blocked) return blocked;
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return jsonOk({ error: "Missing url" }, 400);
  try {
    parsePublicHttpUrl(url);
    const article = await readArticle(url);
    saveExtractForUrl(url, article);
    return jsonOk(article);
  } catch (error) {
    return fail(error, "Could not read article");
  }
}
