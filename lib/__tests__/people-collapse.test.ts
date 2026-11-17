import assert from "node:assert/strict";
import { test } from "node:test";
import { newsPeopleFromItems } from "../people";
import type { Item } from "../types";

function item(id: number, title: string): Item {
  return {
    id,
    sourceId: 1,
    externalId: String(id),
    title,
    summary: null,
    url: `https://example.com/${id}`,
    author: null,
    publishedAt: 1,
    tags: [],
    topics: [],
    locations: [],
    fetchedAt: 1,
  };
}

test("a longer chip that starts with the same name collapses", () => {
  const rows = newsPeopleFromItems([
    item(1, "Rep. Thomas Massie sets a hearing"),
    item(2, "Sen. Thomas Massie Forces a vote on the bill"),
  ]);
  const names = rows.map((row) => row.name);
  assert.deepEqual(names, ["Thomas Massie"]);
  assert.equal(rows[0]?.count, 2);
});
