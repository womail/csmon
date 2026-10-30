import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreTopics } from "../topic-rules";

function topics(title: string, summary?: string, hint?: Parameters<typeof scoreTopics>[2]) {
  return scoreTopics(title, summary ?? null, hint).map((row) => row.topic);
}

test("one weak signal is not enough", () => {
  assert.equal(topics("Prices fall at holiday markets").includes("markets"), false);
  assert.equal(topics("Who will win the race?").includes("health"), false);
});

test("title matches weigh more than summary matches", () => {
  const inTitle = scoreTopics("Ransomware hits council", null).find((row) => row.topic === "cyber");
  const inBody = scoreTopics("Council update", "ransomware").find((row) => row.topic === "cyber");
  assert.ok(inTitle);
  assert.ok(!inBody || inBody.score < inTitle.score);
});

test("security sources damp sports and health", () => {
  const hint = { handle: "bleeping", feedUrl: "https://www.bleepingcomputer.com/feed/" };
  const got = topics("Hackers target football club fans with phishing", undefined, hint);
  assert.ok(got.includes("cyber"));
  assert.equal(got.includes("sports"), false);
});

test("evidence lists the matched signals", () => {
  const row = scoreTopics("CISA adds CVE-2026-1234 to KEV catalog", null).find((entry) => entry.topic === "cyber");
  assert.ok(row);
  assert.ok(row.hits.length > 0);
});

test("threat actor names are not weather", () => {
  assert.equal(topics("Volt Typhoon targets US water utilities").includes("weather"), false);
});

test("college football talk is sports and a state name alone is not", () => {
  assert.equal(topics("Michigan was never going to win that game with their current offensive coordinator.").includes("sports"), true);
  assert.equal(topics("No game has deserved to end in a tie more than this Michigan-Indiana one").includes("sports"), true);
  assert.equal(topics("Defense really needs to score for Michigan.").includes("sports"), true);
  assert.equal(topics("This game could have been newspaper agate.").includes("sports"), true);
  assert.equal(topics("F-16 crashes in Michigan").includes("sports"), false);
  assert.equal(topics("Michigan CEO loses job after posting an AI-made image").includes("sports"), false);
  assert.equal(topics("Ok that's it fire him").includes("sports"), false);
  assert.equal(topics("replace Beck with this guy").includes("sports"), false);
});
