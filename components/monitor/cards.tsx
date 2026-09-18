"use client";

import { Ago } from "@/components/monitor/ago";
import { tagStyle } from "@/lib/colors";
import type { Item, Source } from "@/lib/types";

export function ItemCard({
  item,
  source,
  onTag,
}: {
  item: Item;
  source?: Source;
  onTag: (tag: string) => void;
}) {
  return (
    <article className="card-tile">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-0.5">
          {item.tags.map((tag) => {
            const style = tagStyle(tag);
            return (
              <button
                key={tag}
                type="button"
                className="tag"
                style={{ background: style.bg, color: style.fg }}
                onClick={() => onTag(tag)}
              >
                {tag}
              </button>
            );
          })}
        </div>
        <Ago
          ts={item.publishedAt ?? item.fetchedAt}
          className="shrink-0 text-[10px] text-slate-400"
        />
      </div>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="mt-1.5 block no-underline"
      >
        <p className="line-clamp-4 text-[12.5px] leading-[1.35] font-medium text-slate-800">
          {item.title}
        </p>
        {item.summary ? (
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-500">
            {item.summary}
          </p>
        ) : null}
      </a>
      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-500">
        <span
          className="inline-block size-1.5 rounded-full"
          style={{ background: source?.color ?? "#94a3b8" }}
        />
        <span className="truncate">
          {source?.name ?? "source"}
          {item.author && item.author !== source?.name ? ` · ${item.author}` : ""}
        </span>
      </div>
    </article>
  );
}

export function HealthCard({
  value,
  fresh,
  total,
}: {
  value: number;
  fresh: number;
  total: number;
}) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const label = value >= 70 ? "Healthy" : value >= 40 ? "Stale" : "Quiet";
  return (
    <div className="card-tile">
      <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
        Layer health
      </div>
      <div className="mt-1 flex items-center gap-3">
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={value >= 70 ? "#f97316" : value >= 40 ? "#eab308" : "#94a3b8"}
            strokeWidth="8"
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 44 44)"
          />
          <text
            x="44"
            y="48"
            textAnchor="middle"
            className="fill-slate-800"
            style={{ fontSize: 20, fontWeight: 600 }}
          >
            {value}
          </text>
        </svg>
        <div>
          <div className="text-sm font-semibold text-slate-800">{label}</div>
          <div className="text-[11px] text-slate-500">
            {fresh}/{total} layers fetched in 6h
          </div>
        </div>
      </div>
    </div>
  );
}

export function RankedCard({
  title,
  rows,
  onSelect,
}: {
  title: string;
  rows: { id: string; label: string; value: number; color: string }[];
  onSelect: (id: string) => void;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="card-tile">
      <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
        {title}
      </div>
      <div className="mt-2 space-y-1.5">
        {rows.slice(0, 6).map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelect(row.id)}
            className="block w-full text-left"
          >
            <div className="mb-0.5 flex justify-between text-[11px]">
              <span className="truncate text-slate-700">{row.label}</span>
              <span className="text-slate-400">{row.value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(8, (row.value / max) * 100)}%`,
                  background: row.color,
                }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
