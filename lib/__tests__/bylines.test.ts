import assert from "node:assert/strict";
import { test } from "node:test";
import { looksLikePersonName, parseByline } from "../bylines";

const CASES: { raw: string; source?: { name?: string; type?: string }; people: string[]; outlet?: string | null }[] = [
  { raw: "Sergiu Gatlan", people: ["Sergiu Gatlan"] },
  { raw: "Charlie Savage", source: { name: "NYT > World", type: "outlet" }, people: ["Charlie Savage"] },
  { raw: "By Jane Doe and John Roe", people: ["Jane Doe", "John Roe"] },
  { raw: "Conor Humphries ", people: ["Conor Humphries"] },
  { raw: "Edward Wong, Senior Correspondent", people: ["Edward Wong"] },
  { raw: "info@thehackernews.com (The Hacker News)", people: [], outlet: "The Hacker News" },
  { raw: "nhcwebmaster@noaa.gov (NHC Webmaster)", people: [], outlet: "NHC Webmaster" },
  { raw: "The New York Times", people: [], outlet: "The New York Times" },
  { raw: "The New York Times en Español", people: [], outlet: "The New York Times en Español" },
  { raw: "MSRC Security Update Guide", people: [], outlet: "MSRC Security Update Guide" },
  { raw: "CISA", people: [], outlet: "CISA" },
  { raw: "AL-MONITOR: The Pulse of The Middle East", people: [] },
  { raw: '"site:brookings.edu" - Google News', people: [] },
  { raw: "The Verge", people: [] },
  { raw: "rat king 🐀 👑", people: [] },
  { raw: "BBC Sport", people: [] },
  { raw: "Current watches, warnings, and advisories", people: [] },
  { raw: "posts from worldnews, news, europe", people: [] },
  { raw: "Reuters", people: [] },
  { raw: "dodai", people: [] },
  { raw: "Schneier on Security", people: [] },
];

for (const row of CASES) {
  test(`byline: ${row.raw}`, () => {
    const got = parseByline(row.raw, row.source);
    assert.deepEqual(got.people, row.people);
    if (row.outlet !== undefined) assert.equal(got.outlet, row.outlet);
  });
}

test("person-shaped names", () => {
  assert.equal(looksLikePersonName("Ursula von der Leyen"), true);
  assert.equal(looksLikePersonName("Conor O'Brien"), true);
  assert.equal(looksLikePersonName("Security News"), false);
  assert.equal(looksLikePersonName("Team 8"), false);
});
