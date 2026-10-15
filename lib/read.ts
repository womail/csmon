import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { cleanArticleParagraphs } from "./article-body";
import { isNoiseCopy, type ArticleRead } from "./article";
import { filterArticlePageLinks } from "./page-links";
import { fetchText } from "./http";
import { cveIdsFromNvdLinks, cveIdsFromText } from "./nvd";
import { publishDateFromHtml } from "./publish-date";
import { extractWithReadability } from "./readability-extract";

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

function metaTitle($: CheerioAPI, url: string) {
  return (
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    hostOf(url)
  );
}

function metaDescription($: CheerioAPI) {
  return (
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[name="twitter:description"]').attr("content")?.trim() ||
    null
  );
}

function cheerioParagraphs($: CheerioAPI, title: string, description: string | null) {
  $("script, style, noscript, iframe, svg, nav, footer, header, form").remove();
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
  return cleanArticleParagraphs(title, description, paragraphs);
}

function cheerioQuotes($: CheerioAPI) {
  return $("blockquote, q")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((quote) => keepParagraph(quote, 40))
    .filter((quote, i, all) => all.findIndex((other) => other.slice(0, 48) === quote.slice(0, 48)) === i)
    .slice(0, 8);
}

function cheerioLanguage($: CheerioAPI) {
  return (
    $("html").attr("lang")?.trim() ||
    $('meta[property="og:locale"]').attr("content")?.trim() ||
    $('meta[http-equiv="content-language"]').attr("content")?.trim() ||
    null
  );
}

function cheerioRelated($: CheerioAPI, url: string) {
  const relatedRaw = $("article a[href], main a[href], .article-body a[href], [itemprop='articleBody'] a[href]")
    .map((_, el) => {
      const href = absUrl($(el).attr("href") || "", url);
      const label = $(el).text().replace(/\s+/g, " ").trim();
      return { href, label };
    })
    .get()
    .filter(
      (l) =>
        /^https?:/i.test(l.href) &&
        (l.label.length > 12 ||
          /\/sk\/|cve-|advisory|hotfix|security.?update|external\/article|CTX\d/i.test(l.href)),
    );
  return filterArticlePageLinks(relatedRaw, url);
}

function readabilityWins(readability: ReturnType<typeof extractWithReadability>, cheerioCount: number) {
  if (!readability?.paragraphs.length) return false;
  const readChars = readability.paragraphs.join(" ").length;
  if (readability.paragraphs.length >= 2 && readChars >= 280) return true;
  if (cheerioCount < 2 && readChars >= 180) return true;
  return false;
}

export async function readArticle(url: string): Promise<ArticleRead> {
  const html = await fetchText(url, 9000);
  const $links = cheerio.load(html);
  const $body = cheerio.load(html);

  const ogTitle = metaTitle($links, url);
  const ogDescription = metaDescription($links);
  const readability = extractWithReadability(html, url);
  const cheerioBody = cheerioParagraphs($body, ogTitle, ogDescription);

  let extractEngine: ArticleRead["extractEngine"] = "cheerio";
  let title = ogTitle;
  let description = ogDescription;
  let paragraphs = cheerioBody;

  if (readability && readabilityWins(readability, cheerioBody.length)) {
    extractEngine = "readability";
    if (readability.title.length > 8) title = readability.title;
    description = readability.excerpt ?? ogDescription;
    paragraphs = cleanArticleParagraphs(title, description, readability.paragraphs);
  }

  const $meta = cheerio.load(html);
  const quotes = cheerioQuotes($meta);
  const language = readability?.language ?? cheerioLanguage($meta);
  const related = cheerioRelated($meta, url);
  const publishedAt = publishDateFromHtml($meta);

  const cveIds = [
    ...cveIdsFromText(title, description, ...paragraphs),
    ...cveIdsFromNvdLinks(related),
  ].filter((id, i, all) => all.indexOf(id) === i);

  return {
    url,
    site: hostOf(url),
    title,
    description,
    publishedAt,
    paragraphs,
    quotes,
    language,
    related,
    cveIds,
    extractEngine,
  };
}
