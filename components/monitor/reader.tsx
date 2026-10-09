"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { ChevronLeft, ExternalLink, Languages, Printer, Rss, ScanSearch, X } from "lucide-react";
import { SendToReportButton } from "@/components/monitor/send-to-report";
import { Ago } from "@/components/monitor/ago";
import { placeMarkers } from "@/components/monitor/map";

const SituationMap = dynamic(
  () => import("@/components/monitor/situation-map").then((mod) => ({ default: mod.SituationMap })),
  { ssr: false, loading: () => null },
);
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import { tagStyle } from "@/lib/colors";
import { apiFetch } from "@/lib/api-client";
import type { Story } from "@/lib/cluster";
import { buildDeepDive } from "@/lib/dive";
import type { KevEntry } from "@/lib/kev";
import { languageName } from "@/lib/lang";
import { formatPublishDate, relTime } from "@/lib/time";
import { relatedDocuments } from "@/lib/documents";
import { itemTopicChips } from "@/lib/card-tags";
import { matchItemByUrl, matchSourceByHost } from "@/lib/link";
import { readerNvdCveKey, feedCvesForItem } from "@/lib/item-cves";
import { mineItem } from "@/lib/mine";
import { shortSourceName } from "@/lib/source-label";
import { personName } from "@/lib/people";
import { ArticleBody } from "@/components/monitor/article-body";
import { ExternalLinkRow } from "@/components/monitor/external-link-row";
import { VulnResponsePanel } from "@/components/monitor/vuln-response-panel";
import { NvdPanel } from "@/components/monitor/nvd-panel";
import {
  articleDisplayBlocks,
  blocksPlainText,
  cleanArticleParagraphs,
} from "@/lib/article-body";
import { isNoiseCopy, type ArticleRead } from "@/lib/article";
import { isVendorAdvisoryLink } from "@/lib/page-links";
import type { ReportVulnPlanSnapshot } from "@/lib/report-vuln-plan";
import type { NvdCveBrief } from "@/lib/nvd";
import type { Report } from "@/lib/reports";
import {
  ReaderContextStrip,
  type ReaderContextChip,
} from "@/components/monitor/reader-context-strip";
import { HypothesisReaderStrip } from "@/components/monitor/hypothesis-reader-strip";
import type { BuiltinDesk, Item, Source } from "@/lib/types";

export function ReaderPane({
  story,
  sources,
  related = [],
  similar = [],
  kevHits = [],
  boardItems = [],
  homeLanguage,
  autoTranslate,
  canBack,
  onBack,
  onClose,
  onFollow,
  onTopic,
  onPlace,
  onVendor,
  onCve,
  onSource,
  onOpenStory,
  onOpenItem,
  onPerson,
  reports = [],
  onReportsChange,
  onOpenReport,
  stack = "",
  onDesk,
  onReclassifyItem,
  onCopyCardLink,
  vulnResponse = true,
  boardContext,
  hypothesisContext,
}: {
  story: Story;
  sources: Map<number, Source>;
  related: { story: Story; why: string }[];
  similar: { story: Story; why: string }[];
  kevHits: KevEntry[];
  boardItems: Item[];
  homeLanguage: string;
  autoTranslate: boolean;
  canBack: boolean;
  onBack: () => void;
  onClose: () => void;
  onFollow: (url: string) => void;
  onTopic: (topic: string) => void;
  onPlace: (place: string) => void;
  onVendor: (vendor: string) => void;
  onCve: (cve: string) => void;
  onSource: (sourceId: number) => void;
  onOpenStory: (story: Story) => void;
  onOpenItem: (item: Item) => void;
  onPerson?: (name: string) => void;
  reports?: Report[];
  onReportsChange?: (rows: Report[]) => void;
  onOpenReport?: (id: string) => void;
  stack?: string;
  onDesk?: (desk: BuiltinDesk) => void;
  onReclassifyItem?: (item: Item, event: ReactMouseEvent) => void;
  onCopyCardLink?: (item: Item) => void;
  vulnResponse?: boolean;
  boardContext?: {
    deskLabel: string;
    range: string;
    chips: ReaderContextChip[];
    onClearFilters?: () => void;
  };
  hypothesisContext?: {
    filterId: string;
    filterName: string;
    hypotheses: string[];
  };
}) {
  const [activeId, setActiveId] = useState(story.items[0].id);
  const [article, setArticle] = useState<ArticleRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDive, setShowDive] = useState(false);
  const [translated, setTranslated] = useState<string[] | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [nvdEntries, setNvdEntries] = useState<NvdCveBrief[]>([]);
  const [nvdLoading, setNvdLoading] = useState(false);
  const [vulnPlanSnapshot, setVulnPlanSnapshot] = useState<ReportVulnPlanSnapshot | null>(null);
  useEffect(() => {
    setVulnPlanSnapshot(null);
  }, [story.id]);
  const active = story.items.find((item) => item.id === activeId) ?? story.items[0];
  const activeSource = sources.get(active.sourceId);
  const activeSignals = useMemo(() => mineItem(active), [active.id, active.title, active.summary, active.topics, active.tags]);

  const published = useMemo(() => {
    const feed = active.publishedAt;
    const page = article?.publishedAt ?? null;
    const ms = page ?? feed ?? null;
    if (!ms) {
      return { ms: null as number | null, source: null as null, label: null, ago: "" };
    }
    let source: "feed" | "page" | "both" | null = feed && page ? (feed === page ? "both" : "page") : page ? "page" : "feed";
    return {
      ms,
      source,
      label: formatPublishDate(ms),
      ago: relTime(ms),
    };
  }, [active.id, active.publishedAt, article?.publishedAt]);

  const nvdCveKey = useMemo(
    () => readerNvdCveKey(active, article, kevHits),
    [active.id, active.title, active.summary, article?.cveIds?.join(","), kevHits.map((r) => r.cveId).join(",")],
  );

  const showVulnResponse = vulnResponse && nvdCveKey.length > 0;

  useEffect(() => {
    setActiveId(story.items[0].id);
    setTranslated(null);
    setShowDive(false);
    setNvdEntries([]);
    setNvdLoading(false);
  }, [story.id, story.items]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setArticle(null);
    setTranslated(null);
    apiFetch(`/api/read?url=${encodeURIComponent(active.url)}`)
      .then(async (res) => {
        const data = (await res.json()) as ArticleRead & { error?: string };
        if (!res.ok) throw new Error(data.error || "Read failed");
        if (!cancelled) setArticle(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Read failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active.url]);

  useEffect(() => {
    if (!nvdCveKey) {
      setNvdEntries([]);
      setNvdLoading(false);
      return;
    }
    let cancelled = false;
    setNvdLoading(true);
    apiFetch(`/api/nvd?cves=${encodeURIComponent(nvdCveKey)}`)
      .then(async (res) => {
        const data = (await res.json()) as { entries?: NvdCveBrief[]; error?: string };
        if (!res.ok) throw new Error(data.error || "NVD lookup failed");
        if (!cancelled) setNvdEntries(data.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) setNvdEntries([]);
      })
      .finally(() => {
        if (!cancelled) setNvdLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nvdCveKey]);

  const articleBlocks = useMemo(() => {
    if (!article?.paragraphs.length) return [];
    return articleDisplayBlocks(
      article.title || active.title,
      article.description,
      article.paragraphs,
      article.related,
    );
  }, [active.title, article]);

  const dossier = useMemo(() => {
    const fromArticle = articleBlocks.length
      ? blocksPlainText(articleBlocks)
      : cleanArticleParagraphs(
          article?.title ?? active.title,
          article?.description ?? null,
          article?.paragraphs ?? [],
        );
    if (fromArticle.length) return { blocks: fromArticle };
    const blocks: string[] = [];
    const seen = new Set<string>();
    function add(text: string | null | undefined) {
      const value = (text ?? "").replace(/\s+/g, " ").trim();
      if (value.length < 40) return;
      if (isNoiseCopy(value)) return;
      const key = value.slice(0, 72).toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      blocks.push(value);
    }
    for (const item of story.items) add(item.summary);
    add(active.title);
    return { blocks };
  }, [active.title, article, articleBlocks, story.items]);

  const dive = useMemo(() => buildDeepDive(story, article), [article, story]);
  const articleLang = dive.language.id;
  const needsTranslate = articleLang && homeLanguage && articleLang !== homeLanguage;

  useEffect(() => {
    if (!autoTranslate || !needsTranslate || !dossier.blocks.length || translated) return;
    void runTranslate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTranslate, needsTranslate, dossier.blocks.length, homeLanguage, active.url]);

  async function runTranslate() {
    setTranslating(true);
    setTranslateError(null);
    try {
      const res = await apiFetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: [story.title, ...dossier.blocks.slice(0, 8)],
          from: articleLang,
          to: homeLanguage,
        }),
      });
      const data = (await res.json()) as { texts?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Translate failed");
      setTranslated(data.texts ?? []);
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : "Translate failed");
    } finally {
      setTranslating(false);
    }
  }

  const pageLinks = (article?.related ?? []).map((link) => ({
    ...link,
    item: matchItemByUrl(link.href, boardItems),
    source: matchSourceByHost(link.href, [...sources.values()]),
  }));

  const mapMarkers = placeMarkers(
    [
      ...story.locations.map((name) => ({ name, hint: "Story place" })),
      ...dive.places
        .filter((name) => !story.locations.includes(name))
        .map((name) => ({ name, hint: "Mentioned in copy" })),
    ],
    "place",
  );

  const shownBlocks = translated && translated.length > 1 ? translated.slice(1) : dossier.blocks;
  const shownTitle = translated?.[0] ?? story.title;

  function printReaderPdf() {
    const root = document.documentElement;
    root.classList.add("print-reader");
    const done = () => {
      root.classList.remove("print-reader");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.setTimeout(() => window.print(), 50);
  }

  return (
    <aside
      id="reader-print-sheet"
      className="reader-sheet flex h-full min-h-[70vh] flex-col border-l border-slate-200 bg-white"
    >
      <div className="no-print flex items-start gap-1 border-b border-slate-100 px-3 py-2">
        {canBack ? (
          <Tip text="Previous story">
            <button
              type="button"
              onClick={onBack}
              className="mt-0.5 rounded p-1 text-slate-400 hover:bg-slate-50"
              aria-label="Previous story"
            >
              <ChevronLeft className="size-4" />
            </button>
          </Tip>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Read in place
            {story.sourceIds.length > 1
              ? ` · ${story.sourceIds.length} desks corroborate`
              : " · single desk"}
            {articleLang ? ` · ${languageName(articleLang)}` : ""}
          </div>
          <div className="text-[14px] leading-snug font-semibold text-slate-900">{shownTitle}</div>
          {published.label ? (
            <p className="reader-published mt-1.5 text-[13px] font-semibold leading-snug text-slate-800">
              <span className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Published</span>
              <time dateTime={published.ms ? new Date(published.ms).toISOString() : undefined} className="ml-1.5">
                {published.label}
              </time>
              {published.ago ? (
                <span className="ml-1.5 text-[12px] font-normal text-slate-500">({published.ago} ago)</span>
              ) : null}
              {published.source === "page" ? (
                <span className="ml-1.5 text-[10px] font-medium text-slate-400">· from page</span>
              ) : published.source === "both" ? (
                <span className="ml-1.5 text-[10px] font-medium text-slate-400">· feed & page</span>
              ) : null}
            </p>
          ) : (
            <p className="mt-1.5 text-[12px] font-medium text-amber-800">
              Publication date unknown
              {loading ? " · checking page…" : ""}
            </p>
          )}
        </div>
        {onReportsChange ? (
          <SendToReportButton
            story={story}
            sources={sources}
            reports={reports}
            article={article}
            vulnPlanSnapshot={vulnPlanSnapshot}
            onChange={onReportsChange}
            onOpenReport={onOpenReport}
          />
        ) : null}
        <Tip text="Close reader">
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-50">
            <X className="size-4" />
          </button>
        </Tip>
      </div>

      {boardContext ? (
        <ReaderContextStrip
          deskLabel={boardContext.deskLabel}
          range={boardContext.range}
          chips={boardContext.chips}
          onClearFilters={boardContext.onClearFilters}
        />
      ) : null}

      {hypothesisContext ? (
        <HypothesisReaderStrip
          filterId={hypothesisContext.filterId}
          filterName={hypothesisContext.filterName}
          hypotheses={hypothesisContext.hypotheses}
          storyId={story.id}
        />
      ) : null}

      <div className="flex flex-wrap gap-1 border-b border-slate-50 px-3 py-2">
        {itemTopicChips(active).map((topic) => {
          const style = tagStyle(topic);
          return (
            <Tip key={topic} text={`Filter board to ${topic} · right-click coverage below to reclassify`}>
              <button
                type="button"
                className="tag"
                style={{ background: style.bg, color: style.fg }}
                onClick={() => onTopic(topic)}
              >
                {topic}
              </button>
            </Tip>
          );
        })}
        {story.locations.map((place) => (
          <Tip key={place} text={`Filter board to ${place}`}>
            <button
              type="button"
              className="tag"
              style={{ background: "#ecfeff", color: "#0e7490" }}
              onClick={() => onPlace(place)}
            >
              {place}
            </button>
          </Tip>
        ))}
        {activeSignals.vendors.map((name) => (
          <Tip key={name} text={`Filter to vendor ${name}`}>
            <button
              type="button"
              className="tag"
              style={{ background: "#fee2e2", color: "#9f1239" }}
              onClick={() => onVendor(name)}
            >
              {name}
            </button>
          </Tip>
        ))}
        {feedCvesForItem(active).map((cve) => (
          <Tip key={cve} text={`Filter board to ${cve}`}>
            <button
              type="button"
              className="tag font-mono"
              style={{ background: "#f1f5f9", color: "#0f172a" }}
              onClick={() => onCve(cve)}
            >
              {cve}
            </button>
          </Tip>
        ))}
        {activeSignals.ransomware ? (
          <span className="tag" style={{ background: "#fee2e2", color: "#9f1239" }}>
            ransomware
          </span>
        ) : null}
        {story.items.map((item) => {
          const name = personName(item, sources.get(item.sourceId));
          return name && onPerson ? (
            <Tip key={`${item.id}-${name}`} text={`Filter the board to ${name}`}>
              <button
                type="button"
                className="tag"
                style={{ background: "#ede9fe", color: "#5b21b6" }}
                onClick={() => onPerson(name)}
              >
                {name}
              </button>
            </Tip>
          ) : null;
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <SituationMap
          title="Where this relates"
          markers={mapMarkers}
          onSelect={onPlace}
          empty="No mapped place on this story."
          resizeKey="csmon.map-height.reader"
        />

        <div className="mt-4 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
          Coverage
        </div>
        <div className="mt-1.5 space-y-2">
          {story.items.map((item) => {
            const source = sources.get(item.sourceId);
            const selected = item.id === active.id;
            return (
              <div
                key={item.id || item.externalId}
                className={`rounded-md border px-2 py-1.5 ${
                  selected ? "border-slate-800 bg-slate-50" : "border-slate-100 hover:bg-slate-50"
                }`}
                onContextMenu={(event) => {
                  if (!onReclassifyItem) return;
                  event.preventDefault();
                  onReclassifyItem(item, event);
                }}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: source?.color ?? "#94a3b8" }}
                  />
                  <Tip text={source ? `Scan ${source.name}` : "Unknown source"}>
                    <button
                      type="button"
                      className="truncate font-medium text-slate-700 hover:underline"
                      onClick={() => {
                        if (source) onSource(source.id);
                      }}
                    >
                      {source ? shortSourceName(source.name) : "source"}
                    </button>
                  </Tip>
                  <Tip text={item.url}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-0.5 hover:text-slate-800"
                    >
                      <ExternalLink className="size-3" />
                      Original
                    </a>
                  </Tip>
                  {source?.url ? (
                    <Tip text={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 hover:text-slate-800 hover:underline"
                      >
                        Home
                      </a>
                    </Tip>
                  ) : null}
                  {source?.feedUrl ? (
                    <Tip text={source.feedUrl}>
                      <a
                        href={source.feedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-0.5 hover:text-slate-800"
                      >
                        <Rss className="size-3" />
                        RSS
                      </a>
                    </Tip>
                  ) : null}
                  {onCopyCardLink ? (
                    <Tip text="Copy link to this card">
                      <button
                        type="button"
                        className="shrink-0 text-[10px] text-slate-500 hover:text-slate-800"
                        onClick={(event) => {
                          event.stopPropagation();
                          onCopyCardLink(item);
                        }}
                      >
                        Link
                      </button>
                    </Tip>
                  ) : null}
                  <Ago ts={item.publishedAt} className="ml-auto" />
                </div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {itemTopicChips(item).map((chip) => {
                    const style = tagStyle(chip);
                    return (
                      <span
                        key={`${item.id}-${chip}`}
                        className="tag"
                        style={{ background: style.bg, color: style.fg }}
                      >
                        {chip}
                      </span>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className="mt-0.5 block w-full text-left"
                >
                  <p className="text-[12.5px] leading-snug font-medium text-slate-800">
                    {item.title}
                  </p>
                  {item.summary ? (
                    <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">{item.summary}</p>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Full copy · {languageName(articleLang)}
          </div>
          {needsTranslate ? (
            <Tip text={`Translate this article into ${languageName(homeLanguage)}`}>
              <button
                type="button"
                onClick={() => {
                  if (translated) setTranslated(null);
                  else void runTranslate();
                }}
                className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900"
              >
                <Languages className="size-3" />
                {translated
                  ? "Show original"
                  : translating
                    ? "Translating…"
                    : `Translate to ${languageName(homeLanguage)}`}
              </button>
            </Tip>
          ) : null}
        </div>
        {translateError ? <p className="mt-1 text-[11px] text-rose-600">{translateError}</p> : null}
        {loading ? <p className="mt-1 text-[12px] text-slate-400">Pulling the piece…</p> : null}
        {error ? (
          <p className="mt-1 text-[12px] text-slate-500">
            Page extract failed ({error}). Board copy above is the source of truth.
          </p>
        ) : null}
        {article?.title && article.title !== story.title && !translated ? (
          <h3 className="mt-2 text-[13px] font-semibold leading-snug text-slate-900">{article.title}</h3>
        ) : null}
        {translated && translated.length > 1 ? (
          translated.slice(1).map((block) => (
            <p key={block.slice(0, 64)} className="mt-2 text-[12.5px] leading-relaxed text-slate-700">
              {block}
            </p>
          ))
        ) : articleBlocks.length > 0 ? (
          <ArticleBody blocks={articleBlocks} onCve={onCve} />
        ) : (
          shownBlocks.map((block) => (
            <p key={block.slice(0, 64)} className="mt-2 text-[12.5px] leading-relaxed text-slate-700">
              {block}
            </p>
          ))
        )}
        {!articleBlocks.length && dossier.blocks.length === 0 && !loading ? (
          <p className="mt-2 text-[12px] text-slate-500">No extra copy on this item.</p>
        ) : null}

        <div className="mt-4">
          <Tip text="Extract places, dates, quotes, and a short briefing from this story">
            <button
              type="button"
              onClick={() => setShowDive((value) => !value)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900"
            >
              <ScanSearch className="size-3.5" />
              {showDive ? "Hide deep dive" : "Deep dive"}
            </button>
          </Tip>
          {showDive ? (
            <div className="mt-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-2">
              <p className="text-[11px] text-slate-500">
                {dive.wordCount} words · ~{dive.readingMinutes} min · {languageName(dive.language.id)}
              </p>
              {dive.bullets.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {dive.bullets.map((bullet) => (
                    <li key={bullet.slice(0, 48)} className="text-[12px] leading-relaxed text-slate-700">
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
              {dive.quotes.length > 0 ? (
                <div className="mt-2">
                  <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                    Quotes
                  </div>
                  {dive.quotes.map((quote) => (
                    <blockquote
                      key={quote.slice(0, 40)}
                      className="mt-1 border-l-2 border-slate-300 pl-2 text-[12px] text-slate-600"
                    >
                      {quote}
                    </blockquote>
                  ))}
                </div>
              ) : null}
              {dive.dates.length > 0 ? (
                <p className="mt-2 text-[11px] text-slate-500">Dates in copy: {dive.dates.join(" · ")}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {nvdCveKey ? (
          <>
            {nvdLoading && nvdEntries.length === 0 ? (
              <p className="mt-4 text-[11px] text-slate-500">Loading NVD patch data…</p>
            ) : null}
            <NvdPanel
              entries={nvdEntries}
              kevHits={kevHits}
              onCve={onCve}
              onVendor={onVendor}
              onFollow={onFollow}
            />
            {nvdLoading && nvdEntries.length > 0 ? (
              <p className="mt-1 text-[10px] text-slate-400">Updating NVD…</p>
            ) : null}
          </>
        ) : null}

        <VulnResponsePanel
          story={story}
          article={article}
          articleBlocks={articleBlocks}
          kevHits={kevHits}
          nvdEntries={nvdEntries}
          stack={stack}
          enabled={showVulnResponse}
          onPlanSnapshot={setVulnPlanSnapshot}
          onDesk={
            onDesk
              ? (desk) => {
                  const allowed: BuiltinDesk[] = [
                    "patch",
                    "advisories",
                    "weather",
                    "home",
                    "documents",
                    "brief",
                    "scan",
                  ];
                  if (allowed.includes(desk as BuiltinDesk)) onDesk(desk as BuiltinDesk);
                }
              : undefined
          }
        />

        {!nvdCveKey && kevHits.length > 0 ? (
          <div className="mt-4">
            <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
              KEV on this story
            </div>
            {kevHits.map((entry) => (
              <Tip key={entry.cveId} text={`Open ${entry.cveId}`}>
                <button
                  type="button"
                  onClick={() => onCve(entry.cveId)}
                  className="mt-1 block w-full rounded-md border border-rose-100 bg-rose-50 px-2 py-1.5 text-left"
                >
                  <span className="font-mono text-[11px] text-rose-800">{entry.cveId}</span>
                  <span className="block text-[12px] text-slate-800">
                    {entry.vendor} {entry.product}
                  </span>
                  <span className="block text-[11px] text-slate-500">{entry.name}</span>
                </button>
              </Tip>
            ))}
          </div>
        ) : null}

        {related.length > 0 ? (
          <div className="mt-4">
            <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
              Also on the board
            </div>
            <div className="mt-1 space-y-1">
              {related.map((row) => (
                <Tip key={row.story.id} text={`Open related: ${row.why}`}>
                  <button
                    type="button"
                    onClick={() => onOpenStory(row.story)}
                    className="block w-full rounded px-1 py-1 text-left hover:bg-slate-50"
                  >
                    <span className="text-[10px] text-slate-400">{row.why}</span>
                    <span className="block text-[12px] leading-snug text-slate-800">
                      {row.story.title}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {row.story.sourceIds.length} sources
                    </span>
                  </button>
                </Tip>
              ))}
            </div>
          </div>
        ) : null}

        {similar.length > 0 ? (
          <div className="mt-4">
            <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
              Similar articles
            </div>
            <div className="mt-1 space-y-1">
              {similar.map((row) => (
                <Tip key={row.story.id} text={`Similar because ${row.why}`}>
                  <button
                    type="button"
                    onClick={() => onOpenStory(row.story)}
                    className="block w-full rounded px-1 py-1 text-left hover:bg-slate-50"
                  >
                    <span className="text-[10px] text-slate-400">{row.why}</span>
                    <span className="block text-[12px] leading-snug text-slate-800">
                      {row.story.title}
                    </span>
                  </button>
                </Tip>
              ))}
            </div>
          </div>
        ) : null}

        {pageLinks.length > 0 ? (
          <div className="mt-4">
            <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
              From the page
            </div>
            <div className="mt-1 space-y-1.5">
              {pageLinks.map((link) => {
                const advisory = isVendorAdvisoryLink(link.href);
                return (
                  <ExternalLinkRow
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    variant={advisory ? "advisory" : "default"}
                    urlCaption={advisory ? link.href.replace(/^https?:\/\//, "") : undefined}
                    hint={
                      link.item
                        ? "Already on the board"
                        : link.source
                          ? `Known source: ${link.source.name}`
                          : advisory
                            ? "Vendor advisory — open in browser; not a feed to follow"
                            : link.href.replace(/^https?:\/\//, "")
                    }
                    onPrimaryClick={
                      advisory
                        ? undefined
                        : link.item
                          ? () => onOpenItem(link.item!)
                          : link.source
                            ? undefined
                            : () => onFollow(link.href)
                    }
                    primaryActionLabel={
                      advisory
                        ? undefined
                        : link.item
                          ? "Open on board"
                          : !link.source
                            ? "Follow this URL"
                            : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        ) : null}

        {relatedDocuments(pageLinks).length > 0 ? (
          <div className="mt-4">
            <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
              Documents
            </div>
            <div className="mt-1 space-y-1">
              {relatedDocuments(pageLinks).map((doc) => (
                <ExternalLinkRow key={doc.href} href={doc.href} label={doc.label} hint={doc.kind} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="no-print border-t border-slate-100 px-3 py-2">
        <div className="flex flex-wrap gap-1">
          <Tip text="Print this reader view (use Save as PDF in the print dialog)">
            <Button size="xs" variant="outline" onClick={printReaderPdf}>
              <Printer className="size-3" />
              Print to PDF
            </Button>
          </Tip>
          <Tip text={`Open the full page: ${active.url}`}>
            <Button size="xs" asChild>
              <a href={active.url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3" />
                View page
              </a>
            </Button>
          </Tip>
          <Tip text={active.url}>
            <Button size="xs" variant="outline" asChild>
              <a href={active.url} target="_blank" rel="noreferrer">
                Original
              </a>
            </Button>
          </Tip>
          {activeSource?.url ? (
            <Tip text={activeSource.url}>
              <Button size="xs" variant="outline" asChild>
                <a href={activeSource.url} target="_blank" rel="noreferrer">
                  Home
                </a>
              </Button>
            </Tip>
          ) : null}
          {activeSource?.feedUrl ? (
            <Tip text={activeSource.feedUrl}>
              <Button size="xs" variant="outline" asChild>
                <a href={activeSource.feedUrl} target="_blank" rel="noreferrer">
                  <Rss className="size-3" />
                  RSS
                </a>
              </Button>
            </Tip>
          ) : null}
          {activeSource ? (
            <Tip text={`Scan only ${activeSource.name}`}>
              <Button size="xs" variant="outline" onClick={() => onSource(activeSource.id)}>
                This source
              </Button>
            </Tip>
          ) : null}
          {article?.site ? (
            <Tip text={`Add ${article.site} as a layer`}>
              <Button size="xs" onClick={() => onFollow(`https://${article.site}`)}>
                <Rss className="size-3" />
                Follow {article.site}
              </Button>
            </Tip>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
