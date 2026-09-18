import { classifyText } from "../tags";
import { fetchJson } from "../http";
import type { DiscoveredSource, ScrapeResult, ScrapedItem } from "../types";

const APPVIEW = "https://public.api.bsky.app/xrpc";

type BskyProfile = {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
};

type BskyFeed = {
  feed: {
    post: {
      uri: string;
      author: BskyProfile;
      record: {
        text?: string;
        createdAt?: string;
        facets?: {
          features: { $type: string; did?: string; uri?: string; tag?: string }[];
        }[];
        embed?: { external?: { uri?: string; title?: string; description?: string } };
      };
      embed?: {
        $type?: string;
        external?: { uri?: string; title?: string; description?: string };
        record?: { uri?: string; author?: BskyProfile };
      };
    };
  }[];
};

type BskyFollows = {
  follows: BskyProfile[];
};

function postUrl(handle: string, uri: string) {
  const rkey = uri.split("/").pop();
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

function asItem(post: BskyFeed["feed"][number]["post"]): ScrapedItem {
  const text = post.record.text?.trim() ?? "";
  const externalTitle = post.embed?.external?.title || post.record.embed?.external?.title;
  const title = (externalTitle && text.length < 40 ? `${text} — ${externalTitle}` : text || externalTitle || "(no text)")
    .replace(/\s+/g, " ")
    .slice(0, 220);
  const summary = post.embed?.external?.description || post.record.embed?.external?.description || null;
  return {
    externalId: post.uri,
    title,
    summary,
    url: postUrl(post.author.handle, post.uri),
    author: post.author.displayName || post.author.handle,
    publishedAt: post.record.createdAt ? Date.parse(post.record.createdAt) : null,
    tags: classifyText(`${title} ${summary ?? ""} ${text}`),
  };
}

function accountSource(
  profile: BskyProfile,
  reason: DiscoveredSource["reason"],
  weight: number,
  sample?: string,
): DiscoveredSource {
  return {
    key: `bluesky:${profile.handle.toLowerCase()}`,
    name: profile.displayName || profile.handle,
    handle: profile.handle,
    url: `https://bsky.app/profile/${profile.handle}`,
    feedUrl: null,
    platform: "bluesky",
    kind: "account",
    description: profile.description ?? null,
    avatarUrl: profile.avatar ?? null,
    reason,
    weight,
    sample,
  };
}

export async function scrapeBskyUser(handle: string): Promise<ScrapeResult> {
  const profile = await fetchJson<BskyProfile>(
    `${APPVIEW}/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`,
  );

  const [feed, follows] = await Promise.all([
    fetchJson<BskyFeed>(
      `${APPVIEW}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(profile.handle)}&limit=50`,
    ).catch(() => ({ feed: [] }) as BskyFeed),
    fetchJson<BskyFollows>(
      `${APPVIEW}/app.bsky.graph.getFollows?actor=${encodeURIComponent(profile.handle)}&limit=40`,
    ).catch(() => ({ follows: [] }) as BskyFollows),
  ]);

  const items = feed.feed.map((row) => asItem(row.post));
  const mentionCounts = new Map<string, { profile: BskyProfile; count: number; sample: string }>();
  const linkCounts = new Map<string, { url: string; count: number; title?: string }>();

  for (const row of feed.feed) {
    const post = row.post;
    const sample = (post.record.text ?? "").slice(0, 140);
    const authors = [post.author, post.embed?.record?.author].filter(Boolean) as BskyProfile[];
    for (const author of authors) {
      if (author.handle === profile.handle) continue;
      const current = mentionCounts.get(author.did) ?? { profile: author, count: 0, sample };
      current.count += 1;
      mentionCounts.set(author.did, current);
    }
    for (const facet of post.record.facets ?? []) {
      for (const feature of facet.features) {
        if (feature.$type === "app.bsky.richtext.facet#link" && feature.uri) {
          try {
            const host = new URL(feature.uri).hostname.replace(/^www\./, "");
            const current = linkCounts.get(host) ?? { url: feature.uri, count: 0 };
            current.count += 1;
            linkCounts.set(host, current);
          } catch {
            /* ignore bad urls */
          }
        }
      }
    }
    const external = post.embed?.external || post.record.embed?.external;
    if (external?.uri) {
      try {
        const host = new URL(external.uri).hostname.replace(/^www\./, "");
        const current = linkCounts.get(host) ?? { url: external.uri, count: 0, title: external.title };
        current.count += 1;
        current.title = current.title || external.title;
        linkCounts.set(host, current);
      } catch {
        /* ignore */
      }
    }
  }

  const sources: DiscoveredSource[] = [accountSource(profile, "self", 100, items[0]?.title)];

  const seen = new Set(sources.map((s) => s.key));
  const mentions = [...mentionCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 18);
  for (const mention of mentions) {
    const source = accountSource(mention.profile, "mention", mention.count + 4, mention.sample);
    if (seen.has(source.key)) continue;
    seen.add(source.key);
    sources.push(source);
  }

  for (const follow of follows.follows.slice(0, 40)) {
    const source = accountSource(follow, "follow", 2);
    if (seen.has(source.key)) continue;
    seen.add(source.key);
    sources.push(source);
  }

  const links = [...linkCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);
  for (const [host, meta] of links) {
    const key = `web:${host}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({
      key,
      name: meta.title || host,
      handle: host,
      url: `https://${host}`,
      feedUrl: null,
      platform: "web",
      kind: "site",
      description: `Linked ${meta.count}× by @${profile.handle}`,
      avatarUrl: null,
      reason: "link",
      weight: meta.count + 1,
    });
  }

  return {
    user: {
      handle: profile.handle,
      platform: "bluesky",
      did: profile.did,
      displayName: profile.displayName ?? null,
      avatarUrl: profile.avatar ?? null,
      description: profile.description ?? null,
      profileUrl: `https://bsky.app/profile/${profile.handle}`,
    },
    sources,
    items,
  };
}

export async function fetchBskySource(handle: string): Promise<ScrapedItem[]> {
  const feed = await fetchJson<BskyFeed>(
    `${APPVIEW}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=40`,
  );
  return feed.feed.map((row) => asItem(row.post));
}
