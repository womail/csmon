import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyItem } from "../classify";
import { orgAttribution, orgByName, orgsInText } from "../gazetteer/orgs";
import { figuresInText, rolePeopleInText, textMentionsPerson } from "../gazetteer/people";

const names = (text: string) => orgsInText(text).map((org) => org.name);

test("threat actor aliases resolve to one org", () => {
  assert.deepEqual(names("Microsoft says Forest Blizzard targeted embassies"), ["APT28"]);
  assert.deepEqual(names("Fancy Bear phishing wave"), ["APT28"]);
  assert.deepEqual(names("Midnight Blizzard breached email"), ["APT29"]);
  assert.equal(orgByName("Diamond Sleet")?.name, "Lazarus Group");
});

test("threat actors carry attribution and never become places", () => {
  const actor = orgByName("Volt Typhoon");
  assert.ok(actor);
  assert.equal(orgAttribution(actor), "attributed to China");
  const got = classifyItem("Volt Typhoon targets water utilities", null);
  assert.equal(got.locations.includes("China"), false);
});

test("acronyms match only in capitals", () => {
  assert.deepEqual(names("UN Security Council meets"), ["United Nations"]);
  assert.deepEqual(names("an unusual day"), []);
  assert.deepEqual(names("Who will win?"), []);
  assert.deepEqual(names("ICC wins toss in T20 cricket"), []);
});

test("ransomware with a common-word name needs context", () => {
  assert.deepEqual(names("Akira ransomware hits school"), ["Akira"]);
  assert.deepEqual(names("Akira Toriyama exhibition opens"), []);
});

test("surname rules", () => {
  assert.ok(figuresInText("Zelenskyy meets Starmer").some((f) => f.name === "Volodymyr Zelensky"));
  assert.ok(figuresInText("Putin warns West").some((f) => f.name === "Vladimir Putin"));
  assert.equal(figuresInText("Martin wins stage").length, 0);
  assert.equal(textMentionsPerson("Trumpet player", "Donald Trump"), false);
  assert.equal(textMentionsPerson("Trump says", "Donald Trump"), true);
});

test("role-anchored discovery", () => {
  const found = rolePeopleInText("Foreign Minister Wang Yi met Prime Minister Mette Frederiksen in Beijing");
  assert.deepEqual(
    found.map((row) => row.name),
    ["Wang Yi", "Mette Frederiksen"],
  );
});
