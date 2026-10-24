import type { Story } from "./cluster";
import { coordsForPlace } from "./geo";
import { lanesForItem, type SituationLane } from "./lanes";
import { itemMatchesQuery, parseQueryLine } from "./query-builder";
import { storyOrigins } from "./syndication";
import { itemMatchesRising } from "./trends";
import type { Item, Source } from "./types";

/** Visible Leaflet bounds. West may be greater than east when the frame crosses the date line. */
export type MapFrame = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type BriefRising = {
  kind: string;
  id: string;
  label: string;
};

export type BriefWatch = {
  id: number;
  name: string;
  query: string;
  desk: string | null;
};

const LANE_LABEL: Record<SituationLane, string> = {
  weather: "Weather",
  quake: "Quakes",
  war: "War",
  unrest: "Unrest",
};

export function sameFrame(a: MapFrame, b: MapFrame) {
  const close = (left: number, right: number) => Math.abs(left - right) < 0.05;
  return close(a.south, b.south) && close(a.west, b.west) && close(a.north, b.north) && close(a.east, b.east);
}

export function inMapFrame(lat: number, lng: number, frame: MapFrame) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < frame.south || lat > frame.north) return false;
  if (frame.east - frame.west >= 360) return true;
  if (frame.west <= frame.east) return lng >= frame.west && lng <= frame.east;
  return lng >= frame.west || lng <= frame.east;
}

export function pointForStory(story: Story) {
  const place = story.locations.find((name) => coordsForPlace(name));
  return place ? coordsForPlace(place) ?? null : null;
}

/** Geocoded stories, clipped to the frame once the map has reported one. */
export function storiesInFrame(stories: Story[], frame: MapFrame | null) {
  const mapped: Story[] = [];
  for (const story of stories) {
    const point = pointForStory(story);
    if (!point) continue;
    if (frame && !inMapFrame(point.lat, point.lng, frame)) continue;
    mapped.push(story);
  }
  return mapped;
}

function laneLabel(story: Story) {
  const item = story.items[0];
  if (!item) return null;
  const lane = lanesForItem(item)[0];
  return lane ? LANE_LABEL[lane] : null;
}

function sourceNames(story: Story, sources: Map<number, Source>) {
  return storyOrigins(story.items).map((origin) => sources.get(origin.sourceIds[0] ?? -1)?.name ?? "source");
}

function itemHitsWatch(item: Item, query: string, source?: Source) {
  const parsed = parseQueryLine(query);
  if (parsed.text) {
    const hay = `${item.title} ${item.summary ?? ""} ${item.extractText ?? ""} ${source?.name ?? ""} ${
      item.iocs?.join(" ") ?? ""
    }`.toLowerCase();
    if (!hay.includes(parsed.text.toLowerCase())) return false;
  }
  return itemMatchesQuery(item, parsed.tree, source);
}

function storyHitsWatch(story: Story, query: string, sources: Map<number, Source>) {
  return story.items.some((item) => itemHitsWatch(item, query, sources.get(item.sourceId)));
}

export type SituationBriefStory = {
  id: string;
  title: string;
  place: string;
  lane: string | null;
  sources: string[];
};

export type SituationBriefPlace = {
  name: string;
  count: number;
  lane: string | null;
};

export type SituationBrief = {
  storyCount: number;
  corroborated: number;
  rising: string[];
  stories: SituationBriefStory[];
  places: SituationBriefPlace[];
  watches: BriefWatch[];
  hypotheses: string[];
  hypothesisName: string | null;
};

export function buildSituationBrief(input: {
  stories: Story[];
  rising: BriefRising[];
  watches: BriefWatch[];
  hypotheses: string[];
  hypothesisName?: string | null;
  /** Desk ids this map is showing (the URL desk and the board it opens). */
  desks: string[];
  sources: Map<number, Source>;
}): SituationBrief {
  const names = new Map(input.stories.map((story) => [story.id, sourceNames(story, input.sources)]));
  const ranked = [...input.stories].sort((a, b) => {
    const count = (names.get(b.id)?.length ?? 0) - (names.get(a.id)?.length ?? 0);
    if (count !== 0) return count;
    return b.latestAt - a.latestAt;
  });
  const rising: string[] = [];
  for (const row of input.rising) {
    const key = new Set([`${row.kind}:${row.id}`]);
    const hit = input.stories.some((story) =>
      story.items.some((item) => itemMatchesRising(item, key, input.sources.get(item.sourceId))),
    );
    if (hit) rising.push(row.label);
    if (rising.length >= 4) break;
  }
  const placeCounts = new Map<string, { count: number; lanes: Map<string, number> }>();
  for (const story of input.stories) {
    const place = story.locations.find((name) => coordsForPlace(name));
    if (!place) continue;
    const row = placeCounts.get(place) ?? { count: 0, lanes: new Map<string, number>() };
    row.count += 1;
    const lane = laneLabel(story);
    if (lane) row.lanes.set(lane, (row.lanes.get(lane) ?? 0) + 1);
    placeCounts.set(place, row);
  }
  const places = [...placeCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([name, row]) => {
      let lane: string | null = null;
      let best = 0;
      for (const [label, count] of row.lanes) {
        if (count > best) {
          lane = label;
          best = count;
        }
      }
      return { name, count: row.count, lane };
    });
  const desks = new Set(input.desks);
  const watches = input.watches
    .filter((watch) => !watch.desk || desks.has(watch.desk))
    .filter((watch) => input.stories.some((story) => storyHitsWatch(story, watch.query, input.sources)))
    .slice(0, 3);

  return {
    storyCount: input.stories.length,
    corroborated: input.stories.filter((story) => (names.get(story.id)?.length ?? 0) >= 2).length,
    rising,
    stories: ranked.slice(0, 6).map((story) => ({
      id: story.id,
      title: story.title,
      place: story.locations.find((name) => coordsForPlace(name)) ?? story.locations[0] ?? "",
      lane: laneLabel(story),
      sources: names.get(story.id) ?? [],
    })),
    places,
    watches,
    hypotheses: input.hypotheses.slice(0, 3),
    hypothesisName: input.hypothesisName ?? null,
  };
}
