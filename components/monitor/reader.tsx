"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Rss, X } from "lucide-react";
import { Ago } from "@/components/monitor/ago";
import { Button } from "@/components/ui/button";
import { tagStyle } from "@/lib/colors";
import type { Story } from "@/lib/cluster";
import type { ArticleRead } from "@/lib/read";
import type { Source } from "@/lib/types";

export function ReaderPane({
  story,
  sources,
  onClose,
  onFollow,
}: {
  story: Story;
  sources: Map<number, Source>;
  onClose: () => void;
  onFollow: (url: string) => void;
}) {
  const [activeId, setActiveId] = useState(story.items[0].id);
  const [article, setArticle] = useState<ArticleRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [frame, setFrame] = useState(false);
  const active = story.items.find((item) => item.id === activeId) ?? story.items[0];

  useEffect(() => {
    setActiveId(story.items[0].id);
  }, [story.id, story.items]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setArticle(null);
    setFrame(false);
    fetch(`/api/read?url=${encodeURIComponent(active.url)}`)
      .then(async (res) => {
        const data = (await res.json()) as ArticleRead & { error?: string };
        if (!res.ok) throw new Error(data.error || "Read failed");
        if (!cancelled) setArticle(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Read failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active.url]);

  return (
    <aside className="flex h-full min-h-[70vh] flex-col border-l border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Read in place
          </div>
          <div className="line-clamp-2 text-[13px] font-semibold text-slate-900">
            {story.title}
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-50">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1 px-3 pt-2">
        {story.topics.map((topic) => {
          const style = tagStyle(topic);
          return (
            <span key={topic} className="tag" style={{ background: style.bg, color: style.fg }}>
              {topic}
            </span>
          );
        })}
        {story.locations.map((place) => (
          <span key={place} className="tag" style={{ background: "#ecfeff", color: "#0e7490" }}>
            {place}
          </span>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading ? <p className="text-[12px] text-slate-400">Pulling the piece…</p> : null}
        {error ? (
          <p className="text-[12px] text-slate-500">
            Could not extract text ({error}). Use page view or original.
          </p>
        ) : null}
        {article?.description ? (
          <p className="text-[12.5px] leading-relaxed text-slate-700">{article.description}</p>
        ) : null}
        {article?.paragraphs.map((p) => (
          <p key={p.slice(0, 48)} className="mt-2 text-[12.5px] leading-relaxed text-slate-600">
            {p}
          </p>
        ))}
        {frame ? (
          <iframe
            title="source"
            src={active.url}
            className="mt-3 h-[420px] w-full rounded-md border border-slate-200"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        ) : null}
      </div>

      <div className="border-t border-slate-100 px-3 py-2">
        <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
          {story.items.length} sources · stay on the board
        </div>
        <div className="mt-1 max-h-32 space-y-1 overflow-y-auto">
          {story.items.map((item) => {
            const source = sources.get(item.sourceId);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveId(item.id)}
                className={`flex w-full items-center gap-2 rounded px-1 py-1 text-left text-[11px] ${
                  item.id === active.id ? "bg-slate-100" : "hover:bg-slate-50"
                }`}
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: source?.color ?? "#94a3b8" }}
                />
                <span className="min-w-0 flex-1 truncate">{source?.name ?? "source"}</span>
                <Ago ts={item.publishedAt ?? item.fetchedAt} className="text-slate-400" />
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <Button size="xs" variant="outline" onClick={() => setFrame((v) => !v)}>
            {frame ? "Hide page" : "View page"}
          </Button>
          <Button size="xs" variant="outline" asChild>
            <a href={active.url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3" />
              Original
            </a>
          </Button>
          {article?.site ? (
            <Button size="xs" onClick={() => onFollow(`https://${article.site}`)}>
              <Rss className="size-3" />
              Follow {article.site}
            </Button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
