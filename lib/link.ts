import { clusterTokens, type Story } from "./cluster";
import type { KevEntry } from "./kev";
import { mineItem, mineText, type MinedSignals } from "./mine";
import type { Item, Source } from "./types";

export function canonUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = parsed.search.replace(/utm_[^=]+=[^&]+&?/g, "");
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function storySignals(story: Story): MinedSignals {
  return mineText(
    story.items.map((item) => `${item.title} ${item.summary ?? ""}`).join(" "),
  );
}

export function relatedStories(story: Story, pool: Story[]) {
  const self = new Set(story.items.map((item) => item.id));
  const cves = new Set(storySignals(story).cves);
  const vendors = new Set(storySignals(story).vendors);
  const toks = clusterTokens(story.title);
  const topics = new Set(story.topics.filter((topic) => topic !== "world"));
  const places = new Set(story.locations);

  return pool
    .filter((other) => other.id !== story.id && !other.items.every((item) => self.has(item.id)))
    .map((other) => {
      const otherSignals = storySignals(other);
      const reasons: string[] = [];
      let score = 0;
      const sharedCve = otherSignals.cves.find((cve) => cves.has(cve));
      if (sharedCve) {
        score += 6;
        reasons.push(sharedCve);
      }
      const sharedVendor = otherSignals.vendors.find((vendor) => vendors.has(vendor));
      if (sharedVendor) {
        score += 2;
        reasons.push(sharedVendor);
      }
      const sharedTopic = other.topics.find((topic) => topics.has(topic));
      const sharedPlace = other.locations.find((place) => places.has(place));
      if (sharedTopic && sharedPlace) {
        score += 2;
        reasons.push(`${sharedPlace} · ${sharedTopic}`);
      }
      let inter = 0;
      const otherToks = clusterTokens(other.title);
      for (const token of toks) if (otherToks.has(token)) inter += 1;
      const union = toks.size + otherToks.size - inter;
      const jac = union ? inter / union : 0;
      if (jac >= 0.18 && inter >= 2) {
        score += jac * 5;
        reasons.push("similar copy");
      }
      if (hostOf(other.url) && hostOf(other.url) === hostOf(story.url) && jac >= 0.12) {
        score += 1;
        reasons.push(hostOf(other.url));
      }
      return { story: other, score, why: reasons[0] ?? "linked" };
    })
    .filter((row) => row.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export function itemsForCve(items: Item[], cve: string) {
  const needle = cve.toUpperCase();
  return items.filter((item) => mineItem(item).cves.includes(needle));
}

export function kevForStory(story: Story, catalog: KevEntry[]) {
  const cves = new Set(storySignals(story).cves);
  if (cves.size === 0) return [];
  return catalog.filter((entry) => cves.has(entry.cveId));
}

export function matchItemByUrl(url: string, items: Item[]) {
  const canon = canonUrl(url);
  return items.find((item) => canonUrl(item.url) === canon) ?? null;
}

export function matchSourceByHost(url: string, sources: Source[]) {
  const host = hostOf(url);
  if (!host) return null;
  return (
    sources.find((source) => hostOf(source.url) === host || hostOf(source.feedUrl ?? "") === host) ??
    null
  );
}
