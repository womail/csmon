import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFacetIndex, rankEntries, splitPrefix, type IndexEntry } from "../palette-index";
import type { Item, Source } from "../types";

let nextId = 1;
function item(title: string, topics: string[], locations: string[] = []): Item {
  const id = nextId++;
  return {
    id,
    sourceId: 1,
    externalId: String(id),
    title,
    summary: null,
    url: `https://x/${id}`,
    author: null,
    publishedAt: id,
    tags: [],
    topics,
    locations,
    fetchedAt: id,
  };
}

const sources = new Map<number, Source>([
  [1, { id: 1, kind: "rss", handle: "https://www.cisa.gov/cybersecurity-advisories/all.xml", name: "CISA", enabled: true, lastFetchedAt: null, lastError: null, sourceType: "cert" } as unknown as Source],
]);

test("index counts each value once per item", () => {
  const index = buildFacetIndex(
    [item("Ireland storm warning", ["weather"], ["Ireland"]), item("Ireland flood", ["weather"], ["Ireland", "Ireland"])],
    sources,
  );
  const ireland = index.find((row) => row.kind === "place" && row.value === "Ireland");
  assert.equal(ireland?.count, 2);
  assert.ok(index.some((row) => row.kind === "family" && row.value === "hazards"));
  assert.ok(index.some((row) => row.kind === "stype" && row.value === "cert"));
});

test("prefix narrows the kind", () => {
  assert.deepEqual(splitPrefix("place:ire"), { kind: "place", needle: "ire" });
  assert.deepEqual(splitPrefix("org:"), { kind: "org", needle: "" });
  assert.deepEqual(splitPrefix("ireland"), { kind: null, needle: "ireland" });
});

test("ranking: exact prefix before word start before substring; recent breaks ties", () => {
  const index: IndexEntry[] = [
    { kind: "place", value: "Northern Ireland", label: "Northern Ireland", count: 9 },
    { kind: "place", value: "Ireland", label: "Ireland", count: 3 },
    { kind: "topic", value: "fireline", label: "fireline", count: 20 },
    { kind: "person", value: "Iren Ash", label: "Iren Ash", count: 3 },
  ];
  const ranked = rankEntries(index, "ire").map((row) => row.value);
  assert.deepEqual(ranked, ["Ireland", "Iren Ash", "Northern Ireland", "fireline"]);
  const withRecent = rankEntries(index, "ire", { recent: ["person:iren ash"] }).map((row) => row.value);
  assert.deepEqual(withRecent.slice(0, 2), ["Iren Ash", "Ireland"]);
  assert.deepEqual(
    rankEntries(index, "place:ire").map((row) => row.value),
    ["Ireland", "Northern Ireland"],
  );
});
