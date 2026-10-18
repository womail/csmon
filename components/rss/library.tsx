"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * RSS reader pane. This folder does not import the monitor, the database, or
 * desks. A later app can copy `components/rss` and pass the same two lists.
 */
export type RssFeedRow = {
  id: number;
  name: string;
  category: string;
  url: string;
};

export type RssArticleRow = {
  id: number;
  feedId: number;
  title: string;
  summary: string;
  url: string;
  publishedAt: number | null;
};

function plainText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function when(publishedAt: number | null) {
  if (!publishedAt) return "";
  const date = new Date(publishedAt);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${hours}:${minutes} UTC`;
}

function categoryWithTitles(
  categories: [string, RssFeedRow[]][],
  articles: RssArticleRow[],
) {
  const hit = categories.find(([, rows]) =>
    articles.some((article) => rows.some((feed) => feed.id === article.feedId)),
  );
  return hit?.[0] ?? categories[0]?.[0] ?? null;
}

export function RssLibrary({
  feeds,
  articles,
}: {
  feeds: RssFeedRow[];
  articles: RssArticleRow[];
}) {
  const categories = useMemo(() => {
    const map = new Map<string, RssFeedRow[]>();
    for (const feed of feeds) {
      const list = map.get(feed.category) ?? [];
      list.push(feed);
      map.set(feed.category, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [feeds]);

  const [category, setCategory] = useState<string | null>(() =>
    categoryWithTitles(categories, articles),
  );
  const [feedId, setFeedId] = useState<number | null>(null);
  const [articleId, setArticleId] = useState<number | null>(null);

  useEffect(() => {
    if (category && categories.some(([name]) => name === category)) return;
    setCategory(categoryWithTitles(categories, articles));
    setFeedId(null);
    setArticleId(null);
  }, [articles, categories, category]);

  const visibleFeeds = categories.find(([name]) => name === category)?.[1] ?? [];
  const activeFeeds = feedId == null ? visibleFeeds : visibleFeeds.filter((feed) => feed.id === feedId);
  const feedIds = new Set(activeFeeds.map((feed) => feed.id));
  const titles = articles
    .filter((article) => feedIds.has(article.feedId))
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  const article = titles.find((row) => row.id === articleId) ?? titles[0] ?? null;
  const articleFeed = article ? feeds.find((feed) => feed.id === article.feedId) : null;
  const body = article ? plainText(article.summary) : "";

  if (feeds.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-[14px] font-medium text-slate-800">No RSS feeds are on</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-slate-500">
          Turn a layer on from Unused sources or Sources. This desk only reads feeds already
          subscribed in csmon.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-[28rem] overflow-x-auto bg-white">
      <section className="w-52 shrink-0 overflow-y-auto border-r border-slate-200">
        <div className="px-3 pt-3 pb-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
          Categories
        </div>
        {categories.map(([name, rows]) => {
          const open = name === category;
          return (
            <div key={name}>
              <button
                type="button"
                className={`flex w-full items-baseline justify-between px-3 py-1.5 text-left text-[12px] ${
                  open ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => {
                  setCategory(name);
                  setFeedId(null);
                  setArticleId(null);
                }}
              >
                <span className="truncate">{name}</span>
                <span className="text-[10px] text-slate-400">{rows.length}</span>
              </button>
              {open
                ? rows.map((feed) => (
                    <button
                      key={feed.id}
                      type="button"
                      className={`block w-full truncate py-1 pr-3 pl-6 text-left text-[12px] ${
                        feedId === feed.id
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                      onClick={() => {
                        setFeedId(feed.id);
                        setArticleId(null);
                      }}
                    >
                      {feed.name}
                    </button>
                  ))
                : null}
            </div>
          );
        })}
      </section>
      <section className="w-72 shrink-0 overflow-y-auto border-r border-slate-200">
        <div className="px-3 pt-3 pb-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
          Titles
        </div>
        {titles.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-slate-500">Nothing in this window for that feed.</p>
        ) : (
          titles.map((row) => {
            const active = article?.id === row.id;
            return (
              <button
                key={row.id}
                type="button"
                className={`block w-full px-3 py-2 text-left ${active ? "bg-slate-100" : "hover:bg-slate-50"}`}
                onClick={() => setArticleId(row.id)}
              >
                <span className="block text-[13px] leading-snug font-medium text-slate-800">{row.title}</span>
                <span className="mt-0.5 block text-[10px] text-slate-400">{when(row.publishedAt)}</span>
              </button>
            );
          })
        )}
      </section>
      <article className="min-w-[16rem] flex-1 overflow-y-auto px-6 py-5">
        {article ? (
          <>
            <p className="text-[11px] text-slate-500">
              {articleFeed?.name ?? "Feed"}
              {article.publishedAt ? ` · ${when(article.publishedAt)}` : ""}
            </p>
            <h1 className="mt-2 text-[22px] leading-snug font-semibold text-slate-900">{article.title}</h1>
            {body ? (
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-700">{body}</p>
            ) : (
              <p className="mt-4 text-[13px] text-slate-500">This feed item has no summary. Open the original page.</p>
            )}
            <a
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-block text-[13px] font-medium text-slate-900 underline"
            >
              Open original
            </a>
          </>
        ) : (
          <p className="text-[13px] text-slate-500">Pick a title.</p>
        )}
      </article>
    </div>
  );
}
