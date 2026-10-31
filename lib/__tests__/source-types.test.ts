import assert from "node:assert/strict";
import { test } from "node:test";
import { opmlFolderType, parseOpml } from "../opml";
import { deriveSourceType, sourceCategory } from "../source-types";
import type { Source } from "../types";

function source(partial: Partial<Source>): Source {
  return {
    id: 1,
    key: "k",
    name: "Layer",
    handle: null,
    url: "https://example.com",
    feedUrl: "https://example.com/feed",
    platform: "rss",
    kind: "feed",
    description: null,
    avatarUrl: null,
    color: "#000",
    enabled: true,
    lastFetchedAt: null,
    createdAt: 0,
    retentionDays: null,
    origins: [],
    ...partial,
  };
}

test("intel layers get explicit types", () => {
  assert.equal(deriveSourceType(source({ handle: "cisa" })), "cert");
  assert.equal(deriveSourceType(source({ handle: "msrc" })), "vendor");
  assert.equal(deriveSourceType(source({ handle: "krebs" })), "blog");
  assert.equal(deriveSourceType(source({ handle: "cfr" })), "think_tank");
});

test("hosts and platforms derive a type", () => {
  assert.equal(deriveSourceType(source({ platform: "bluesky" })), "social");
  assert.equal(deriveSourceType(source({ feedUrl: "https://www.reddit.com/r/news/.rss" })), "social");
  assert.equal(deriveSourceType(source({ feedUrl: "https://earthquake.usgs.gov/feed.atom" })), "hazard_official");
  assert.equal(deriveSourceType(source({ feedUrl: "https://www.cisa.gov/x.xml", name: "Some agency" })), "government");
  assert.equal(deriveSourceType(source({ feedUrl: "https://cert.example.gov/x.xml", name: "National CERT" })), "cert");
  assert.equal(deriveSourceType(source({ feedUrl: "https://feeds.reuters.com/x" })), "wire");
  assert.equal(
    deriveSourceType(
      source({
        handle: "reuters-world",
        feedUrl:
          "https://news.google.com/rss/search?q=when:24h+site:reuters.com/world&ceid=US:en&hl=en-US&gl=US",
      }),
    ),
    "wire",
  );
  assert.equal(deriveSourceType(source({})), "outlet");
});

test("stored category wins over the pack label", () => {
  assert.equal(sourceCategory(source({ handle: "cisa" })), "Security");
  assert.equal(sourceCategory(source({ handle: "cisa", category: "CERTs & Government Advisories" })), "CERTs & Government Advisories");
});

test("OPML folders become category and type", () => {
  const parsed = parseOpml(`<?xml version="1.0"?><opml><body>
    <outline text="CERTs &amp; Government Advisories">
      <outline type="rss" text="CERT-X" xmlUrl="https://cert.example.org/feed.xml" />
    </outline>
    <outline text="Endpoint &amp; EDR Vendors">
      <outline type="rss" text="Vendor blog" xmlUrl="https://vendor.example.com/rss" />
    </outline>
  </body></opml>`);
  assert.equal(parsed.layers[0].category, "CERTs & Government Advisories");
  assert.equal(parsed.layers[0].sourceType, "cert");
  assert.equal(parsed.layers[1].sourceType, "vendor");
  assert.equal(opmlFolderType("Security News"), "outlet");
  assert.equal(opmlFolderType("Odds and ends"), "blog");
});
