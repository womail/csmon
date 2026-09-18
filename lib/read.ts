import * as cheerio from "cheerio";
import { fetchText } from "./http";

export type ArticleRead = {
  url: string;
  site: string;
  title: string;
  description: string | null;
  paragraphs: string[];
  related: { href: string; label: string }[];
};

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function readArticle(url: string): Promise<ArticleRead> {
  const html = await fetchText(url, 9000);
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, svg, nav, footer, header, form, aside").remove();

  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    hostOf(url);
  const description =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    null;

  const paraSel = "article p, [itemprop='articleBody'] p, main p, .article-body p, .story-body p";
  let paragraphs = $(paraSel)
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((p) => p.length > 60);
  if (paragraphs.length < 3) {
    paragraphs = $("p")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter((p) => p.length > 80)
      .slice(0, 10);
  }
  paragraphs = paragraphs.slice(0, 10);

  const related = $("article a[href], main a[href]")
    .map((_, el) => {
      const href = $(el).attr("href") || "";
      const label = $(el).text().replace(/\s+/g, " ").trim();
      return { href, label };
    })
    .get()
    .filter((l) => l.label.length > 18 && l.href.startsWith("http"))
    .slice(0, 8);

  return {
    url,
    site: hostOf(url),
    title,
    description,
    paragraphs,
    related,
  };
}
