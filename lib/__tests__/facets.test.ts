import assert from "node:assert/strict";
import { test } from "node:test";
import { applyBoardItemFilters } from "../board-item-filter";
import { boardQueryString, parseBoardFilters } from "../board-state";
import {
  addFacet,
  clearFacets,
  facetsFromFilters,
  facetsToSearchLine,
  promoteTypedTokens,
  removeFacet,
  type FacetInput,
} from "../facets";
import type { Item, Source } from "../types";

function fromQuery(qs: string) {
  return parseBoardFilters(Object.fromEntries(new URLSearchParams(qs)));
}

const ROUND_TRIP: { qs: string; kind: string }[] = [
  { qs: "topic=cyber", kind: "topic" },
  { qs: "topics=war,unrest", kind: "topic" },
  { qs: "fam=security", kind: "family" },
  { qs: "tags=ransomware", kind: "tag" },
  { qs: "place=Ireland", kind: "place" },
  { qs: "person=Vladimir+Putin", kind: "person" },
  { qs: "org=APT28", kind: "org" },
  { qs: "vendor=Ivanti", kind: "vendor" },
  { qs: "cve=CVE-2026-1234", kind: "cve" },
  { qs: "layer=12", kind: "source" },
  { qs: "stype=cert", kind: "stype" },
  { qs: "cat=Security+News", kind: "category" },
  { qs: "origin=intel", kind: "origin" },
  { qs: "platform=rss", kind: "platform" },
  { qs: "rising=1", kind: "rising" },
  { qs: "cross=1", kind: "cross" },
  { qs: "ransomware=1", kind: "ransomware" },
  { qs: "not=topic:sports", kind: "topic" },
  { qs: "qb=place.eq.Ireland", kind: "rule" },
];

for (const row of ROUND_TRIP) {
  test(`round trip ${row.qs}`, () => {
    const filters = fromQuery(row.qs);
    const facets = facetsFromFilters(filters);
    const facet = facets.find((f) => f.kind === row.kind);
    assert.ok(facet, `no ${row.kind} facet from ${row.qs}`);
    let next = filters;
    for (const f of facetsFromFilters(next).filter((f) => f.kind === row.kind)) next = removeFacet(next, f);
    assert.equal(boardQueryString(next), "");
  });
}

test("old URL with -topic: in q shows a negated typed facet", () => {
  const facets = facetsFromFilters(fromQuery("q=-topic:sports+ireland"));
  const negated = facets.find((f) => f.kind === "topic");
  assert.ok(negated?.negate);
  assert.equal(negated?.from, "typed");
  assert.ok(facets.some((f) => f.kind === "text" && f.value === "ireland"));
});

test("exclude writes not= and keeps q empty", () => {
  const next = addFacet(fromQuery(""), { kind: "topic", value: "sports", negate: true });
  assert.equal(next.q, "");
  assert.equal(boardQueryString(next), "?not=topic%3Asports");
  const facet = facetsFromFilters(next)[0];
  assert.equal(facet.label, "not sports");
});

test("promoteTypedTokens moves facets out and leaves free text", () => {
  const next = promoteTypedTokens(fromQuery("q=place:Ireland+cyber+type:cert+org:APT28"));
  assert.equal(next.q, "cyber");
  assert.equal(next.place, "Ireland");
  assert.deepEqual(next.stype, ["cert"]);
  assert.equal(next.org, "APT28");
});

test("clear keeps desk and range", () => {
  const next = clearFacets(fromQuery("desk=brief&range=7d&topic=war&place=Ukraine&not=topic:sports"));
  assert.equal(boardQueryString(next), "?desk=brief&range=7d");
});

test("search line lists every token", () => {
  const line = facetsToSearchLine(facetsFromFilters(fromQuery("topic=war&place=Ukraine&not=source:12&stype=cert")));
  assert.equal(line, "topic:war place:Ukraine -source:12 type:cert");
});

function item(partial: Partial<Item>): Item {
  return {
    id: 1,
    sourceId: 1,
    externalId: "x",
    title: "t",
    summary: null,
    url: "https://x",
    author: null,
    publishedAt: Date.now(),
    tags: [],
    topics: [],
    locations: [],
    fetchedAt: Date.now(),
    ...partial,
  };
}

test("not= negates in the item filter", () => {
  const items = [item({ id: 1, topics: ["sports"] }), item({ id: 2, topics: ["cyber"] })];
  const filters = fromQuery("not=topic:sports");
  const source = { id: 1, sourceType: "outlet", origins: [], platform: "rss", name: "x", handle: null } as unknown as Source;
  const got = applyBoardItemFilters(items, filters, new Map([[1, source]]), { viewDesk: "scan" });
  assert.deepEqual(
    got.map((row) => row.id),
    [2],
  );
});

test("stype and fam filter by source type and family", () => {
  const cert = { id: 1, sourceType: "cert", origins: [], platform: "rss", name: "CERT", handle: null } as unknown as Source;
  const outlet = { id: 2, sourceType: "outlet", origins: [], platform: "rss", name: "Paper", handle: null } as unknown as Source;
  const byId = new Map([
    [1, cert],
    [2, outlet],
  ]);
  const items = [item({ id: 1, sourceId: 1, topics: ["cyber"] }), item({ id: 2, sourceId: 2, topics: [] })];
  const byType = applyBoardItemFilters(items, fromQuery("stype=cert"), byId, { viewDesk: "scan" });
  assert.deepEqual(byType.map((row) => row.id), [1]);
  const general = applyBoardItemFilters(items, fromQuery("fam=general"), byId, { viewDesk: "scan" });
  assert.deepEqual(general.map((row) => row.id), [2]);
});

test("addFacet positive clears a matching negation", () => {
  const input: FacetInput = { kind: "place", value: "Ireland" };
  const next = addFacet(fromQuery("not=place:Ireland"), input);
  assert.deepEqual(next.not, []);
  assert.equal(next.place, "Ireland");
});
