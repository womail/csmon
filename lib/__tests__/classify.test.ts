import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyItem } from "../classify";
import { HEADLINES } from "./fixtures/headlines";

for (const row of HEADLINES) {
  test(`topics: ${row.title}`, () => {
    const got = classifyItem(row.title, row.summary ?? null, row.source ?? null).topics;
    const missing = row.topics.filter((topic) => !got.includes(topic));
    const extra = (row.notTopics ?? []).filter((topic) => got.includes(topic));
    assert.deepEqual(
      { missing, extra },
      { missing: [], extra: [] },
      `got [${got.join(", ")}] for "${row.title}"`,
    );
  });
}
