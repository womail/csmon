import { classify } from "./classify";
import type { Story } from "./cluster";
import type { ArticleRead } from "./article";
import type { KevEntry } from "./kev";
import { matchesStack } from "./kev";
import { mineText } from "./mine";
import type { CweBrief } from "./cwe";
import type { NvdCveBrief } from "./nvd";
import { blocksPlainText } from "./article-body";
import type { ArticleBlock } from "./article-body";

const MAX_EXCERPT = 2200;

function trimExcerpt(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= MAX_EXCERPT ? t : `${t.slice(0, MAX_EXCERPT)}…`;
}

export type LayaStoryState = {
  title: string;
  summary: string;
  excerpt: string;
  source_count: number;
  topics: string[];
  locations: string[];
  cves: string[];
  vendors: string[];
  ransomware: boolean;
  kev: {
    hit: boolean;
    max_risk: string | null;
    stack_match: boolean;
    overdue: boolean;
    cisa_action: string | null;
  };
  nvd: {
    loaded: number;
    patch_available: boolean;
    mitigate_available: boolean;
    top_action: string | null;
  };
  classify_tags: string[];
  language: string | null;
  cwe: {
    ids: string[];
    entries: {
      id: string;
      name: string;
      likelihood: string | null;
      mitigation_hints: string[];
      consequence_hints: string[];
    }[];
  };
};

export function buildLayaState(input: {
  story: Story;
  article?: ArticleRead | null;
  articleBlocks?: ArticleBlock[];
  kevHits?: KevEntry[];
  nvdEntries?: NvdCveBrief[];
  cweEntries?: CweBrief[];
  stack?: string;
}): LayaStoryState {
  const {
    story,
    article,
    articleBlocks = [],
    kevHits = [],
    nvdEntries = [],
    cweEntries = [],
    stack = "",
  } = input;
  const blockText = articleBlocks.length ? blocksPlainText(articleBlocks).join("\n") : "";
  const copy = trimExcerpt(
    [
      story.title,
      story.summary ?? "",
      ...story.items.map((i) => `${i.title} ${i.summary ?? ""}`),
      article?.title ?? "",
      article?.description ?? "",
      blockText,
      ...(article?.paragraphs ?? []).slice(0, 8),
    ].join("\n"),
  );
  const mined = mineText(copy);
  const classified = classify(copy);
  const kevForStack = kevHits.filter((e) => matchesStack(e, stack));
  const kevPool = kevForStack.length ? kevForStack : kevHits;
  const riskOrder = { p0: 3, p1: 2, p2: 1 } as const;
  let maxRisk: KevEntry["risk"] | null = null;
  for (const row of kevPool) {
    if (!maxRisk || riskOrder[row.risk] > riskOrder[maxRisk]) maxRisk = row.risk;
  }
  const nvdPatch = nvdEntries.some((e) => e.actionKind === "patch" || e.patches.length > 0);
  const nvdMit = nvdEntries.some((e) => e.actionKind === "mitigate" || e.mitigations.length > 0);
  const topAction = nvdEntries.find((e) => e.actionKind !== "monitor")?.actionKind ?? null;

  return {
    title: story.title.trim().slice(0, 240),
    summary: (story.summary ?? "").trim().slice(0, 400),
    excerpt: copy,
    source_count: story.sourceIds.length,
    topics: story.topics.slice(0, 8),
    locations: story.locations.slice(0, 8),
    cves: mined.cves.slice(0, 12),
    vendors: mined.vendors.slice(0, 8),
    ransomware: mined.ransomware || kevHits.some((k) => k.ransomware),
    kev: {
      hit: kevHits.length > 0,
      max_risk: maxRisk,
      stack_match: kevForStack.length > 0,
      overdue: kevPool.some((k) => k.overdue),
      cisa_action: kevPool.find((k) => k.requiredAction)?.requiredAction?.slice(0, 280) ?? null,
    },
    nvd: {
      loaded: nvdEntries.length,
      patch_available: nvdPatch,
      mitigate_available: nvdMit,
      top_action: topAction,
    },
    classify_tags: classified.tags.slice(0, 10),
    language: article?.language ?? null,
    cwe: {
      ids: cweEntries.map((e) => e.cweId),
      entries: cweEntries.slice(0, 4).map((e) => ({
        id: e.cweId,
        name: e.name.slice(0, 120),
        likelihood: e.likelihood,
        mitigation_hints: e.mitigations.slice(0, 3).map((m) => {
          const phase = m.phases.length ? `[${m.phases.join(", ")}] ` : "";
          const strat = m.strategy ? `${m.strategy}: ` : "";
          return `${phase}${strat}${m.description}`.slice(0, 220);
        }),
        consequence_hints: e.consequences.slice(0, 2),
      })),
    },
  };
}
