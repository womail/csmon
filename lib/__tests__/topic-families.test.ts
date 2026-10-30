import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyItem } from "../classify";
import { TOPIC_FAMILIES, familiesForItem, familyOfTopic, itemInFamilies, sortByFamily } from "../topic-families";
import { TOPIC_SUBTAGS, topicRuleNames } from "../topic-rules";

test("every known topic belongs to exactly one family", () => {
  for (const topic of topicRuleNames()) {
    const owners = TOPIC_FAMILIES.filter((family) => family.topics.includes(topic));
    assert.equal(owners.length, 1, `${topic} is in ${owners.map((f) => f.id).join(", ") || "no family"}`);
  }
});

test("items with no topic are General", () => {
  assert.deepEqual(familiesForItem({ topics: [] }), ["general"]);
  assert.deepEqual(familiesForItem({ topics: ["reddit"] }), ["general"]);
  assert.equal(itemInFamilies({ topics: [] }, ["general"]), true);
  assert.equal(itemInFamilies({ topics: ["cyber"] }, ["general"]), false);
  assert.equal(itemInFamilies({ topics: ["war"] }, ["security", "conflict"]), true);
});

test("subtags map to their parent's family", () => {
  for (const entry of TOPIC_SUBTAGS) {
    assert.equal(familyOfTopic(entry.tag), familyOfTopic(entry.parent), entry.tag);
  }
  assert.equal(familyOfTopic("soccer"), "sports");
});

test("subtags only appear with their parent topic", () => {
  const sanctionsSport = classifyItem("Club fined after fans chant about sanctions", null);
  if (!sanctionsSport.topics.includes("politics")) {
    assert.equal(sanctionsSport.tags.includes("sanctions"), false);
  }
  const ransomware = classifyItem("Ransomware gang leaks hospital data after CVE-2026-1234 exploit", null);
  assert.ok(ransomware.topics.includes("cyber"));
  assert.ok(ransomware.tags.includes("ransomware"));
});

test("chips sort by family order", () => {
  assert.deepEqual(sortByFamily(["sports", "war", "cyber"]), ["cyber", "war", "sports"]);
});

test("familyCounts counts general for empty topics", async () => {
  const { familyCounts } = await import("../topic-families");
  const counts = familyCounts([{ topics: [] }, { topics: ["cyber", "war"] }, { topics: ["ransomware"] }]);
  assert.equal(counts.get("general"), 1);
  assert.equal(counts.get("security"), 2);
  assert.equal(counts.get("conflict"), 1);
});
