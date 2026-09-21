import * as cheerio from "cheerio";
import { isNoiseCopy, type ArticleRead } from "./article";
import { fetchText } from "./http";

export type { ArticleRead } from "./article";

function keepParagraph(text: string, minLength = 40) {
  const value = text.replace(/\s+/g, " ").trim();
  if (value.length < minLength) return false;
  if (isNoiseCopy(value)) return false;
  return true;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function absUrl(href: string, base: string) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

export async function readArticle(url: string): Promise<ArticleRead> {
  const html = await fetchText(url, 9000);
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, svg, nav, footer, header, form").remove();

  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    hostOf(url);
  const description =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[name="twitter:description"]').attr("content")?.trim() ||
    null;

  const paraSel =
    "article p, article li, [itemprop='articleBody'] p, [itemprop='articleBody'] li, main p, main li, .article-body p, .article-body li, .story-body p, [data-testid='postText'] p, .post-content p";
  let paragraphs = $(paraSel)
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((p) => keepParagraph(p, 32));
  if (paragraphs.length < 4) {
    paragraphs = [
      ...paragraphs,
      ...$("p, li, blockquote")
        .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
        .get()
        .filter((p) => keepParagraph(p, 50)),
    ];
  }
  const seen = new Set<string>();
  paragraphs = paragraphs.filter((p) => {
    const key = p.slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 28);

  const quotes = $("blockquote, q")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((quote) => keepParagraph(quote, 40))
    .filter((quote, i, all) => all.findIndex((other) => other.slice(0, 48) === quote.slice(0, 48)) === i)
    .slice(0, 8);

  const language =
    $("html").attr("lang")?.trim() ||
    $('meta[property="og:locale"]').attr("content")?.trim() ||
    $('meta[http-equiv="content-language"]').attr("content")?.trim() ||
    null;

  const related = $("article a[href], main a[href], .related a[href], aside a[href]")
    .map((_, el) => {
      const href = absUrl($(el).attr("href") || "", url);
      const label = $(el).text().replace(/\s+/g, " ").trim();
      return { href, label };
    })
    .get()
    .filter(
      (l) =>
        /^https?:/i.test(l.href) &&
        (l.label.length > 16 || /\/sk\/|cve-|advisory|hotfix|security.?update/i.test(l.href)),
    )
    .filter((l, i, all) => all.findIndex((x) => x.href === l.href) === i)
    .slice(0, 12);

  return {
    url,
    site: hostOf(url),
    title,
    description,
    paragraphs,
    quotes,
    language,
    related,
  };
}
