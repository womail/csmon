import { INTEL_FEEDS } from "./intel-feeds";
import { PACK_LABEL } from "./source-types";
import type { OriginReason, Platform } from "./types";

const packByHandle = new Map(INTEL_FEEDS.map((feed) => [feed.id, feed.pack]));

/** Category label for the Feeds desk. A stored category (OPML folder, workbench edit) comes first. */
export function rssFeedCategory(source: {
  handle: string | null;
  platform: Platform;
  origins: { reason: OriginReason }[];
  category?: string | null;
}) {
  if (source.category?.trim()) return source.category.trim();
  if (source.platform === "bluesky") return "Bluesky";
  const pack = source.handle ? packByHandle.get(source.handle) : undefined;
  if (pack) return PACK_LABEL[pack];
  const reason = source.origins[0]?.reason;
  if (reason === "reddit") return "Reddit";
  if (reason === "gdelt") return "GDELT";
  if (reason === "acled") return "Conflict data";
  if (reason === "explore" || reason === "follow" || reason === "self") return "Added by you";
  return "Other";
}
