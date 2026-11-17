import assert from "node:assert/strict";
import { test } from "node:test";
import { storyInLane } from "../lanes";

function story(title: string, summary: string, topics: string[]) {
  return {
    title,
    summary,
    topics,
    items: [{ title, summary, topics, tags: topics.includes("weather") ? ["storm"] : [] }],
  };
}

test("stormcast stays out of bad weather", () => {
  const row = story(
    "ISC Stormcast For Friday, October 16th, 2026",
    "Copyright SANS Institute. Internet Storm Center. All rights reserved.",
    ["cyber", "weather"],
  );
  assert.equal(storyInLane(row, "weather"), false);
});

test("a flood stays in bad weather", () => {
  const row = story("Flooding closes roads in Valencia", "Heavy rain flooded streets overnight.", ["weather"]);
  assert.equal(storyInLane(row, "weather"), true);
});

test("a hurricane that also mentions cyber stays in bad weather", () => {
  const row = story(
    "Hurricane cuts power across the coast",
    "The hurricane left towns without power after landfall.",
    ["weather", "cyber"],
  );
  assert.equal(storyInLane(row, "weather"), true);
});

test("a cyber item with no weather event stays out of bad weather", () => {
  const row = story("Phishing kit sold on a forum", "The kit has been linked to recent intrusions.", ["cyber", "weather"]);
  assert.equal(storyInLane(row, "weather"), false);
});
