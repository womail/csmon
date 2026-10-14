"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Pencil,
  Printer,
  Trash2,
} from "lucide-react";
import { Ago } from "@/components/monitor/ago";
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArticleBody } from "@/components/monitor/article-body";
import { ExternalLinkRow } from "@/components/monitor/external-link-row";
import { NvdPanel } from "@/components/monitor/nvd-panel";
import { apiFetch } from "@/lib/api-client";
import { isVendorAdvisoryLink } from "@/lib/page-links";
import type { ReportVulnPlanSnapshot } from "@/lib/report-vuln-plan";
import type { NvdCveBrief } from "@/lib/nvd";
import { extractUrlsForReportStory, fetchArticleReads } from "@/lib/report-extract";
import { ReportTimeline } from "@/components/monitor/report-timeline";
import {
  REPORT_CONFIDENCE_OPTIONS,
  reportConfidenceLabel,
  type ReportConfidence,
} from "@/lib/report-confidence";
import {
  applyArticlesToReportStory,
  archivedReports,
  deleteReport,
  moveStoryInReport,
  openReports,
  removeStoryFromReport,
  renameReport,
  replaceStoryInReport,
  reportStoryDisplayBlocks,
  setReportStatus,
  setReportStoryConfidence,
  storyNeedsExtract,
  type Report,
  type ReportLink,
  type ReportStory,
} from "@/lib/reports";

export function ReportsDesk({
  reports,
  selectedId,
  onSelect,
  onChange,
}: {
  reports: Report[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (rows: Report[]) => void;
}) {
  const selected = reports.find((row) => row.id === selectedId) ?? null;
  const live = openReports(reports);
  const archived = archivedReports(reports);

  if (selected) {
    return (
      <ReportView
        report={selected}
        onBack={() => onSelect(null)}
        onChange={onChange}
        reports={reports}
      />
    );
  }

  return (
    <div className="space-y-4 p-3">
      <div>
        <div className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Reports</div>
        <p className="mt-1 max-w-xl text-[12px] text-slate-600">
          Briefings you build from Read in place. Open a story, send it to a report, then keep adding.
          Each story keeps the full page extract — CVEs, recommendations, vendor links — not just the RSS
          blurb. Print saves as PDF from the browser dialog.
        </p>
      </div>
      <ReportList
        title="Open"
        empty="No open reports. Open a story and click Report."
        rows={live}
        onSelect={onSelect}
        onChange={onChange}
        reports={reports}
      />
      <ReportList
        title="Archived"
        empty="Nothing archived."
        rows={archived}
        onSelect={onSelect}
        onChange={onChange}
        reports={reports}
      />
    </div>
  );
}

function ReportList({
  title,
  empty,
  rows,
  onSelect,
  onChange,
  reports,
}: {
  title: string;
  empty: string;
  rows: Report[];
  onSelect: (id: string) => void;
  onChange: (rows: Report[]) => void;
  reports: Report[];
}) {
  return (
    <section>
      <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{title}</div>
      {rows.length === 0 ? (
        <p className="mt-1.5 text-[12px] text-slate-500">{empty}</p>
      ) : (
        <div className="mt-1.5 space-y-1.5">
          {rows.map((row) => (
            <div key={row.id} className="card-tile flex items-start gap-2">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(row.id)}>
                <p className="truncate text-[13px] font-medium text-slate-800">{row.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {row.stories.length} {row.stories.length === 1 ? "story" : "stories"}
                  {row.stories[0] ? ` · ${row.stories[0].title}` : ""}
                </p>
              </button>
              {row.status === "open" ? (
                <Tip text="Archive this report">
                  <button
                    type="button"
                    className="rounded p-1 text-slate-400 hover:text-slate-700"
                    onClick={() => onChange(setReportStatus(row.id, "archived", reports))}
                  >
                    <Archive className="size-3.5" />
                  </button>
                </Tip>
              ) : (
                <Tip text="Move back to open">
                  <button
                    type="button"
                    className="rounded p-1 text-slate-400 hover:text-slate-700"
                    onClick={() => onChange(setReportStatus(row.id, "open", reports))}
                  >
                    <ArchiveRestore className="size-3.5" />
                  </button>
                </Tip>
              )}
              <Tip text="Delete this report">
                <button
                  type="button"
                  className="rounded p-1 text-slate-400 hover:text-rose-700"
                  onClick={() => {
                    if (window.confirm(`Delete “${row.title}”?`)) onChange(deleteReport(row.id, reports));
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </Tip>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ReportView({
  report,
  reports,
  onBack,
  onChange,
}: {
  report: Report;
  reports: Report[];
  onBack: () => void;
  onChange: (rows: Report[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(report.title);
  const [filling, setFilling] = useState(false);
  const [layout, setLayout] = useState<"document" | "timeline">("document");
  const reportsRef = useRef(reports);
  reportsRef.current = reports;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const missingKey = report.stories.filter(storyNeedsExtract).map((story) => story.id).join(",");

  useEffect(() => {
    if (!missingKey) {
      setFilling(false);
      return;
    }
    let cancelled = false;
    setFilling(true);
    void (async () => {
      const rowsNow = reportsRef.current;
      const current = rowsNow.find((row) => row.id === report.id);
      const missing = current?.stories.filter(storyNeedsExtract) ?? [];
      const updated = await Promise.all(
        missing.map(async (story) => {
          const articles = await fetchArticleReads(extractUrlsForReportStory(story));
          return applyArticlesToReportStory(story, articles);
        }),
      );
      if (cancelled) return;
      let rows = reportsRef.current;
      for (const next of updated) {
        rows = replaceStoryInReport(report.id, { ...next, extractAt: Date.now() }, rows);
      }
      onChangeRef.current(rows);
      setFilling(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [missingKey, report.id]);

  function saveTitle() {
    onChange(renameReport(report.id, draft, reports));
    setEditing(false);
  }

  function printPdf() {
    const root = document.documentElement;
    root.classList.add("print-report");
    const done = () => {
      root.classList.remove("print-report");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.setTimeout(() => window.print(), 50);
  }

  return (
    <article id="report-print" className="report-sheet mx-auto max-w-3xl space-y-4 p-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button size="xs" variant="outline" onClick={onBack}>
          All reports
        </Button>
        {report.status === "open" ? (
          <Button
            size="xs"
            variant="outline"
            onClick={() => onChange(setReportStatus(report.id, "archived", reports))}
          >
            <Archive className="size-3" />
            Archive
          </Button>
        ) : (
          <Button
            size="xs"
            variant="outline"
            onClick={() => onChange(setReportStatus(report.id, "open", reports))}
          >
            <ArchiveRestore className="size-3" />
            Unarchive
          </Button>
        )}
        <Button
          size="xs"
          variant="outline"
          onClick={() => {
            if (window.confirm(`Delete “${report.title}”?`)) {
              onChange(deleteReport(report.id, reports));
              onBack();
            }
          }}
        >
          <Trash2 className="size-3" />
          Delete
        </Button>
        <Button size="xs" onClick={printPdf}>
          <Printer className="size-3" />
          Print to PDF
        </Button>
        <div className="ml-auto flex gap-1 rounded-md border border-slate-200 p-0.5">
          <button
            type="button"
            className={`rounded px-2 py-0.5 text-[10px] font-medium ${
              layout === "document" ? "bg-slate-900 text-white" : "text-slate-600"
            }`}
            onClick={() => setLayout("document")}
          >
            Document
          </button>
          <button
            type="button"
            className={`rounded px-2 py-0.5 text-[10px] font-medium ${
              layout === "timeline" ? "bg-slate-900 text-white" : "text-slate-600"
            }`}
            onClick={() => setLayout("timeline")}
          >
            Timeline
          </button>
        </div>
      </div>

      <header className="border-b border-slate-200 pb-3">
        {editing ? (
          <div className="flex gap-2">
            <Input
              className="h-8 text-[15px] font-semibold"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveTitle();
                if (event.key === "Escape") setEditing(false);
              }}
              autoFocus
            />
            <Button size="xs" onClick={saveTitle}>
              Save
            </Button>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <h1 className="report-heading min-w-0 flex-1 text-[26px] leading-tight font-bold">
              {report.title}
            </h1>
            <Tip text="Edit report title">
              <button
                type="button"
                className="no-print rounded p-1 text-slate-400 hover:text-slate-700"
                onClick={() => {
                  setDraft(report.title);
                  setEditing(true);
                }}
              >
                <Pencil className="size-3.5" />
              </button>
            </Tip>
          </div>
        )}
        <p className="mt-1 text-[11px] text-slate-500">
          {report.stories.length} {report.stories.length === 1 ? "story" : "stories"}
          {report.status === "archived" ? " · archived" : ""}
          {filling ? " · pulling full copy" : ""}
          {" · "}
          updated <Ago ts={report.updatedAt} />
        </p>
      </header>

      {report.stories.length === 0 ? (
        <p className="text-[13px] text-slate-500">
          Empty report. Open a story and click Report to add news.
        </p>
      ) : layout === "timeline" ? (
        <ReportTimeline stories={report.stories} />
      ) : (
        report.stories.map((story, index) => (
          <section key={story.id}>
            {index > 0 ? (
              <div className="report-rule" role="separator">
                <span>Next article</span>
              </div>
            ) : null}
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                  {story.sources.map((source) => (
                    <span key={source.name} className="inline-flex items-center gap-1">
                      <span className="size-1.5 rounded-full" style={{ background: source.color }} />
                      {source.name}
                    </span>
                  ))}
                  {story.confidence ? (
                    <span className="report-confidence-badge">{reportConfidenceLabel(story.confidence)}</span>
                  ) : null}
                  <Ago ts={story.latestAt} className="ml-auto" />
                </div>
                <div className="no-print mt-1 flex flex-wrap items-center gap-2">
                  <label className="text-[10px] text-slate-500">
                    Confidence
                    <select
                      className="ml-1 h-7 rounded border border-slate-200 bg-white px-1.5 text-[11px] text-slate-800"
                      value={story.confidence ?? ""}
                      onChange={(event) => {
                        const value = event.target.value as ReportConfidence | "";
                        onChange(
                          setReportStoryConfidence(
                            report.id,
                            story.id,
                            value || undefined,
                            reports,
                          ),
                        );
                      }}
                    >
                      <option value="">Unset</option>
                      {REPORT_CONFIDENCE_OPTIONS.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <h2 className="report-heading mt-1 text-[20px] leading-snug font-bold">{story.title}</h2>
                {story.topics.length ? (
                  <p className="mt-1.5 text-[11px] text-slate-600">{story.topics.join(" · ")}</p>
                ) : null}
                {story.locations.length ? (
                  <p className="mt-1 text-[11px] text-slate-500">{story.locations.join(" · ")}</p>
                ) : null}
                {story.highlights?.length ? (
                  <div className="report-highlights mt-2 space-y-1.5">
                    <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Highlighted</p>
                    {story.highlights.map((quote, quoteIndex) => (
                      <blockquote
                        key={quoteIndex}
                        className="border-l-2 border-amber-400 pl-2 text-[12px] leading-snug text-slate-700 italic"
                      >
                        {quote}
                      </blockquote>
                    ))}
                  </div>
                ) : null}
                <ReportStoryCopy story={story} filling={filling && storyNeedsExtract(story)} />
              </div>
              <div className="no-print flex shrink-0 flex-col">
                <Tip text="Move up">
                  <button
                    type="button"
                    className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() => onChange(moveStoryInReport(report.id, story.id, -1, reports))}
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                </Tip>
                <Tip text="Move down">
                  <button
                    type="button"
                    className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    disabled={index === report.stories.length - 1}
                    onClick={() => onChange(moveStoryInReport(report.id, story.id, 1, reports))}
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                </Tip>
                <Tip text="Remove from report">
                  <button
                    type="button"
                    className="rounded p-1 text-slate-400 hover:text-rose-700"
                    onClick={() => onChange(removeStoryFromReport(report.id, story.id, reports))}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </Tip>
              </div>
            </div>
          </section>
        ))
      )}
    </article>
  );
}

function linkLabel(link: ReportLink) {
  if (link.title && !/^https?:/i.test(link.title) && link.title !== link.url) return link.title;
  try {
    const parsed = new URL(link.url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return link.title || link.url;
  }
}

function openCveInNvd(cve: string) {
  window.open(`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cve)}`, "_blank", "noopener,noreferrer");
}

function ReportStoryNvd({ cves }: { cves: string[] }) {
  const key = [...new Set(cves.map((c) => c.toUpperCase()))].sort().slice(0, 5).join(",");
  const [entries, setEntries] = useState<NvdCveBrief[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!key) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/nvd?cves=${encodeURIComponent(key)}`)
      .then(async (res) => {
        const data = (await res.json()) as { entries?: NvdCveBrief[] };
        if (!cancelled) setEntries(data.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!key) return null;
  if (loading && !entries.length) {
    return <p className="mt-3 text-[11px] text-slate-500">Loading NVD patch data…</p>;
  }
  return (
    <NvdPanel entries={entries} onCve={openCveInNvd} />
  );
}

function ReportVulnPlanBlock({ plan }: { plan: ReportVulnPlanSnapshot }) {
  return (
    <div className="mt-4 rounded-md border border-violet-200 bg-violet-50/80 px-3 py-3 dark:border-violet-800 dark:bg-violet-950/30">
      <div className="text-[10px] font-semibold tracking-wide text-violet-800 uppercase dark:text-violet-200">
        Vulnerability response (catalog)
      </div>
      <p className="mt-2 text-[13px] font-semibold text-slate-900 dark:text-slate-100">{plan.worryLabel}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">{plan.summary}</p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">{plan.thumbRule}</p>
      {plan.catalogNotes.length ? (
        <ul className="mt-2 space-y-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
          {plan.catalogNotes.map((line) => (
            <li key={line.slice(0, 48)}>{line}</li>
          ))}
        </ul>
      ) : null}
      {plan.incidentSteps.length ? (
        <ol className="mt-3 space-y-1.5">
          {plan.incidentSteps.map((step) => (
            <li key={step.order} className="text-[12px] leading-snug text-slate-700 dark:text-slate-200">
              <span className="font-semibold tabular-nums">{step.order}.</span> [{step.phase}] {step.title}
            </li>
          ))}
        </ol>
      ) : null}
      {plan.cweMitigationSample.length ? (
        <ul className="mt-2 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
          {plan.cweMitigationSample.map((line) => (
            <li key={line.slice(0, 40)}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ReportStoryCopy({ story, filling }: { story: ReportStory; filling: boolean }) {
  const body = story.body ?? [];
  const displayBlocks = reportStoryDisplayBlocks(story);
  const summary = story.summary?.trim() ?? "";
  const summaryShown =
    Boolean(summary) &&
    ((displayBlocks.length === 0 && body.length === 0) ||
      !body.some((para) => para.slice(0, 48).toLowerCase() === summary.slice(0, 48).toLowerCase()));
  const known = new Set([story.url, ...story.items.map((item) => item.url)].filter(Boolean));
  const extra = (story.links ?? []).filter((link) => !known.has(link.url));
  const seen = new Set<string>();
  const sources: ReportLink[] = [];
  for (const row of [
    story.url ? { title: "Original article", url: story.url } : null,
    ...story.items.map((item) => ({ title: `${item.source} — ${item.title}`, url: item.url })),
  ]) {
    if (!row?.url || seen.has(row.url)) continue;
    seen.add(row.url);
    sources.push(row);
  }

  return (
    <>
      {summaryShown ? (
        <p className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[13px] leading-relaxed text-slate-700">
          {summary}
        </p>
      ) : null}
      {filling && displayBlocks.length === 0 && body.length === 0 ? (
        <p className="mt-1.5 text-[12px] text-slate-400">Pulling the full page extract…</p>
      ) : null}
      {displayBlocks.length > 0 ? (
        <ArticleBody blocks={displayBlocks} onCve={openCveInNvd} />
      ) : (
        body.map((para) => (
          <p key={para.slice(0, 64)} className="mt-2 text-[13px] leading-relaxed text-slate-700">
            {para}
          </p>
        ))
      )}
      {(story.cves ?? []).length ? <ReportStoryNvd cves={story.cves} /> : null}
      {story.vulnPlan ? <ReportVulnPlanBlock plan={story.vulnPlan} /> : null}
      {extra.length ? (
        <div className="mt-4">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Links from the page
          </div>
          <div className="mt-1.5 space-y-1.5">
            {extra.map((link) => {
              const advisory = isVendorAdvisoryLink(link.url);
              return (
                <ExternalLinkRow
                  key={link.url}
                  href={link.url}
                  label={linkLabel(link)}
                  variant={advisory ? "advisory" : "default"}
                  urlCaption={link.url.replace(/^https?:\/\//, "")}
                  hint={advisory ? "Vendor advisory" : link.url.replace(/^https?:\/\//, "")}
                />
              );
            })}
          </div>
        </div>
      ) : null}
      {sources.length ? (
        <div className="mt-4">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Sources</div>
          <div className="mt-1.5 space-y-1.5">
            {sources.map((link) => (
              <ExternalLinkRow key={link.url} href={link.url} label={link.title} />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
