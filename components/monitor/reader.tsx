"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ExternalLink, Rss, X } from "lucide-react";
import { Ago } from "@/components/monitor/ago";
import { Button } from "@/components/ui/button";
import { tagStyle } from "@/lib/colors";
import type { Story } from "@/lib/cluster";
import type { KevEntry } from "@/lib/kev";
import { matchItemByUrl, matchSourceByHost, storySignals } from "@/lib/link";
import type { ArticleRead } from "@/lib/read";
import type { Item, Source } from "@/lib/types";

export function ReaderPane({
  story,
  sources,
  related = [],
  kevHits = [],
  boardItems = [],
  canBack,
  onBack,
  onClose,
  onFollow,
  onTopic,
  onPlace,
  onVendor,
  onCve,
  onSource,
  onOpenStory,
  onOpenItem,
}: {
  story: Story;
  sources: Map<number, Source>;
  related: { story: Story; why: string }[];
  kevHits: KevEntry[];
  boardItems: Item[];
  canBack: boolean;
  onBack: () => void;
  onClose: () => void;
  onFollow: (url: string) => void;
  onTopic: (topic: string) => void;
  onPlace: (place: string) => void;
  onVendor: (vendor: string) => void;
  onCve: (cve: string) => void;
  onSource: (sourceId: number) => void;
  onOpenStory: (story: Story) => void;
  onOpenItem: (item: Item) => void;
}) {
  const [activeId, setActiveId] = useState(story.items[0].id);
  const [article, setArticle] = useState<ArticleRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [frame, setFrame] = useState(false);
  const active = story.items.find((item) => item.id === activeId) ?? story.items[0];
  const activeSource = sources.get(active.sourceId);
  const signals = storySignals(story);

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

  const dossier = useMemo(() => {
    const blocks: string[] = [];
    const seen = new Set<string>();
    function add(text: string | null | undefined) {
      const value = (text ?? "").replace(/\s+/g, " ").trim();
      if (value.length < 40) return;
      const key = value.slice(0, 72).toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      blocks.push(value);
    }
    for (const item of story.items) add(item.summary);
    add(active.title);
    add(article?.description ?? null);
    for (const para of article?.paragraphs ?? []) add(para);
    return { blocks, seen };
  }, [active.title, article, story.items]);

  const pageLinks = (article?.related ?? []).map((link) => ({
    ...link,
    item: matchItemByUrl(link.href, boardItems),
    source: matchSourceByHost(link.href, [...sources.values()]),
  }));

  return (
    <aside className="flex h-full min-h-[70vh] flex-col border-l border-slate-200 bg-white">
      <div className="flex items-start gap-1 border-b border-slate-100 px-3 py-2">
        {canBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mt-0.5 rounded p-1 text-slate-400 hover:bg-slate-50"
            aria-label="Previous story"
          >
            <ChevronLeft className="size-4" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Read in place
            {story.sourceIds.length > 1
              ? ` · ${story.sourceIds.length} desks corroborate`
              : " · single desk"}
          </div>
          <div className="text-[14px] leading-snug font-semibold text-slate-900">{story.title}</div>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-50">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-50 px-3 py-2">
        {story.topics.map((topic) => {
          const style = tagStyle(topic);
          return (
            <button
              key={topic}
              type="button"
              className="tag"
              style={{ background: style.bg, color: style.fg }}
              onClick={() => onTopic(topic)}
            >
              {topic}
            </button>
          );
        })}
        {story.locations.map((place) => (
          <button
            key={place}
            type="button"
            className="tag"
            style={{ background: "#ecfeff", color: "#0e7490" }}
            onClick={() => onPlace(place)}
          >
            {place}
          </button>
        ))}
        {signals.vendors.map((name) => (
          <button
            key={name}
            type="button"
            className="tag"
            style={{ background: "#fee2e2", color: "#9f1239" }}
            onClick={() => onVendor(name)}
          >
            {name}
          </button>
        ))}
        {signals.cves.map((cve) => (
          <button
            key={cve}
            type="button"
            className="tag font-mono"
            style={{ background: "#f1f5f9", color: "#0f172a" }}
            onClick={() => onCve(cve)}
          >
            {cve}
          </button>
        ))}
        {signals.ransomware ? (
          <span className="tag" style={{ background: "#fee2e2", color: "#9f1239" }}>
            ransomware
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
          Coverage
        </div>
        <div className="mt-1.5 space-y-2">
          {story.items.map((item) => {
            const source = sources.get(item.sourceId);
            const selected = item.id === active.id;
            return (
              <div
                key={item.id || item.externalId}
                className={`rounded-md border px-2 py-1.5 ${
                  selected ? "border-slate-800 bg-slate-50" : "border-slate-100 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: source?.color ?? "#94a3b8" }}
                  />
                  <button
                    type="button"
                    className="truncate font-medium text-slate-700 hover:underline"
                    onClick={() => {
                      if (source) onSource(source.id);
                    }}
                  >
                    {source?.name ?? "source"}
                  </button>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-0.5 hover:text-slate-800"
                  >
                    <ExternalLink className="size-3" />
                    Original
                  </a>
                  {source?.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 hover:text-slate-800 hover:underline"
                    >
                      Home
                    </a>
                  ) : null}
                  {source?.feedUrl ? (
                    <a
                      href={source.feedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-0.5 hover:text-slate-800"
                    >
                      <Rss className="size-3" />
                      RSS
                    </a>
                  ) : null}
                  <Ago ts={item.publishedAt ?? item.fetchedAt} className="ml-auto" />
                </div>
                <button
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className="mt-0.5 block w-full text-left"
                >
                  <p className="text-[12.5px] leading-snug font-medium text-slate-800">
                    {item.title}
                  </p>
                  {item.summary ? (
                    <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">{item.summary}</p>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
          Full copy
        </div>
        {loading ? <p className="mt-1 text-[12px] text-slate-400">Pulling the piece…</p> : null}
        {error ? (
          <p className="mt-1 text-[12px] text-slate-500">
            Page extract failed ({error}). Board copy above is the source of truth.
          </p>
        ) : null}
        {article?.title && article.title !== story.title ? (
          <p className="mt-2 text-[12.5px] font-medium text-slate-800">{article.title}</p>
        ) : null}
        {dossier.blocks.map((block) => (
          <p key={block.slice(0, 64)} className="mt-2 text-[12.5px] leading-relaxed text-slate-700">
            {block}
          </p>
        ))}
        {dossier.blocks.length === 0 && !loading ? (
          <p className="mt-2 text-[12px] text-slate-500">No extra copy on this item.</p>
        ) : null}

        {kevHits.length > 0 ? (
          <div className="mt-4">
            <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
              KEV on this story
            </div>
            {kevHits.map((entry) => (
              <button
                key={entry.cveId}
                type="button"
                onClick={() => onCve(entry.cveId)}
                className="mt-1 block w-full rounded-md border border-rose-100 bg-rose-50 px-2 py-1.5 text-left"
              >
                <span className="font-mono text-[11px] text-rose-800">{entry.cveId}</span>
                <span className="block text-[12px] text-slate-800">
                  {entry.vendor} {entry.product}
                </span>
                <span className="block text-[11px] text-slate-500">{entry.name}</span>
              </button>
            ))}
          </div>
        ) : null}

        {related.length > 0 ? (
          <div className="mt-4">
            <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
              Also on the board
            </div>
            <div className="mt-1 space-y-1">
              {related.map((row) => (
                <button
                  key={row.story.id}
                  type="button"
                  onClick={() => onOpenStory(row.story)}
                  className="block w-full rounded px-1 py-1 text-left hover:bg-slate-50"
                >
                  <span className="text-[10px] text-slate-400">{row.why}</span>
                  <span className="block text-[12px] leading-snug text-slate-800">
                    {row.story.title}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {row.story.sourceIds.length} sources
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {pageLinks.length > 0 ? (
          <div className="mt-4">
            <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
              From the page
            </div>
            <div className="mt-1 space-y-1">
              {pageLinks.map((link) => (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => {
                    if (link.item) onOpenItem(link.item);
                    else onFollow(link.href);
                  }}
                  className="block w-full truncate rounded px-1 py-1 text-left text-[12px] text-slate-700 hover:bg-slate-50"
                >
                  {link.label}
                  <span className="block truncate text-[10px] text-slate-400">
                    {link.item
                      ? "already on the board"
                      : link.source
                        ? `via ${link.source.name}`
                        : link.href.replace(/^https?:\/\//, "")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

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
        <div className="flex flex-wrap gap-1">
          <Button size="xs" variant="outline" onClick={() => setFrame((v) => !v)}>
            {frame ? "Hide page" : "View page"}
          </Button>
          <Button size="xs" variant="outline" asChild>
            <a href={active.url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3" />
              Original
            </a>
          </Button>
          {activeSource?.url ? (
            <Button size="xs" variant="outline" asChild>
              <a href={activeSource.url} target="_blank" rel="noreferrer">
                Home
              </a>
            </Button>
          ) : null}
          {activeSource?.feedUrl ? (
            <Button size="xs" variant="outline" asChild>
              <a href={activeSource.feedUrl} target="_blank" rel="noreferrer">
                <Rss className="size-3" />
                RSS
              </a>
            </Button>
          ) : null}
          {activeSource ? (
            <Button size="xs" variant="outline" onClick={() => onSource(activeSource.id)}>
              This source
            </Button>
          ) : null}
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
