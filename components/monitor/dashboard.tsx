"use client";

import dynamic from "next/dynamic";
import { CloudLightning, Landmark, Siren, Waves } from "lucide-react";
import { Ago } from "@/components/monitor/ago";
import type { MouseEvent } from "react";
import { SourceChip, StoryCard, type CardChip } from "@/components/monitor/cards";
import { placeMarkers } from "@/components/monitor/map";

const SituationMap = dynamic(
  () => import("@/components/monitor/situation-map").then((mod) => ({ default: mod.SituationMap })),
  { ssr: false, loading: () => null },
);
import { Tip } from "@/components/monitor/tip";
import type { MapMarker } from "@/lib/geo";
import type { Story } from "@/lib/cluster";
import { tagStyle } from "@/lib/colors";
import { SITUATION_LANES, type SituationLane } from "@/lib/lanes";
import type { PersonRow } from "@/lib/people";
import type { QuakeEvent } from "@/lib/quakes";
import type { TrendRow } from "@/lib/trends";
import type { StoryCorroboration } from "@/lib/story-corroboration";
import type { Item, Source } from "@/lib/types";
import type { EpssScore } from "@/lib/vuln-intel";
import type { WeatherEvent } from "@/lib/weather";
import type { NaturalEvent, OutageRow } from "@/lib/hazards";

const LANE_ICON = {
  weather: CloudLightning,
  quake: Waves,
  war: Landmark,
  unrest: Siren,
} as const;

export function HomeDashboard({
  stories,
  items,
  catalogTopics,
  catalogSources,
  people,
  quakes,
  weatherEvents = [],
  naturalEvents = [],
  outages = [],
  topic,
  layer,
  person,
  place,
  platform,
  rising,
  queryActive,
  searchQuery,
  onResetFilter,
  onOpenStory,
  onLane,
  onTopic,
  activeTags,
  onPlace,
  onSource,
  onPerson,
  onVendor,
  onHide,
  onRead,
  sources,
  compact,
  readKeys,
  trends,
  trendHint,
  onTrend,
  onStoryMenu,
  onChipMenu,
  corroborationFor,
  kevCveIds,
  epss,
  onCve,
  onCopyLinkForStory,
  cardAnchorForStory,
}: {
  onStoryMenu?: (story: Story, event: MouseEvent) => void;
  onChipMenu?: (chip: CardChip, event: MouseEvent) => void;
  corroborationFor?: (story: Story) => StoryCorroboration;
  kevCveIds?: ReadonlySet<string>;
  epss?: ReadonlyMap<string, EpssScore>;
  onCve?: (cve: string) => void;
  onCopyLinkForStory?: (story: Story) => void;
  cardAnchorForStory?: (story: Story) => string | undefined;
  stories: Story[];
  items: Item[];
  catalogTopics: [string, number][];
  catalogSources: { id: number; name: string; count: number; color: string }[];
  people: PersonRow[];
  quakes: QuakeEvent[];
  weatherEvents?: WeatherEvent[];
  naturalEvents?: NaturalEvent[];
  outages?: OutageRow[];
  topic: string | null;
  layer: number | null;
  person: string | null;
  place: string | null;
  platform?: string | null;
  rising?: boolean;
  queryActive?: boolean;
  searchQuery?: string;
  onResetFilter?: () => void;
  onOpenStory: (story: Story) => void;
  onLane: (lane: SituationLane) => void;
  onTopic: (topic: string) => void;
  activeTags?: string[];
  onPlace: (place: string) => void;
  onSource: (sourceId: number) => void;
  onPerson: (name: string) => void;
  onVendor?: (vendor: string) => void;
  onHide?: (story: Story) => void;
  onRead?: (story: Story) => void;
  sources: Map<number, Source>;
  compact?: boolean;
  readKeys?: string[];
  trends?: TrendRow[];
  trendHint?: string;
  onTrend?: (row: TrendRow) => void;
}) {
  function homeStoryCard(story: Story) {
    return (
      <StoryCard
        key={story.id}
        story={story}
        sources={sources}
        corroboration={corroborationFor?.(story)}
        kevCveIds={kevCveIds}
        epss={epss}
        onCve={onCve}
        onOpen={() => onOpenStory(story)}
        onTopic={onTopic}
        activeTags={activeTags}
        onPlace={onPlace}
        onVendor={onVendor}
        onSource={onSource}
        onHide={onHide ? () => onHide(story) : undefined}
        onRead={onRead ? () => onRead(story) : undefined}
        onReclassify={onStoryMenu ? (event) => onStoryMenu(story, event) : undefined}
        onChipMenu={onChipMenu}
        onCopyLink={onCopyLinkForStory ? () => onCopyLinkForStory(story) : undefined}
        cardAnchorId={cardAnchorForStory?.(story)}
        read={readKeys?.includes(`story:${story.id}`)}
      />
    );
  }

  const filtered = Boolean(
    topic || layer || person || place || platform || rising || queryActive || searchQuery?.trim(),
  );

  const filteredLabel = [
    place,
    topic,
    person,
    layer != null ? "source layer" : null,
    platform,
    rising ? "rising" : null,
    searchQuery?.trim() ? "search" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const lanes = SITUATION_LANES.map((lane) => {
    const laneStories = stories.filter(
      (story) =>
        story.items.some((item) => item.topics.includes(lane.id) || item.tags.includes(lane.id)) ||
        story.topics.includes(lane.id) ||
        lane.re.test(`${story.title} ${story.summary ?? ""}`),
    );
    return { ...lane, stories: laneStories, count: laneStories.length };
  });

  return (
    <div className="space-y-1.5 p-2">
      <div>
        <div className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
          Home dashboard
        </div>
        <p className="mt-1 max-w-2xl text-[13px] text-slate-700">
          Click a topic, source, or person to filter this dash in place. The map below is its own pane
          — country outlines, not a background under the copy.
        </p>
      </div>

      {filtered && onResetFilter ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-200 bg-cyan-50/80 px-3 py-2">
          <p className="text-[12px] text-cyan-950">
            Showing filtered view{filteredLabel ? `: ${filteredLabel}` : ""}. Lanes are hidden until you reset.
          </p>
          <Tip text="Clear topic, place, source, and other Home filters">
            <button
              type="button"
              className="shrink-0 rounded-md border border-cyan-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-cyan-900 hover:bg-cyan-50"
              onClick={onResetFilter}
            >
              Back to full dashboard
            </button>
          </Tip>
        </div>
      ) : null}

      <section className="card-tile">
        <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Topics</div>
        <div className="mt-2 flex flex-wrap gap-1">
          {catalogTopics.slice(0, 14).map(([name, count]) => {
            const style = tagStyle(name);
            const active = topic === name;
            return (
              <Tip key={name} text={active ? `Clear ${name}` : `Filter dashboard to ${name}`}>
                <button
                  type="button"
                  className="tag"
                  style={{
                    background: active ? style.fg : style.bg,
                    color: active ? "#fff" : style.fg,
                  }}
                  onClick={() => onTopic(name)}
                >
                  {name} {count}
                </button>
              </Tip>
            );
          })}
        </div>
      </section>

      <section className="card-tile">
        <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
          Top sources
        </div>
        <div className="mt-2 flex flex-wrap content-start gap-1">
          {catalogSources.slice(0, 16).map((source) => (
            <SourceChip
              key={source.id}
              name={source.name}
              color={source.color}
              count={source.count}
              filled
              active={layer === source.id}
              onClick={() => onSource(source.id)}
            />
          ))}
        </div>
      </section>

      {people.length > 0 ? (
        <section className="card-tile">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">People</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {people.slice(0, 10).map((row) => (
              <Tip key={row.name} text={`Filter to items by ${row.name}`}>
                <button
                  type="button"
                  className="tag"
                  style={{
                    background: person === row.name ? "#6d28d9" : "#ede9fe",
                    color: person === row.name ? "#fff" : "#6d28d9",
                  }}
                  onClick={() => onPerson(row.name)}
                >
                  {row.name} {row.count}
                </button>
              </Tip>
            ))}
          </div>
        </section>
      ) : null}

      {!filtered && trends && trends.length > 0 ? (
        <section className="card-tile">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
              Rising now
            </div>
            {trendHint ? <div className="text-[10px] text-slate-400">{trendHint}</div> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {trends.map((row) => (
              <Tip
                key={`${row.kind}:${row.id}`}
                text={`${row.label} ${row.prev}→${row.now} · ${row.sample}`}
              >
                <button
                  type="button"
                  className="tag"
                  style={{
                    background: row.direction === "new" ? "#ffedd5" : "#dcfce7",
                    color: row.direction === "new" ? "#c2410c" : "#15803d",
                  }}
                  onClick={() => onTrend?.(row)}
                >
                  {row.direction === "new" ? "●" : "▲"} {row.label} {row.prev}→{row.now}
                </button>
              </Tip>
            ))}
          </div>
        </section>
      ) : null}

      <SituationMap
        title="Where coverage relates"
        markers={homeMarkers(items, quakes, weatherEvents, naturalEvents)}
        onSelect={onPlace}
        empty="Load world or hazard RSS to plot places, weather, and USGS quakes."
      />

      {filtered ? (
        <section>
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Filtered stories
            {topic ? ` · ${topic}` : ""}
            {person ? ` · ${person}` : ""}
            {place ? ` · ${place}` : ""}
            {platform ? ` · ${platform}` : ""}
            {rising ? " · rising" : ""}
            {queryActive ? " · query" : ""}
          </div>
          <div className={`board mt-1.5 ${compact ? "board-compact" : ""}`}>
            {stories.map((story) => homeStoryCard(story))}
            {stories.length === 0 ? (
              <p className="text-[12px] text-slate-400">Nothing in this filter. Click the chip again to clear.</p>
            ) : null}
          </div>
        </section>
      ) : (
        <>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
            {lanes.map((lane) => {
              const Icon = LANE_ICON[lane.id];
              return (
                <Tip key={lane.id} text={`Filter this dashboard to ${lane.label.toLowerCase()}`}>
                  <button
                    type="button"
                    onClick={() => onLane(lane.id)}
                    className="card-tile w-full text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-800">
                        <Icon className="size-3.5" />
                        {lane.label}
                      </span>
                      <span className="text-[12px] text-slate-400">{lane.count}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{lane.hint}</p>
                  </button>
                </Tip>
              );
            })}
          </div>
          <div className="grid gap-1.5 lg:grid-cols-2">
            {lanes.map((lane) => (
              <section key={lane.id} className="card-tile">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                    {lane.label}
                  </div>
                  <Tip text={`Filter the dashboard to ${lane.label.toLowerCase()}`}>
                    <button
                      type="button"
                      className="text-[11px] text-slate-500 hover:text-slate-800"
                      onClick={() => onLane(lane.id)}
                    >
                      Filter lane
                    </button>
                  </Tip>
                </div>
                <div className={`board mt-2 ${compact ? "board-compact" : ""}`}>
                  {lane.stories.slice(0, 4).map((story) => homeStoryCard(story))}
                  {lane.stories.length === 0 ? (
                    <p className="text-[12px] text-slate-400">No items in this window.</p>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {weatherEvents.length > 0 && !filtered ? (
        <section className="card-tile">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Weather events
          </div>
          <div className="mt-2 space-y-1">
            {weatherEvents.slice(0, 8).map((event) => (
              <Tip key={event.id} text={event.hint || "Open the warning"}>
                <a
                  href={event.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded px-1 py-1 hover:bg-slate-50"
                >
                  <span className="text-[12px] font-medium text-slate-800">{event.title}</span>
                  <span className="block text-[10px] text-slate-400">
                    {event.place} · {event.severity}
                    {event.hint ? ` · ${event.hint}` : ""}
                  </span>
                </a>
              </Tip>
            ))}
          </div>
        </section>
      ) : null}
      {naturalEvents.length > 0 && !filtered ? (
        <section className="card-tile">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Natural events · NASA EONET
          </div>
          <div className="mt-2 space-y-1">
            {naturalEvents.slice(0, 6).map((event) => (
              <Tip key={event.id} text="Open the source record">
                <a
                  href={event.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded px-1 py-1 hover:bg-slate-50"
                >
                  <span className="text-[12px] font-medium text-slate-800">{event.title}</span>
                  <span className="block text-[10px] text-slate-400">
                    {event.category}
                    {event.magnitude ? ` · ${event.magnitude}` : ""} · <Ago ts={event.time} />
                  </span>
                </a>
              </Tip>
            ))}
          </div>
        </section>
      ) : null}
      {outages.length > 0 && !filtered ? (
        <section className="card-tile">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Internet outages · IODA, last 24h
          </div>
          <div className="mt-2 space-y-1">
            {outages.slice(0, 6).map((row) => (
              <Tip key={row.code} text="Open the IODA country dashboard">
                <a
                  href={row.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded px-1 py-1 hover:bg-slate-50"
                >
                  <span className="text-[12px] font-medium text-slate-800">{row.country}</span>
                  <span className="block text-[10px] text-slate-400">
                    {row.events} event{row.events === 1 ? "" : "s"}
                    {row.signals.length ? ` · ${row.signals.join(", ")}` : ""}
                  </span>
                </a>
              </Tip>
            ))}
          </div>
        </section>
      ) : null}
      {quakes.length > 0 && !filtered ? (
        <section className="card-tile">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            USGS significant / M4.5+
          </div>
          <div className="mt-2 space-y-1">
            {quakes.slice(0, 6).map((quake) => (
              <Tip key={quake.id} text="Open the USGS event page">
                <a
                  href={quake.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded px-1 py-1 hover:bg-slate-50"
                >
                  <span className="font-mono text-[11px] text-orange-800">M{quake.mag.toFixed(1)}</span>{" "}
                  <span className="text-[12px] text-slate-800">{quake.place}</span>
                  <span className="block text-[10px] text-slate-400">
                    <Ago ts={quake.time} />
                  </span>
                </a>
              </Tip>
            ))}
          </div>
        </section>
      ) : null}
      {items.length === 0 ? (
        <p className="text-[12px] text-slate-500">
          Empty board. Load world RSS or hazard RSS from Sources, then come back here.
        </p>
      ) : null}
    </div>
  );
}

function homeMarkers(
  items: Item[],
  quakes: QuakeEvent[],
  weatherEvents: WeatherEvent[],
  naturalEvents: NaturalEvent[],
): MapMarker[] {
  const places = new Map<string, number>();
  for (const item of items) {
    for (const name of item.locations) places.set(name, (places.get(name) ?? 0) + 1);
  }
  return [
    ...placeMarkers(
      [...places.entries()].map(([name, count]) => ({ name, count })),
      "place",
    ),
    ...quakes.slice(0, 20).map((quake) => ({
      id: quake.id,
      name: quake.place.split(",").at(-1)?.trim() || quake.place,
      lat: quake.lat,
      lng: quake.lng,
      kind: "quake" as const,
      hint: `M${quake.mag.toFixed(1)} · ${quake.place}`,
    })),
    ...weatherEvents
      .filter((event) => event.lat != null && event.lng != null)
      .slice(0, 16)
      .map((event) => ({
        id: event.id,
        name: event.place,
        lat: event.lat as number,
        lng: event.lng as number,
        kind: "weather" as const,
        hint: `${event.severity} · ${event.title}`,
      })),
    ...naturalEvents
      .filter((event) => event.lat != null && event.lng != null)
      .slice(0, 24)
      .map((event) => ({
        id: `eonet-${event.id}`,
        name: event.title,
        lat: event.lat as number,
        lng: event.lng as number,
        kind: "weather" as const,
        hint: `${event.category} · ${event.title} (NASA EONET)`,
      })),
  ];
}

export function EntityDesk({
  title,
  hint,
  rows,
  onOpen,
}: {
  title: string;
  hint: string;
  rows: { id: string; title: string; meta: string; onOpen?: () => void }[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="space-y-2 p-3">
      <div>
        <div className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{title}</div>
        <p className="mt-1 text-[12px] text-slate-600">{hint}</p>
      </div>
      <div className="board">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => (row.onOpen ? row.onOpen() : onOpen(row.id))}
            className="card-tile w-full text-left"
          >
            <p className="text-[13px] leading-snug font-medium text-slate-800">{row.title}</p>
            <p className="mt-1 text-[11px] text-slate-500">{row.meta}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
