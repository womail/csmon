import { mineItem, matchVendorName } from "./mine";
import { figuresInText, personName } from "./people";
import { resolvePlace } from "./places";
import { rangeStart } from "./time";
import type { Item, Source, TimeRange } from "./types";

export type TrendKind = "topic" | "place" | "vendor" | "person";
export type TrendDirection = "up" | "down" | "flat" | "new";

export type TrendRow = {
  id: string;
  kind: TrendKind;
  label: string;
  now: number;
  prev: number;
  delta: number;
  change: number;
  direction: TrendDirection;
  sourcesNow: number;
  sourcesPrev: number;
  points: number[];
  sample: string;
};

export type TrendReport = {
  rows: TrendRow[];
  rising: TrendRow[];
  falling: TrendRow[];
  fresh: TrendRow[];
  compared: string;
};

type Bucket = { count: number; sources: Set<number>; sample: string };

export function itemTs(item: Item) {
  return item.publishedAt ?? item.fetchedAt;
}

export function trendBounds(range: TimeRange, now = Date.now()) {
  if (range === "all") {
    const span = 24 * 60 * 60 * 1000;
    return {
      prevStart: now - 2 * span,
      mid: now - span,
      end: now,
      compared: "last 24h vs the day before",
    };
  }
  const start = rangeStart(range) || now - 24 * 60 * 60 * 1000;
  const mid = start + (now - start) / 2;
  const compared =
    range === "1h"
      ? "last 30m vs 30m before"
      : range === "6h"
        ? "last 3h vs 3h before"
        : range === "7d"
          ? "last 3.5d vs 3.5d before"
          : "last 12h vs 12h before";
  return { prevStart: start, mid, end: now, compared };
}

function bump(map: Map<string, Bucket>, key: string, item: Item) {
  const row = map.get(key);
  if (!row) {
    map.set(key, { count: 1, sources: new Set([item.sourceId]), sample: item.title });
    return;
  }
  row.count += 1;
  row.sources.add(item.sourceId);
}

export function trendKeys(item: Item, source?: Source | null) {
  const out: { kind: TrendKind; id: string; label: string }[] = [];
  const seen = new Set<string>();
  function add(kind: TrendKind, id: string, label = id) {
    const key = `${kind}:${id}`;
    if (!id || seen.has(key)) return;
    seen.add(key);
    out.push({ kind, id, label });
  }
  for (const topic of item.topics) {
    if (topic !== "world") add("topic", topic);
  }
  for (const loc of item.locations) add("place", resolvePlace(loc));
  for (const vendor of mineItem(item).vendors) add("vendor", matchVendorName(vendor) ?? vendor);
  const author = personName(item, source);
  if (author) add("person", author);
  for (const figure of figuresInText(`${item.title} ${item.summary ?? ""}`)) add("person", figure);
  return out;
}

function direction(now: number, prev: number): TrendDirection {
  if (prev === 0 && now >= 2) return "new";
  if (now >= prev + 2 && now >= Math.max(2, prev * 1.25)) return "up";
  if (prev >= 2 && now <= prev * 0.75) return "down";
  return "flat";
}

export function buildTrends(
  items: Item[],
  range: TimeRange,
  sources: Map<number, Source>,
  now = Date.now(),
): TrendReport {
  const bounds = trendBounds(range, now);
  const series = items.filter((item) => {
    const ts = itemTs(item);
    return ts >= bounds.prevStart && ts <= bounds.end;
  });
  const recent: Item[] = [];
  const previous: Item[] = [];
  for (const item of series) {
    if (itemTs(item) >= bounds.mid) recent.push(item);
    else previous.push(item);
  }

  const nowMap = new Map<string, Bucket>();
  const prevMap = new Map<string, Bucket>();
  const labels = new Map<string, { kind: TrendKind; label: string }>();

  function ingest(list: Item[], map: Map<string, Bucket>) {
    for (const item of list) {
      for (const key of trendKeys(item, sources.get(item.sourceId))) {
        const id = `${key.kind}:${key.id}`;
        labels.set(id, { kind: key.kind, label: key.label });
        bump(map, id, item);
      }
    }
  }
  ingest(recent, nowMap);
  ingest(previous, prevMap);

  const bucketCount = 8;
  const width = Math.max(1, (bounds.end - bounds.prevStart) / bucketCount);
  const pointsFor = (id: string) => {
    const points = Array.from({ length: bucketCount }, () => 0);
    for (const item of series) {
      if (!trendKeys(item, sources.get(item.sourceId)).some((key) => `${key.kind}:${key.id}` === id)) {
        continue;
      }
      const index = Math.min(
        bucketCount - 1,
        Math.max(0, Math.floor((itemTs(item) - bounds.prevStart) / width)),
      );
      points[index] += 1;
    }
    return points;
  };

  const rows: TrendRow[] = [];
  for (const id of new Set([...nowMap.keys(), ...prevMap.keys()])) {
    const meta = labels.get(id);
    if (!meta) continue;
    const nowRow = nowMap.get(id);
    const prevRow = prevMap.get(id);
    const nowCount = nowRow?.count ?? 0;
    const prevCount = prevRow?.count ?? 0;
    if (nowCount + prevCount < 2) continue;
    rows.push({
      id: id.slice(id.indexOf(":") + 1),
      kind: meta.kind,
      label: meta.label,
      now: nowCount,
      prev: prevCount,
      delta: nowCount - prevCount,
      change: (nowCount - prevCount) / Math.max(prevCount, 1),
      direction: direction(nowCount, prevCount),
      sourcesNow: nowRow?.sources.size ?? 0,
      sourcesPrev: prevRow?.sources.size ?? 0,
      points: pointsFor(id),
      sample: nowRow?.sample ?? prevRow?.sample ?? "",
    });
  }

  rows.sort((a, b) => {
    const rank = (row: TrendRow) => {
      if (row.direction === "up") return 4000 + row.change * 100 + row.delta;
      if (row.direction === "new") return 3000 + row.now;
      if (row.direction === "down") return 2000 + Math.abs(row.change) * 100;
      return row.now;
    };
    return rank(b) - rank(a);
  });

  return {
    rows,
    rising: rows.filter((row) => row.direction === "up").slice(0, 10),
    falling: rows.filter((row) => row.direction === "down").slice(0, 8),
    fresh: rows.filter((row) => row.direction === "new").slice(0, 8),
    compared: bounds.compared,
  };
}

export function risingKeySet(report: TrendReport) {
  return new Set([...report.rising, ...report.fresh].map((row) => `${row.kind}:${row.id}`));
}

export function itemMatchesRising(item: Item, keys: Set<string>, source?: Source | null) {
  if (keys.size === 0) return false;
  return trendKeys(item, source).some((key) => keys.has(`${key.kind}:${key.id}`));
}

export function minedCves(items: Item[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const cve of mineItem(item).cves) counts.set(cve, (counts.get(cve) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
