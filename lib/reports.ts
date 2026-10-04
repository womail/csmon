import type { Story } from "./cluster";
import { mineText } from "./mine";
import { isNoiseCopy, type ArticleRead } from "./article";
import type { Source } from "./types";
import {
  articleDisplayBlocks,
  paragraphsToBlocks,
  type ArticleBlock,
} from "./article-body";
import type { ReportVulnPlanSnapshot } from "./report-vuln-plan";

export type ReportStatus = "open" | "archived";

export type ReportItem = {
  title: string;
  summary: string | null;
  url: string;
  source: string;
  publishedAt: number | null;
  itemId?: number;
};

export type ReportLink = {
  title: string;
  url: string;
};

export type ReportStory = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  latestAt: number;
  topics: string[];
  locations: string[];
  sources: { name: string; color: string }[];
  items: ReportItem[];
  body: string[];
  /** Structured layout matching Read in place (headings, CVE blocks, reference links). */
  blocks?: ArticleBlock[];
  cves: string[];
  links: ReportLink[];
  extractAt?: number;
  /** KEV/NVD/CWE catalog plan from Read in place. */
  vulnPlan?: ReportVulnPlanSnapshot;
};

export type Report = {
  id: string;
  title: string;
  status: ReportStatus;
  createdAt: number;
  updatedAt: number;
  stories: ReportStory[];
};

export const REPORTS_KEY = "csmon.reports";
export const ACTIVE_REPORT_KEY = "csmon.report-active";
export const READER_WIDTH_KEY = "csmon.reader-width";

const MAX_REPORTS = 48;
const MAX_STORIES = 40;
export const READER_WIDTH_MIN = 380;
export const READER_WIDTH_DEFAULT = 560;
export const READER_WIDTH_MAX = 1200;

export function clampReaderWidth(width: number, viewport = 1280) {
  const cap = Math.min(READER_WIDTH_MAX, Math.max(READER_WIDTH_MIN, Math.floor(viewport * 0.72)));
  return Math.min(cap, Math.max(READER_WIDTH_MIN, Math.round(width)));
}

export function loadReaderWidth() {
  if (typeof window === "undefined") return READER_WIDTH_DEFAULT;
  const raw = Number(window.localStorage.getItem(READER_WIDTH_KEY));
  return Number.isFinite(raw) ? clampReaderWidth(raw, window.innerWidth) : READER_WIDTH_DEFAULT;
}

export function saveReaderWidth(width: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(READER_WIDTH_KEY, String(clampReaderWidth(width, window.innerWidth)));
}

function asStatus(value: unknown): ReportStatus {
  return value === "archived" ? "archived" : "open";
}

function compactText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function shouldKeepCopy(value: string, title: string) {
  if (value.length < 40) return false;
  if (isNoiseCopy(value)) return false;
  if (value.toLowerCase() === title.trim().toLowerCase()) return false;
  return true;
}

const URL_IN_TEXT = /https?:\/\/[^\s\]>'"<>]+/gi;
const MAX_REPORT_BLOCKS = 48;

function pickPrimaryArticle(articles: ArticleRead[]) {
  if (!articles.length) return null;
  return [...articles].sort((a, b) => b.paragraphs.length - a.paragraphs.length)[0] ?? null;
}

function isArticleBlock(value: unknown): value is ArticleBlock {
  if (!value || typeof value !== "object" || !("kind" in value)) return false;
  const kind = (value as { kind: unknown }).kind;
  return typeof kind === "string";
}

export function reportStoryDisplayBlocks(story: ReportStory): ArticleBlock[] {
  if (story.blocks?.length) return story.blocks;
  if (!story.body.length) return [];
  const related = (story.links ?? []).map((link) => ({ href: link.url, label: link.title || link.url }));
  return paragraphsToBlocks(story.body, { title: story.title, related }).slice(0, MAX_REPORT_BLOCKS);
}

export function collectReportCopy(input: {
  title: string;
  summaries?: (string | null | undefined)[];
  articles?: ArticleRead[];
}) {
  const title = input.title.trim();
  const blocks: string[] = [];
  const seen = new Set<string>();
  const links: ReportLink[] = [];
  const seenUrl = new Set<string>();
  function addLink(label: string, url: string) {
    const href = url.trim().replace(/[).,;]+$/, "");
    if (!href || seenUrl.has(href)) return;
    seenUrl.add(href);
    links.push({ title: compactText(label) || href, url: href });
  }
  function add(text: string | null | undefined) {
    const value = compactText(text);
    if (/^https?:\/\/\S+$/i.test(value)) {
      addLink(value, value);
      return;
    }
    if (!shouldKeepCopy(value, title)) return;
    const key = value.slice(0, 80).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    blocks.push(value);
    const matches = value.match(URL_IN_TEXT) ?? [];
    for (const href of matches) addLink(href, href);
  }
  for (const summary of input.summaries ?? []) add(summary);
  for (const article of input.articles ?? []) {
    add(article.description);
    for (const para of article.paragraphs) add(para);
    for (const quote of article.quotes) add(quote);
    for (const related of article.related) addLink(related.label, related.href);
  }

  const mined = mineText([title, ...blocks].join("\n"));
  const primary = pickPrimaryArticle(input.articles ?? []);
  let displayBlocks: ArticleBlock[] = [];
  if (primary?.paragraphs.length) {
    displayBlocks = articleDisplayBlocks(
      primary.title || title,
      primary.description,
      primary.paragraphs,
      primary.related,
    );
  } else if (blocks.length) {
    displayBlocks = paragraphsToBlocks(blocks.slice(0, 28), {
      title,
      related: links.map((link) => ({ href: link.url, label: link.title })),
    });
  }
  return {
    body: blocks.slice(0, 28),
    blocks: displayBlocks.slice(0, MAX_REPORT_BLOCKS),
    cves: mined.cves.slice(0, 12),
    links: links.slice(0, 16),
  };
}

export function snapshotStory(
  story: Story,
  sources: Map<number, Source>,
  articles: ArticleRead[] = [],
  extras?: { vulnPlan?: ReportVulnPlanSnapshot },
): ReportStory {
  const copy = collectReportCopy({
    title: story.title,
    summaries: [story.summary, ...story.items.map((item) => item.summary)],
    articles,
  });
  return {
    id: story.id,
    title: story.title.trim(),
    summary: story.summary,
    url: story.url,
    latestAt: story.latestAt,
    topics: story.topics.slice(0, 8),
    locations: story.locations.slice(0, 12),
    sources: story.sourceIds.map((id) => {
      const source = sources.get(id);
      return { name: source?.name ?? "source", color: source?.color ?? "#94a3b8" };
    }),
    items: story.items.slice(0, 8).map((item) => ({
      title: item.title,
      summary: item.summary,
      url: item.url,
      source: sources.get(item.sourceId)?.name ?? "source",
      publishedAt: item.publishedAt ?? item.fetchedAt,
      itemId: item.id,
    })),
    body: copy.body,
    blocks: copy.blocks,
    cves: copy.cves,
    links: copy.links,
    extractAt: Date.now(),
    vulnPlan: extras?.vulnPlan,
  };
}

function asStringList(value: unknown, max: number) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).slice(0, max);
}

function hydrateStory(row: Partial<ReportStory> | null | undefined): ReportStory | null {
  if (!row || typeof row.id !== "string" || typeof row.title !== "string") return null;
  const body = asStringList(row.body, 28).filter((para) => !isNoiseCopy(para));
  const blocks = Array.isArray(row.blocks)
    ? row.blocks.filter(isArticleBlock).slice(0, MAX_REPORT_BLOCKS)
    : undefined;
  const links = Array.isArray(row.links)
    ? row.links
        .filter((link): link is ReportLink => Boolean(link && typeof link.url === "string" && link.url.trim()))
        .slice(0, 16)
        .map((link) => ({ title: compactText(link.title) || link.url, url: link.url.trim() }))
    : [];
  const cves = asStringList(row.cves, 12);
  return {
    id: row.id,
    title: row.title,
    summary: typeof row.summary === "string" || row.summary === null ? row.summary : null,
    url: typeof row.url === "string" ? row.url : "",
    latestAt: typeof row.latestAt === "number" ? row.latestAt : 0,
    topics: asStringList(row.topics, 8),
    locations: asStringList(row.locations, 12),
    sources: Array.isArray(row.sources)
      ? row.sources.filter(
          (source): source is { name: string; color: string } =>
            Boolean(source && typeof source.name === "string" && typeof source.color === "string"),
        )
      : [],
    items: Array.isArray(row.items) ? (row.items as ReportItem[]) : [],
    body,
    blocks: blocks?.length ? blocks : undefined,
    cves:
      cves.length > 0
        ? cves
        : mineText([row.title, row.summary ?? "", ...body].join("\n")).cves.slice(0, 12),
    links,
    extractAt: typeof row.extractAt === "number" ? row.extractAt : undefined,
    vulnPlan:
      row.vulnPlan && typeof row.vulnPlan === "object" ? (row.vulnPlan as ReportVulnPlanSnapshot) : undefined,
  };
}

export function mergeReportStories(current: ReportStory, next: ReportStory): ReportStory {
  const currentBody = current.body ?? [];
  const nextBody = next.body ?? [];
  const currentLinks = current.links ?? [];
  const nextLinks = next.links ?? [];
  const currentBlocks = current.blocks ?? [];
  const nextBlocks = next.blocks ?? [];
  const body = nextBody.length >= currentBody.length ? nextBody : currentBody;
  const blocks = nextBlocks.length >= currentBlocks.length ? nextBlocks : currentBlocks;
  const links = nextLinks.length >= currentLinks.length ? nextLinks : currentLinks;
  return {
    ...current,
    ...next,
    title: next.title || current.title,
    summary: next.summary || current.summary,
    body,
    blocks: blocks.length ? blocks : undefined,
    links,
    cves: [...new Set([...(current.cves ?? []), ...(next.cves ?? [])])].slice(0, 12),
    vulnPlan: next.vulnPlan ?? current.vulnPlan,
    extractAt: next.extractAt ?? current.extractAt,
    items: next.items.length ? next.items : current.items,
    sources: next.sources.length ? next.sources : current.sources,
  };
}

export function applyArticlesToReportStory(story: ReportStory, articles: ArticleRead[]): ReportStory {
  const copy = collectReportCopy({
    title: story.title,
    summaries: [story.summary, ...story.items.map((item) => item.summary)],
    articles,
  });
  return mergeReportStories(story, {
    ...story,
    body: copy.body,
    blocks: copy.blocks,
    cves: copy.cves,
    links: copy.links,
    extractAt: Date.now(),
  });
}

export function storyNeedsExtract(story: ReportStory) {
  return !story.extractAt && (story.body?.length ?? 0) === 0 && Boolean(story.url);
}

function hydrate(raw: Partial<Report>): Report | null {
  if (!raw || typeof raw.id !== "string" || typeof raw.title !== "string") return null;
  const stories = Array.isArray(raw.stories)
    ? raw.stories.map(hydrateStory).filter((row): row is ReportStory => row != null).slice(0, MAX_STORIES)
    : [];
  return {
    id: raw.id,
    title: raw.title.trim().slice(0, 80) || "Untitled report",
    status: asStatus(raw.status),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    stories,
  };
}

export function loadReports(): Report[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<Report>[];
    return parsed.map(hydrate).filter((row): row is Report => row != null).slice(0, MAX_REPORTS);
  } catch {
    return [];
  }
}

function saveReportsLocal(rows: Report[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REPORTS_KEY, JSON.stringify(rows.slice(0, MAX_REPORTS)));
}

export function saveReports(rows: Report[]) {
  saveReportsLocal(rows);
  if (typeof window !== "undefined") {
    void persistServerReports(rows);
  }
}

export async function persistServerReports(rows: Report[]) {
  const { apiFetch } = await import("@/lib/api-client");
  const res = await apiFetch("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reports: rows.slice(0, MAX_REPORTS) }),
  });
  if (!res.ok) return rows;
  const data = (await res.json()) as { reports?: Report[] };
  const next = Array.isArray(data.reports) ? data.reports.map(hydrate).filter((row): row is Report => row != null) : rows;
  saveReportsLocal(next);
  return next;
}

export async function hydrateReports(): Promise<Report[]> {
  const local = loadReports();
  if (typeof window === "undefined") return local;
  try {
    const { apiFetch } = await import("@/lib/api-client");
    const res = await apiFetch("/api/reports");
    if (!res.ok) return local;
    const data = (await res.json()) as { reports?: Partial<Report>[] };
    const remote = Array.isArray(data.reports)
      ? data.reports.map(hydrate).filter((row): row is Report => row != null)
      : [];
    if (remote.length) {
      saveReportsLocal(remote);
      return remote;
    }
    if (local.length) return persistServerReports(local);
    return local;
  } catch {
    return local;
  }
}

export function loadActiveReportId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_REPORT_KEY);
}

export function saveActiveReportId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(ACTIVE_REPORT_KEY, id);
  else window.localStorage.removeItem(ACTIVE_REPORT_KEY);
}

export function openReports(rows: Report[]) {
  return rows.filter((row) => row.status === "open");
}

export function archivedReports(rows: Report[]) {
  return rows.filter((row) => row.status === "archived");
}

export function findReport(id: string | null | undefined, rows?: Report[]) {
  if (!id) return null;
  return (rows ?? loadReports()).find((row) => row.id === id) ?? null;
}

export function createReport(title: string, story: ReportStory, existing?: Report[]) {
  const name = title.trim().slice(0, 80) || "Untitled report";
  const now = Date.now();
  const next: Report = {
    id: `r-${now.toString(36)}`,
    title: name,
    status: "open",
    createdAt: now,
    updatedAt: now,
    stories: [story],
  };
  const rows = [next, ...(existing ?? loadReports())].slice(0, MAX_REPORTS);
  saveReports(rows);
  saveActiveReportId(next.id);
  return { rows, report: next };
}

export function addStoryToReport(id: string, story: ReportStory, existing?: Report[]) {
  const rows = (existing ?? loadReports()).map((row) => {
    if (row.id !== id) return row;
    const index = row.stories.findIndex((item) => item.id === story.id || item.url === story.url);
    if (index >= 0) {
      const stories = row.stories.slice();
      stories[index] = mergeReportStories(stories[index]!, story);
      return { ...row, stories, updatedAt: Date.now(), status: "open" as const };
    }
    return {
      ...row,
      updatedAt: Date.now(),
      status: "open" as const,
      stories: [...row.stories, story].slice(0, MAX_STORIES),
    };
  });
  saveReports(rows);
  saveActiveReportId(id);
  return rows;
}

export function replaceStoryInReport(id: string, story: ReportStory, existing?: Report[]) {
  const rows = (existing ?? loadReports()).map((row) => {
    if (row.id !== id) return row;
    return {
      ...row,
      updatedAt: Date.now(),
      stories: row.stories.map((item) =>
        item.id === story.id || item.url === story.url ? mergeReportStories(item, story) : item,
      ),
    };
  });
  saveReports(rows);
  return rows;
}

export function renameReport(id: string, title: string, existing?: Report[]) {
  const name = title.trim().slice(0, 80);
  if (!name) return existing ?? loadReports();
  const rows = (existing ?? loadReports()).map((row) =>
    row.id === id ? { ...row, title: name, updatedAt: Date.now() } : row,
  );
  saveReports(rows);
  return rows;
}

export function removeStoryFromReport(id: string, storyId: string, existing?: Report[]) {
  const rows = (existing ?? loadReports()).map((row) =>
    row.id === id
      ? { ...row, updatedAt: Date.now(), stories: row.stories.filter((item) => item.id !== storyId) }
      : row,
  );
  saveReports(rows);
  return rows;
}

export function moveStoryInReport(id: string, storyId: string, delta: number, existing?: Report[]) {
  const rows = (existing ?? loadReports()).map((row) => {
    if (row.id !== id) return row;
    const index = row.stories.findIndex((item) => item.id === storyId);
    if (index < 0) return row;
    const next = index + delta;
    if (next < 0 || next >= row.stories.length) return row;
    const stories = [...row.stories];
    const [item] = stories.splice(index, 1);
    stories.splice(next, 0, item);
    return { ...row, stories, updatedAt: Date.now() };
  });
  saveReports(rows);
  return rows;
}

export function setReportStatus(id: string, status: ReportStatus, existing?: Report[]) {
  const rows = (existing ?? loadReports()).map((row) =>
    row.id === id ? { ...row, status, updatedAt: Date.now() } : row,
  );
  saveReports(rows);
  if (status === "archived" && loadActiveReportId() === id) saveActiveReportId(null);
  return rows;
}

export function deleteReport(id: string, existing?: Report[]) {
  const rows = (existing ?? loadReports()).filter((row) => row.id !== id);
  saveReports(rows);
  if (loadActiveReportId() === id) saveActiveReportId(null);
  return rows;
}

export function reportPlaces(report: Report) {
  const counts = new Map<string, number>();
  for (const story of report.stories) {
    for (const place of story.locations) counts.set(place, (counts.get(place) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, hint: `${count} in this report` }));
}
