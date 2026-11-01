import assert from "node:assert/strict";
import { test } from "node:test";
import { applySavedDraft, type LocalSourceDraft } from "../source-library";

function draft(partial: Partial<LocalSourceDraft>): LocalSourceDraft {
  return {
    id: 12,
    key: "rss:https://feeds.bbci.co.uk/sport/rss.xml",
    name: "BBC Sport",
    url: "https://www.bbc.com/sport",
    feedUrl: "https://feeds.bbci.co.uk/sport/rss.xml",
    description: "UK and world sport",
    enabled: true,
    intelId: "bbc-sport",
    pack: "sports",
    notes: "",
    primaryReason: "intel",
    retentionDays: null,
    ...partial,
  };
}

test("saved drafts keep notes but do not overlay another layer's URL", () => {
  const catalog = draft({ id: 12, name: "BBC Sport" });
  const stale = draft({
    id: 12,
    name: "BBC World",
    url: "https://www.bbc.com/news/world",
    feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml",
    intelId: "bbc-world",
    pack: "core",
    notes: "keep this",
  });
  const merged = applySavedDraft(catalog, stale);
  assert.equal(merged.name, "BBC Sport");
  assert.equal(merged.feedUrl, "https://feeds.bbci.co.uk/sport/rss.xml");
  assert.equal(merged.url, "https://www.bbc.com/sport");
  assert.equal(merged.notes, "keep this");
  assert.equal(merged.intelId, "bbc-world");
});
