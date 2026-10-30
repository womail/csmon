import { INTEL_FEEDS, type IntelPack } from "./intel-feeds";
import type { TopicHint } from "./topic-rules";
import type { Source } from "./types";

export type SourceType =
  | "wire"
  | "outlet"
  | "government"
  | "cert"
  | "vendor"
  | "research"
  | "think_tank"
  | "hazard_official"
  | "blog"
  | "social"
  | "aggregator";

export const SOURCE_TYPES: SourceType[] = [
  "cert",
  "government",
  "hazard_official",
  "vendor",
  "research",
  "think_tank",
  "wire",
  "outlet",
  "blog",
  "social",
  "aggregator",
];

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  wire: "Wire",
  outlet: "Outlet",
  government: "Government",
  cert: "CERT",
  vendor: "Vendor",
  research: "Research",
  think_tank: "Think tank",
  hazard_official: "Official hazard",
  blog: "Blog",
  social: "Social",
  aggregator: "Aggregator",
};

export const SOURCE_TYPE_MARK: Record<SourceType, string> = {
  wire: "W",
  outlet: "N",
  government: "G",
  cert: "C",
  vendor: "V",
  research: "R",
  think_tank: "T",
  hazard_official: "H",
  blog: "B",
  social: "S",
  aggregator: "A",
};

export const OFFICIAL_TYPES: ReadonlySet<SourceType> = new Set(["government", "cert", "hazard_official"]);

export function isSourceType(value: unknown): value is SourceType {
  return typeof value === "string" && (SOURCE_TYPES as string[]).includes(value);
}

export const PACK_LABEL: Record<IntelPack, string> = {
  core: "World",
  relief: "Relief",
  security: "Security",
  politics: "Politics",
  hazard: "Hazards",
  tech: "Tech",
  markets: "Markets",
  sports: "Sports",
};

/** Explicit types for shipped intel layers whose host alone does not say what they are. */
const INTEL_TYPES: Record<string, SourceType> = {
  cisa: "cert",
  "cisa-ics": "cert",
  ncsc: "cert",
  "csirts-kev": "cert",
  cccs: "cert",
  "cert-eu": "cert",
  msrc: "vendor",
  krebs: "blog",
  schneier: "blog",
  bleeping: "outlet",
  therecord: "outlet",
  "hacker-news": "outlet",
  darkreading: "outlet",
  bellingcat: "research",
  cfr: "think_tank",
  csis: "think_tank",
  brookings: "think_tank",
  warontherocks: "think_tank",
  crisisgroup: "think_tank",
  "foreign-affairs": "think_tank",
  defenseone: "outlet",
  breakingdefense: "outlet",
  warzone: "outlet",
  diplomat: "outlet",
  almonitor: "outlet",
  dod: "government",
  whitehouse: "government",
  fed: "government",
  sec: "government",
  "un-news": "government",
  who: "government",
  ocha: "government",
  reliefweb: "hazard_official",
  "reuters-world": "wire",
  "arxiv-ai": "research",
  openai: "vendor",
  hn: "aggregator",
};

const intelById = new Map(INTEL_FEEDS.map((feed) => [feed.id, feed]));

function hostOf(url: string | null | undefined) {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

const HAZARD_HOST_RE =
  /(?:^|\.)(?:usgs\.gov|weather\.gov|noaa\.gov|met\.ie|metoffice\.gov\.uk|gdacs\.org|meteoalarm\.org|reliefweb\.int|emsc-csem\.org)$/;
const WIRE_HOST_RE = /(?:^|\.)(?:reuters\.com|apnews\.com|afp\.com|reut\.rs|dpa\.com|efe\.com|ansa\.it)$/;
const GOV_HOST_RE = /(?:\.gov|\.gov\.uk|\.gov\.ie|\.gc\.ca|\.gouv\.fr|\.bund\.de|\.europa\.eu|\.mil|\.int)$/;
const CERT_NAME_RE = /\bcert\b|\bcsirt\b|\bncsc\b|\bcisa\b|\bcccs\b|\bjpcert\b|\banssi\b|\bbsi\b/i;

/** OPML folder or category text → type. */
export function typeFromCategory(category: string | null | undefined): SourceType | null {
  if (!category) return null;
  if (/cert|government|advisor|agency|national/i.test(category)) return "cert";
  if (/vendor|product|psirt|operating system|firewall|endpoint|edr|siem|privileged|email security|devops|cloud/i.test(category)) {
    return "vendor";
  }
  if (/research|intel|lab|threat|vulnerability management/i.test(category)) return "research";
  if (/news|media/i.test(category)) return "outlet";
  if (/think.?tank|policy/i.test(category)) return "think_tank";
  if (/blog/i.test(category)) return "blog";
  return null;
}

export function deriveSourceType(
  source: Pick<Source, "platform" | "handle" | "feedUrl" | "url" | "name"> & {
    origins?: Source["origins"];
    category?: string | null;
  },
): SourceType {
  const handle = source.handle ?? "";
  const explicit = INTEL_TYPES[handle];
  if (explicit) return explicit;
  if (source.platform === "bluesky") return "social";
  const feed = source.feedUrl ?? "";
  if (/reddit/i.test(feed) || /reddit/i.test(handle)) return "social";
  if (/gdelt|news\.google\.com/i.test(feed) || source.origins?.some((o) => o.reason === "gdelt")) return "aggregator";
  if (/acled/i.test(feed)) return "research";
  const fromCategory = typeFromCategory(source.category);
  if (fromCategory) return fromCategory;
  const host = hostOf(feed) || hostOf(source.url);
  if (HAZARD_HOST_RE.test(host)) return "hazard_official";
  if (WIRE_HOST_RE.test(host)) return "wire";
  if (CERT_NAME_RE.test(source.name) || /^cert\.|\.cert\./.test(host)) return "cert";
  if (GOV_HOST_RE.test(host)) return "government";
  const intel = intelById.get(handle);
  if (intel?.pack === "hazard") return "hazard_official";
  if (intel?.pack === "tech" && /arxiv/.test(host)) return "research";
  return "outlet";
}

export function sourceTypeOf(source: Source): SourceType {
  return isSourceType(source.sourceType) ? source.sourceType : deriveSourceType(source);
}

/** Folder for the Feeds desk and the category filter. */
export function sourceCategory(source: Pick<Source, "platform" | "handle" | "feedUrl" | "origins"> & { category?: string | null }): string {
  if (source.category?.trim()) return source.category.trim();
  if (source.platform === "bluesky") return "Bluesky";
  const intel = source.handle ? intelById.get(source.handle) : undefined;
  if (intel) return PACK_LABEL[intel.pack];
  const feed = source.feedUrl ?? "";
  if (/reddit/i.test(feed)) return "Reddit";
  if (/gdelt/i.test(feed)) return "GDELT";
  if (/acled/i.test(feed)) return "ACLED";
  if (source.origins?.some((o) => o.reason === "self")) return "Added by you";
  return "Other";
}

export function topicHintForSource(
  source: (Pick<Source, "handle" | "feedUrl"> & Partial<Pick<Source, "platform" | "url" | "name" | "origins">> & {
    category?: string | null;
    sourceType?: string | null;
  }) | null
    | undefined,
): TopicHint | null {
  if (!source) return null;
  const sourceType =
    source.sourceType ??
    (source.platform && source.url !== undefined && source.name !== undefined
      ? deriveSourceType(source as Parameters<typeof deriveSourceType>[0])
      : null);
  return {
    handle: source.handle,
    feedUrl: source.feedUrl,
    category: source.category ?? null,
    sourceType,
  };
}
