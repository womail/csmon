import assert from "node:assert/strict";
import { test } from "node:test";
import { intelFeedUrlMatches, repairRssFeedUrl } from "../feed-url-repair";

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

test("intel catalog URL sync skips a user-edited feed URL", () => {
  const catalog = "https://feeds.bbci.co.uk/sport/rss.xml";
  assert.equal(intelFeedUrlMatches(catalog, catalog), true);
  assert.equal(intelFeedUrlMatches(null, catalog), true);
  assert.equal(intelFeedUrlMatches("https://feeds.bbci.co.uk/sport/football/rss.xml", catalog), false);
});
