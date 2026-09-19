"use client";

import { MapPin } from "lucide-react";
import { Ago } from "@/components/monitor/ago";
import { SourceChip } from "@/components/monitor/cards";
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import { tagStyle } from "@/lib/colors";
import { placeAliases } from "@/lib/places";
import type { Item, Source } from "@/lib/types";

export function PlacePane({
  place,
  items,
  rangedCount,
  sources,
  onClose,
  onOpenItem,
  onScan,
  onTopic,
  onSource,
}: {
  place: string;
  items: Item[];
  rangedCount: number;
  sources: Map<number, Source>;
  onClose: () => void;
  onOpenItem: (item: Item) => void;
  onScan: () => void;
  onTopic: (topic: string) => void;
  onSource: (id: number) => void;
}) {
  const aliases = placeAliases(place);
  const topics = new Map<string, number>();
  const sourceCounts = new Map<number, number>();
  for (const item of items) {
    for (const topic of item.topics) topics.set(topic, (topics.get(topic) ?? 0) + 1);
    sourceCounts.set(item.sourceId, (sourceCounts.get(item.sourceId) ?? 0) + 1);
  }
  const topicRows = [...topics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const sourceRows = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id, count]) => ({ source: sources.get(id), count }))
    .filter((row) => row.source);

  return (
    <aside className="flex h-full min-h-[70vh] flex-col border-l border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Place
          </div>
          <div className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
            <MapPin className="size-4 text-cyan-700" />
            <span className="truncate">{place}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Intelligence mentioning {place}
            {aliases.length > 1 ? ` · also ${aliases.filter((alias) => alias !== place).slice(0, 3).join(", ")}` : ""}
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-[11px] text-slate-500">
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <p className="text-[12px] text-slate-500">
          {rangedCount} in this window · {items.length} total on the board
        </p>
        <div className="mt-2">
          <Tip text={`Scan the board filtered to ${place}`}>
            <Button size="xs" onClick={onScan}>
              Scan this place
            </Button>
          </Tip>
        </div>
        {topicRows.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {topicRows.map(([topic, count]) => {
              const style = tagStyle(topic);
              return (
                <Tip key={topic} text={`Filter this place to ${topic}`}>
                  <button
                    type="button"
                    className="tag"
                    style={{ background: style.bg, color: style.fg }}
                    onClick={() => onTopic(topic)}
                  >
                    {topic} {count}
                  </button>
                </Tip>
              );
            })}
          </div>
        ) : null}
        {sourceRows.length > 0 ? (
          <div className="mt-3">
            <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
              Sources reporting here
            </div>
            <div className="mt-1 flex flex-wrap content-start gap-1">
              {sourceRows.map(({ source, count }) =>
                source ? (
                  <SourceChip
                    key={source.id}
                    name={source.name}
                    color={source.color}
                    count={count}
                    filled
                    onClick={() => onSource(source.id)}
                  />
                ) : null,
              )}
            </div>
          </div>
        ) : null}
        <div className="mt-4 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
          Latest from {place}
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
                  {sources.get(item.sourceId)?.name ?? "source"}
                  {item.topics[0] ? ` · ${item.topics[0]}` : ""} ·{" "}
                  <Ago ts={item.publishedAt ?? item.fetchedAt} />
                </span>
              </button>
            </Tip>
          ))}
          {items.length === 0 ? (
            <p className="text-[12px] text-slate-500">
              No stored items mention this place yet. Widen the time range or load more world RSS.
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
