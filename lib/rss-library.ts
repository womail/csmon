import { INTEL_FEEDS, type IntelPack } from "./intel-feeds";
import type { OriginReason, Platform } from "./types";

const PACK_LABEL: Record<IntelPack, string> = {
  core: "World",
  relief: "Relief",
  security: "Security",
  politics: "Politics",
  hazard: "Hazard",
  tech: "Tech",
  markets: "Markets",
  sports: "Sports",
};

const packByHandle = new Map(INTEL_FEEDS.map((feed) => [feed.id, feed.pack]));

/** Category label for the Feeds desk. Kept beside the catalog so the reader pane stays portable. */
export function rssFeedCategory(source: {
  handle: string | null;
  platform: Platform;
  origins: { reason: OriginReason }[];
}) {
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
