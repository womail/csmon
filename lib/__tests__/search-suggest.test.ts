import assert from "node:assert/strict";
import { test } from "node:test";
import { searchSuggestions, type SearchSuggestData } from "../search-suggest";

const data: SearchSuggestData = {
  source: ["CISA"],
  place: ["Dublin", "Spain"],
  topic: ["cyber"],
  vendor: [],
  author: [],
};

test("Irel and Ireland offer place:Ireland", () => {
  for (const query of ["Irel", "Ireland"]) {
    const labels = searchSuggestions(query, data).map((row) => row.insert);
    assert.ok(labels.includes("place:Ireland"), query);
  }
});

test("place: lists places, including the pinned ones", () => {
  const labels = searchSuggestions("place:", data).map((row) => row.label);
  assert.ok(labels.includes("Ireland"));
  assert.ok(labels.includes("UK"));
  assert.ok(labels.includes("US"));
  assert.ok(labels.includes("Dublin"));
});

test("place:Ire narrows to Ireland", () => {
  const labels = searchSuggestions("place:Ire", data).map((row) => row.insert);
  assert.deepEqual(labels, ["place:Ireland"]);
});
