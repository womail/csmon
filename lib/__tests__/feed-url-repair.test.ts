import assert from "node:assert/strict";
import { test } from "node:test";
import { repairRssFeedUrl } from "../feed-url-repair";

test("repairs dead Politico politics08 feed", () => {
  assert.equal(
    repairRssFeedUrl("https://rss.politico.com/politics08.xml"),
    "https://rss.politico.com/politics-news.xml",
  );
});

test("repairs dead Reuters feeds.reuters.com world feed", () => {
  const next =
    "https://news.google.com/rss/search?q=when:24h+site:reuters.com/world&ceid=US:en&hl=en-US&gl=US";
  assert.equal(repairRssFeedUrl("https://feeds.reuters.com/reuters/worldNews"), next);
  assert.equal(repairRssFeedUrl("http://feeds.reuters.com/Reuters/worldNews"), next);
});

test("leaves working feeds alone", () => {
  const ok = "https://rss.politico.com/politics-news.xml";
  assert.equal(repairRssFeedUrl(ok), ok);
});
