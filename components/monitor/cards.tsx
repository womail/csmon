"use client";

import { Ago } from "@/components/monitor/ago";
import { Tip } from "@/components/monitor/tip";
import { tagStyle } from "@/lib/colors";
import type { Story } from "@/lib/cluster";
import { personName } from "@/lib/people";
import { mineItem } from "@/lib/mine";
import { shortSourceName } from "@/lib/source-label";
import type { Item, OriginReason, Source } from "@/lib/types";

export function SourceChip({
  name,
  color,
  extra,
  count,
  filled,
  active,
  onClick,
}: {
  name: string;
  color: string;
  extra?: string;
  count?: number;
  filled?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const label = shortSourceName(name);
  return (
    <Tip text={`Scan only ${name}${extra ? ` · ${extra}` : ""}`} className="max-w-full min-w-0">
      <button
        type="button"
        className={
          filled
            ? `source-chip source-chip-fill${active ? " source-chip-active" : ""}`
            : "source-chip"
        }
        onClick={(event) => {
          event.stopPropagation();
          onClick?.();
        }}
      >
        <span className="source-chip-dot" style={{ background: color }} />
        <span className="source-chip-label">
          {label}
          {count != null ? ` ${count}` : ""}
          {extra ? ` · ${extra}` : ""}
        </span>
      </button>
    </Tip>
  );
}

const ORIGIN_LABEL: Record<OriginReason, string> = {
  self: "Seed layer",
  follow: "Followed",
  mention: "Mentioned",
  link: "Linked from coverage",
  intel: "Security intel",
  explore: "Auto-explored",
  reddit: "Reddit",
};

const KIND_LABEL: Record<Source["kind"], string> = {
  account: "Account",
  feed: "Feed",
  site: "Site",
};

function originCopy(source: Source) {
  const origin = source.origins[0];
  if (!origin) return { label: KIND_LABEL[source.kind], via: null as string | null };
  return {
    label: ORIGIN_LABEL[origin.reason],
    via: origin.seedHandle || null,
  };
}

function CardActions({
  read,
  onHide,
  onRead,
}: {
  read?: boolean;
  onHide?: () => void;
  onRead?: () => void;
}) {
  if (!onHide && !onRead) return null;
  return (
    <div className="mt-2 flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
      {onHide ? (
        <Tip text="Hide this card from the board">
          <button type="button" className="text-[10px] text-slate-500 hover:text-slate-800" onClick={onHide}>
            Hide
          </button>
        </Tip>
      ) : null}
      {onRead ? (
        <Tip text={read ? "Already marked read" : "Mark as read without opening"}>
          <button
            type="button"
            className="text-[10px] text-slate-500 hover:text-slate-800"
            onClick={onRead}
            disabled={read}
          >
            {read ? "Read ✓" : "Read"}
          </button>
        </Tip>
      ) : null}
    </div>
  );
}

export function StoryCard({
  story,
  sources,
  onOpen,
  onTopic,
  onPlace,
  onVendor,
  onSource,
  onHide,
  onRead,
  read,
  focused,
}: {
  story: Story;
  sources: Map<number, Source>;
  onOpen: () => void;
  onTopic: (topic: string) => void;
  onPlace: (place: string) => void;
  onVendor?: (vendor: string) => void;
  onSource?: (sourceId: number) => void;
  onHide?: () => void;
  onRead?: () => void;
  read?: boolean;
  focused?: boolean;
}) {
  const shownIds = story.sourceIds.slice(0, 3);
  const extra = story.sourceIds.length - shownIds.length;
  const vendors = [...new Set(story.items.flatMap((item) => mineItem(item).vendors))].slice(0, 4);

  return (
    <article className={`card-tile cursor-pointer ${read ? "opacity-55" : ""} ${focused ? "card-tile-focus" : ""}`} onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1">
          {story.topics.slice(0, 3).map((topic) => {
            const style = tagStyle(topic);
            return (
              <Tip key={topic} text={`Filter to topic ${topic}`}>
              <button
                type="button"
                className="tag"
                style={{ background: style.bg, color: style.fg }}
                onClick={(event) => {
                  event.stopPropagation();
                  onTopic(topic);
                }}
              >
                {topic}
              </button>
              </Tip>
            );
          })}
          {story.locations.slice(0, 2).map((place) => (
            <Tip key={place} text={`Filter to ${place}`}>
            <button
              type="button"
              className="tag"
              style={{ background: "#ecfeff", color: "#0e7490" }}
              onClick={(event) => {
                event.stopPropagation();
                onPlace(place);
              }}
            >
              {place}
            </button>
            </Tip>
          ))}
          {vendors.map((vendor) => (
            <Tip key={vendor} text={`Filter to vendor ${vendor}`}>
              <button
                type="button"
                className="tag"
                style={{ background: "#fee2e2", color: "#9f1239" }}
                onClick={(event) => {
                  event.stopPropagation();
                  onVendor?.(vendor);
                }}
              >
                {vendor}
              </button>
            </Tip>
          ))}
        </div>
        <Ago ts={story.latestAt} className="shrink-0 text-[10px] text-slate-400" />
      </div>
      <p className="mt-2 line-clamp-4 text-[13px] leading-snug font-medium text-slate-800">
        {story.title}
      </p>
      {story.summary ? (
        <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-slate-500">
          {story.summary}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {shownIds.map((id) => {
          const source = sources.get(id);
          return (
            <SourceChip
              key={id}
              name={source?.name ?? "source"}
              color={source?.color ?? "#94a3b8"}
              onClick={() => onSource?.(id)}
            />
          );
        })}
        {extra > 0 ? (
          <span className="text-[10px] text-slate-400">+{extra} more</span>
        ) : null}
      </div>
      <CardActions read={read} onHide={onHide} onRead={onRead} />
    </article>
  );
}

export function ItemCard({
  item,
  source,
  onTag,
  onPlace,
  onVendor,
  onOpen,
  onSource,
  onHide,
  onRead,
  read,
  focused,
}: {
  item: Item;
  source?: Source;
  onTag: (tag: string) => void;
  onPlace?: (place: string) => void;
  onVendor?: (vendor: string) => void;
  onOpen?: () => void;
  onSource?: (sourceId: number) => void;
  onHide?: () => void;
  onRead?: () => void;
  read?: boolean;
  focused?: boolean;
}) {
  const author = personName(item, source) ?? undefined;
  const vendors = mineItem(item).vendors.slice(0, 4);

  return (
    <article
      className={`card-tile ${onOpen ? "cursor-pointer" : ""} ${read ? "opacity-55" : ""} ${focused ? "card-tile-focus" : ""}`}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1">
          {item.topics.concat(item.tags.filter((tag) => !item.topics.includes(tag))).map((tag) => {
            const style = tagStyle(tag);
            return (
              <Tip key={tag} text={`Filter to ${tag}`}>
              <button
                type="button"
                className="tag"
                style={{ background: style.bg, color: style.fg }}
                onClick={(event) => {
                  event.stopPropagation();
                  onTag(tag);
                }}
              >
                {tag}
              </button>
              </Tip>
            );
          })}
          {item.locations.slice(0, 3).map((place) => (
            <Tip key={place} text={`Filter to ${place}`}>
              <button
                type="button"
                className="tag"
                style={{ background: "#ecfeff", color: "#0e7490" }}
                onClick={(event) => {
                  event.stopPropagation();
                  onPlace?.(place);
                }}
              >
                {place}
              </button>
            </Tip>
          ))}
          {vendors.map((vendor) => (
            <Tip key={vendor} text={`Filter to vendor ${vendor}`}>
              <button
                type="button"
                className="tag"
                style={{ background: "#fee2e2", color: "#9f1239" }}
                onClick={(event) => {
                  event.stopPropagation();
                  onVendor?.(vendor);
                }}
              >
                {vendor}
              </button>
            </Tip>
          ))}
        </div>
        <Ago
          ts={item.publishedAt ?? item.fetchedAt}
          className="shrink-0 text-[10px] text-slate-400"
        />
      </div>
      <div className="mt-2">
        <p className="line-clamp-4 text-[13px] leading-snug font-medium text-slate-800">
          {item.title}
        </p>
        {item.summary ? (
          <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-slate-500">
            {item.summary}
          </p>
        ) : null}
      </div>
      <div className="mt-2 min-w-0 overflow-hidden">
        <SourceChip
          name={source?.name ?? "source"}
          color={source?.color ?? "#94a3b8"}
          extra={author}
          onClick={() => {
            if (source) onSource?.(source.id);
          }}
        />
      </div>
      <CardActions read={read} onHide={onHide} onRead={onRead} />
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
  const status =
    value >= 70
      ? { label: "Reporting", hint: "Most enabled sources posted recently." }
      : value >= 40
        ? { label: "Aging", hint: "Several enabled sources have gone quiet." }
        : { label: "Quiet", hint: "Few sources reported. Coverage may be stale." };
  return (
    <div className="card-tile">
      <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
        Source freshness
      </div>
      <div className="mt-1.5 flex items-center gap-3">
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
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-800">{status.label}</div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            {fresh} of {total} enabled sources posted in the last 6 hours.
          </div>
          <div className="mt-1 text-[11px] leading-snug text-slate-400">{status.hint}</div>
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

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function CacheCard({
  entries,
  bytes,
}: {
  entries: number;
  bytes: number;
}) {
  return (
    <div className="card-tile">
      <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
        Outbound cache
      </div>
      <div className="mt-1.5 text-sm font-semibold text-slate-800">
        {entries} cached responses · {formatBytes(bytes)}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
        Stops refresh from re-hitting the same RSS, KEV, and article URLs. TTL: RSS 15m ·
        JSON 30m · KEV 1h · HTML 6h.
      </p>
    </div>
  );
}

export function SourceLayerCard({
  source,
  itemCount,
  sample,
  active,
  onToggle,
  onOpen,
}: {
  source: Source;
  itemCount: number;
  sample?: string | null;
  active?: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const origin = originCopy(source);

  return (
    <article
      className={`card-tile source-layer-card cursor-pointer ${active ? "ring-1 ring-slate-800" : ""}`}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1.5">
          <span className="mt-1 size-1.5 shrink-0 rounded-full" style={{ background: source.color }} />
          <Tip text={source.url}>
            <span className="text-[11px] leading-snug font-semibold tracking-wide text-slate-800 uppercase">
              {shortSourceName(source.name)}
            </span>
          </Tip>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          className="text-[10px] text-slate-500 hover:text-slate-800"
        >
          {source.enabled ? "hide" : "on"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="origin-badge">{origin.label}</span>
        {origin.via ? (
          <span className="truncate text-[10px] text-slate-400">via {origin.via}</span>
        ) : null}
        {source.handle ? (
          <span className="truncate text-[10px] text-slate-400">{source.handle}</span>
        ) : null}
      </div>
      <p className="mt-1 text-[10px] leading-snug text-slate-500">
        {itemCount} {itemCount === 1 ? "item" : "items"} ·{" "}
        {source.lastFetchedAt ? <Ago ts={source.lastFetchedAt} /> : "never fetched"}
      </p>
      {sample ? (
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-600">{sample}</p>
      ) : (
        <p className="mt-1 text-[10px] text-slate-400">No items in this window.</p>
      )}
    </article>
  );
}
