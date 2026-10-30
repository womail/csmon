import assert from "node:assert/strict";
import { test } from "node:test";
import { itemHasTopic } from "../classify";
import { lanesForItem, matchesLane } from "../lanes";

const cyberItem = {
  title: "Vendor patches router flaw",
  summary: "The bug lets an attacker take over the device.",
  topics: ["cyber"],
  tags: ["cyber"],
  extractText: "Researchers who found the attack say the WHO and markets were not affected.",
};

test("known topics read stored topics only", () => {
  assert.equal(itemHasTopic(cyberItem, "cyber"), true);
  assert.equal(itemHasTopic(cyberItem, "health"), false);
  assert.equal(itemHasTopic(cyberItem, "conflict"), false);
  assert.equal(itemHasTopic(cyberItem, "markets"), false);
});

test("free-text topics still match by word", () => {
  assert.equal(itemHasTopic(cyberItem, "router"), true);
  assert.equal(itemHasTopic(cyberItem, "satellite"), false);
});

test("lanes follow stored topics", () => {
  const war = { title: "Missile strikes hit Kharkiv", summary: null, topics: ["war"], tags: [] };
  const unrestCopy = { title: "Protesters clash with police", summary: null, topics: ["politics"], tags: [] };
  assert.equal(matchesLane(war, "war"), true);
  assert.deepEqual(lanesForItem(war), ["war"]);
  assert.equal(matchesLane(unrestCopy, "unrest"), false);
});
