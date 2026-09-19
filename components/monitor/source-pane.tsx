"use client";

import { ExternalLink, Rss } from "lucide-react";
import { Ago } from "@/components/monitor/ago";
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import { shortSourceName } from "@/lib/source-label";
import type { Item, Source } from "@/lib/types";

export function SourcePane({
  source,
  items,
  rangedCount,
  onClose,
  onOpenItem,
  onScan,
}: {
  source: Source;
  items: Item[];
  rangedCount: number;
  onClose: () => void;
  onOpenItem: (item: Item) => void;
  onScan: () => void;
}) {
  return (
    <aside className="flex h-full min-h-[70vh] flex-col border-l border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Source
          </div>
          <div className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
            <span className="size-2 shrink-0 rounded-full" style={{ background: source.color }} />
            <span className="leading-snug">{shortSourceName(source.name)}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {source.platform} · {source.kind}
            {source.origins[0] ? ` · ${source.origins[0].reason}` : ""}
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-[11px] text-slate-500">
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {source.description ? (
          <p className="text-[12px] leading-relaxed text-slate-600">{source.description}</p>
        ) : null}
        <p className="mt-2 text-[12px] text-slate-500">
          {rangedCount} in this window · {items.length} total on the board
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <Tip text={source.url}>
            <Button size="xs" variant="outline" asChild>
              <a href={source.url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3" />
                Site
              </a>
            </Button>
          </Tip>
          {source.feedUrl ? (
            <Tip text={source.feedUrl}>
              <Button size="xs" variant="outline" asChild>
                <a href={source.feedUrl} target="_blank" rel="noreferrer">
                  <Rss className="size-3" />
                  RSS
                </a>
              </Button>
            </Tip>
          ) : null}
          <Tip text="Show this layer on Scan">
            <Button size="xs" onClick={onScan}>
              Scan layer
            </Button>
          </Tip>
        </div>
        <div className="mt-4 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
          Latest from this source
        </div>
        <div className="mt-1 space-y-1">
          {items.slice(0, 40).map((item) => (
            <Tip key={item.id} text="Read this item in place">
              <button
                type="button"
                onClick={() => onOpenItem(item)}
                className="block w-full rounded px-1 py-1.5 text-left hover:bg-slate-50"
              >
                <span className="block text-[12.5px] leading-snug font-medium text-slate-800">
                  {item.title}
                </span>
                <span className="text-[10px] text-slate-400">
                  {item.topics[0] ? `${item.topics[0]} · ` : ""}
                  <Ago ts={item.publishedAt ?? item.fetchedAt} />
                </span>
              </button>
            </Tip>
          ))}
          {items.length === 0 ? (
            <p className="text-[12px] text-slate-500">
              No items stored for this layer yet. Refresh the board or open the RSS.
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
