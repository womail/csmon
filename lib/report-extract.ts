import { apiFetch } from "./api-client";
import type { Story } from "./cluster";
import type { ArticleRead } from "./article";
import type { ReportStory } from "./reports";

export async function fetchArticleReads(urls: string[]): Promise<ArticleRead[]> {
  const unique = [...new Set(urls.map((url) => url.trim()).filter(Boolean))].slice(0, 3);
  const articles = await Promise.all(
    unique.map(async (url) => {
      try {
        const res = await apiFetch(`/api/read?url=${encodeURIComponent(url)}`);
        const data = (await res.json()) as ArticleRead & { error?: string };
        if (!res.ok || data.error) return null;
        if (!Array.isArray(data.paragraphs)) return null;
        return data;
      } catch {
        return null;
      }
    }),
  );
  return articles.filter((row): row is ArticleRead => row != null);
}

export function extractUrlsForStory(story: Story, preferred?: string | null) {
  const urls = [preferred, story.url, ...story.items.map((item) => item.url)].filter(
    (url): url is string => Boolean(url),
  );
  return [...new Set(urls)].slice(0, 3);
}

export function extractUrlsForReportStory(story: ReportStory) {
  const urls = [story.url, ...story.items.map((item) => item.url)].filter(Boolean);
  return [...new Set(urls)].slice(0, 3);
}
