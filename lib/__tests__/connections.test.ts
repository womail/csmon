import assert from "node:assert/strict";
import { test } from "node:test";
import type { Story } from "../cluster";
import { connectionsFor, reportRefs, sharedReportRef, storiesWithRef } from "../connections";
import type { Item, Source } from "../types";

let nextId = 1;

function item(topics: string[], locations: string[], title = "Story"): Item {
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

function story(items: Item[]): Story {
  return {
    id: `s${items[0].id}`,
    title: items[0].title,
    summary: null,
    url: items[0].url,
    latestAt: items[0].publishedAt ?? 0,
    topics: [...new Set(items.flatMap((row) => row.topics))],
    locations: [...new Set(items.flatMap((row) => row.locations))],
    tags: [],
    items,
    sourceIds: [1],
  };
}

const sources = new Map<number, Source>();

function corpus() {
  const war = [
    story([item(["war"], ["Ukraine"]), item(["war"], ["Ukraine"]), item(["war"], ["Ukraine"])]),
    story([item(["war"], ["Ukraine"])]),
    story([item(["war"], ["Ukraine"])]),
    story([item(["war"], ["Gaza"])]),
  ];
  const other = [
    story([item(["sports"], ["UK"])]),
    story([item(["sports"], ["UK"])]),
    story([item(["markets"], ["US"])]),
    story([item(["markets"], ["Ukraine"])]),
  ];
  return { war, all: [...war, ...other] };
}

test("lift math and story-level counting", () => {
  const { war, all } = corpus();
  const rows = connectionsFor(war, all, sources, { exclude: [{ kind: "topic", value: "war" }] });
  const ukraine = rows.find((row) => row.kind === "place" && row.value === "Ukraine");
  assert.ok(ukraine);
  assert.equal(ukraine.together, 3);
  assert.equal(ukraine.base, 4);
  assert.equal(ukraine.focus, 4);
  assert.ok(Math.abs(ukraine.lift - 3 / 4 / (4 / 8)) < 1e-9);
});

test("active facets are excluded and minTogether is respected", () => {
  const { war, all } = corpus();
  const rows = connectionsFor(war, all, sources, { exclude: [{ kind: "topic", value: "war" }] });
  assert.equal(rows.some((row) => row.kind === "topic" && row.value === "war"), false);
  assert.equal(rows.some((row) => row.value === "Gaza"), false);
  const loose = connectionsFor(war, all, sources, { minTogether: 1, exclude: [{ kind: "topic", value: "war" }] });
  assert.ok(loose.some((row) => row.value === "Gaza"));
});

test("stable ordering", () => {
  const { war, all } = corpus();
  const a = connectionsFor(war, all, sources).map((row) => `${row.kind}:${row.value}`);
  const b = connectionsFor(war, all, sources).map((row) => `${row.kind}:${row.value}`);
  assert.deepEqual(a, b);
});

test("storiesWithRef skips the given story", () => {
  const { war, all } = corpus();
  const found = storiesWithRef({ kind: "place", value: "Ukraine" }, all, sources, war[0]);
  assert.equal(found.includes(war[0]), false);
  assert.equal(found.length, 3);
});

test("report link prefers orgs and skips unrelated stories", () => {
  const report = reportRefs([{ title: "APT28 exploits Microsoft Outlook flaw CVE-2023-23397", summary: null }]);
  const linked = story([item(["cyber"], [], "Microsoft patches bug used by APT28")]);
  const other = story([item(["sports"], [], "Cup final tonight")]);
  assert.deepEqual(sharedReportRef(linked, report, sources), { kind: "org", value: "APT28" });
  assert.equal(sharedReportRef(other, report, sources), null);
});
