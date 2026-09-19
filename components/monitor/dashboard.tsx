"use client";

import { CloudLightning, Landmark, Siren, Waves } from "lucide-react";
import { Ago } from "@/components/monitor/ago";
import { SituationMap, placeMarkers } from "@/components/monitor/map";
import { Tip } from "@/components/monitor/tip";
import type { MapMarker } from "@/lib/geo";
import type { Story } from "@/lib/cluster";
import { tagStyle } from "@/lib/colors";
import { SITUATION_LANES, type SituationLane } from "@/lib/lanes";
import type { PersonRow } from "@/lib/people";
import type { QuakeEvent } from "@/lib/quakes";
import type { Item } from "@/lib/types";
import type { WeatherEvent } from "@/lib/weather";

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
  topic,
  layer,
  person,
  place,
  onOpenStory,
  onLane,
  onTopic,
  onPlace,
  onSource,
  onPerson,
}: {
  stories: Story[];
  items: Item[];
  catalogTopics: [string, number][];
  catalogSources: { id: number; name: string; count: number; color: string }[];
  people: PersonRow[];
  quakes: QuakeEvent[];
  weatherEvents?: WeatherEvent[];
  topic: string | null;
  layer: number | null;
  person: string | null;
  place: string | null;
  onOpenStory: (story: Story) => void;
  onLane: (lane: SituationLane) => void;
  onTopic: (topic: string) => void;
  onPlace: (place: string) => void;
  onSource: (sourceId: number) => void;
  onPerson: (name: string) => void;
}) {
  const filtered = Boolean(topic || layer || person || place);
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
    <div className="space-y-3 p-3">
      <div>
        <div className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
          Home dashboard
        </div>
        <p className="mt-1 max-w-2xl text-[13px] text-slate-700">
          Click a topic, source, or person to filter this dash in place. The map below is its own pane
          — country outlines, not a background under the copy.
        </p>
      </div>

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
        <div className="mt-2 flex flex-wrap gap-1">
          {catalogSources.slice(0, 10).map((source) => (
            <Tip
              key={source.id}
              text={layer === source.id ? `Clear ${source.name}` : `Filter dashboard to ${source.name}`}
            >
              <button
                type="button"
                className={`source-chip rounded-full px-2 py-0.5 ${
                  layer === source.id ? "bg-slate-900 text-white" : "bg-slate-100"
                }`}
                onClick={() => onSource(source.id)}
              >
                <span className="source-chip-dot" style={{ background: source.color }} />
                {source.name} {source.count}
              </button>
            </Tip>
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
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    person === row.name ? "bg-slate-900 text-white" : "bg-violet-50 text-violet-800"
                  }`}
                  onClick={() => onPerson(row.name)}
                >
                  {row.name} {row.count}
                </button>
              </Tip>
            ))}
          </div>
        </section>
      ) : null}

      <SituationMap
        title="Where coverage relates"
        markers={homeMarkers(items, quakes, weatherEvents)}
        onSelect={onPlace}
        empty="Load world or hazard RSS to plot places, weather, and USGS quakes."
      />

      {filtered ? (
        <section className="card-tile">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Filtered stories
            {topic ? ` · ${topic}` : ""}
            {person ? ` · ${person}` : ""}
            {place ? ` · ${place}` : ""}
          </div>
          <div className="mt-2 space-y-1.5">
            {stories.slice(0, 16).map((story) => (
              <Tip key={story.id} text="Read this story in place">
                <button
                  type="button"
                  onClick={() => onOpenStory(story)}
                  className="block w-full rounded px-1 py-1 text-left hover:bg-slate-50"
                >
                  <span className="block text-[12.5px] leading-snug font-medium text-slate-800">
                    {story.title}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {story.sourceIds.length} sources
                    {story.locations[0] ? ` · ${story.locations[0]}` : ""}
                    {story.topics[0] ? ` · ${story.topics[0]}` : ""} · <Ago ts={story.latestAt} />
                  </span>
                </button>
              </Tip>
            ))}
            {stories.length === 0 ? (
              <p className="text-[12px] text-slate-400">Nothing in this filter. Click the chip again to clear.</p>
            ) : null}
          </div>
        </section>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
          <div className="grid gap-3 lg:grid-cols-2">
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
                <div className="mt-2 space-y-1.5">
                  {lane.stories.slice(0, 4).map((story) => (
                    <Tip key={story.id} text="Read this story in place">
                      <button
                        type="button"
                        onClick={() => onOpenStory(story)}
                        className="block w-full rounded px-1 py-1 text-left hover:bg-slate-50"
                      >
                        <span className="block text-[12.5px] leading-snug font-medium text-slate-800">
                          {story.title}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {story.sourceIds.length} sources
                          {story.locations[0] ? ` · ${story.locations[0]}` : ""} ·{" "}
                          <Ago ts={story.latestAt} />
                        </span>
                      </button>
                    </Tip>
                  ))}
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

function homeMarkers(items: Item[], quakes: QuakeEvent[], weatherEvents: WeatherEvent[]): MapMarker[] {
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
