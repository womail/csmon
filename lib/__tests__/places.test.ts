import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyItem, textHasPlace } from "../classify";
import { itemHasPlace } from "../places";
import { HEADLINES } from "./fixtures/headlines";

for (const row of HEADLINES.filter((entry) => entry.places?.length || entry.notPlaces?.length)) {
  test(`places: ${row.title}`, () => {
    const got = classifyItem(row.title, row.summary ?? null, row.source ?? null).locations;
    const missing = (row.places ?? []).filter((place) => !got.includes(place));
    const extra = (row.notPlaces ?? []).filter((place) => got.includes(place));
    assert.deepEqual({ missing, extra }, { missing: [], extra: [] }, `got [${got.join(", ")}]`);
  });
}

test("Ireland matches Irish copy without stored tags", () => {
  for (const title of ["Irish government responds", "Galway flooding", "Éire in the news", "Dublin port strike"]) {
    assert.ok(itemHasPlace({ title, summary: null, locations: [] }, "Ireland"), title);
  }
});

test("the word us is not the US", () => {
  assert.equal(textHasPlace("Tell us what you think", "US"), false);
  assert.equal(textHasPlace("US sanctions Iran", "US"), true);
});

test("actor home only when no place is named", () => {
  assert.deepEqual(classifyItem("Hezbollah fires rockets", null).locations, ["Lebanon"]);
  assert.ok(!classifyItem("Hezbollah delegation lands in Tehran", null).locations.includes("Lebanon"));
});
