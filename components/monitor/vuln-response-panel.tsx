"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, ListOrdered, Loader2, Shield } from "lucide-react";
import { Tip } from "@/components/monitor/tip";
import type { Story } from "@/lib/cluster";
import { apiFetch } from "@/lib/api-client";
import type { ArticleBlock } from "@/lib/article-body";
import type { ArticleRead } from "@/lib/article";
import type { KevEntry } from "@/lib/kev";
import { nvdLinkLabel, type NvdCveBrief } from "@/lib/nvd";
import type { CweBrief } from "@/lib/cwe";
import type { VulnInsights } from "@/lib/laya-insights";
import { reportVulnPlanFromInsights, type ReportVulnPlanSnapshot } from "@/lib/report-vuln-plan";
import type { ChecklistItem } from "@/lib/vuln-response-checklist";
import { timingLabel } from "@/lib/incident-response-plan";

const SECTION_TITLE: Record<ChecklistItem["section"], string> = {
  vulnerability: "1 · Vulnerability — what is it?",
  exposure: "2 · Exposure — am I affected?",
  response: "3 · Response — what do we do, in what order?",
};

export function VulnResponsePanel({
  story,
  article,
  articleBlocks,
  kevHits,
  nvdEntries,
  stack,
  enabled = true,
  onDesk,
  onPlanSnapshot,
}: {
  story: Story;
  article: ArticleRead | null;
  articleBlocks: ArticleBlock[];
  kevHits: KevEntry[];
  nvdEntries: NvdCveBrief[];
  stack: string;
  enabled?: boolean;
  onDesk?: (desk: string) => void;
  onPlanSnapshot?: (snapshot: ReportVulnPlanSnapshot | null) => void;
}) {
  const [insights, setInsights] = useState<VulnInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestKey = [
    story.id,
    article?.url,
    stack,
    nvdEntries.map((e) => e.cveId).join(","),
    kevHits.map((e) => e.cveId).join(","),
    articleBlocks.length,
    "vuln-v1",
  ].join("|");

  useEffect(() => {
    setInsights(null);
    onPlanSnapshot?.(null);
  }, [story.id]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch("/api/vuln/response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        story,
        article,
        articleBlocks,
        kevHits,
        nvdEntries,
        stack,
      }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { insights?: VulnInsights; error?: string };
        if (!res.ok) throw new Error(data.error || "Plan failed");
        if (!cancelled) setInsights(data.insights ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Plan failed");
          setInsights(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, requestKey]);

  useEffect(() => {
    onPlanSnapshot?.(insights ? reportVulnPlanFromInsights(insights) : null);
  }, [insights, onPlanSnapshot]);

  if (!enabled) return null;

  return (
    <div className="laya-insights mt-4 rounded-lg border border-slate-200 px-3 py-3 shadow-sm dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-2">
        {loading ? (
          <Loader2 className="size-4 animate-spin text-slate-500" aria-hidden />
        ) : (
          <Shield className="size-4 text-slate-700 dark:text-slate-200" />
        )}
        <div className="text-[12px] font-semibold tracking-wide text-slate-800 uppercase dark:text-slate-100">
          Vulnerability response
        </div>
        <span className="laya-chip rounded px-2 py-0.5 text-[10px] font-medium">KEV · NVD · CWE · checklist</span>
        {loading ? <span className="text-[12px] text-slate-500">Building plan…</span> : null}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed opacity-90">
        Incident and patch plan from catalog data — KEV floors, NVD references, MITRE CWE, and standard response
        checklists.
      </p>
      {error ? <p className="mt-2 text-[13px] text-rose-600 dark:text-rose-400">{error}</p> : null}

      {insights ? (
        <div className="mt-3 space-y-3">
          <div className={`laya-worry laya-worry-${insights.worry} rounded-md border px-3 py-2.5`}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[14px] font-bold">{insights.worryLabel}</span>
              <Tip text={insights.gateReason}>
                <span className="text-[12px] opacity-90">Catalog triage</span>
              </Tip>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed">{insights.checklist.thumbRule}</p>
            {insights.catalogNotes.length ? (
              <ul className="mt-2 space-y-1 border-t border-current/10 pt-2 text-[12px] leading-snug opacity-95">
                {insights.catalogNotes.map((line) => (
                  <li key={line.slice(0, 48)}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="laya-panel rounded-md border px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide">
              <ListOrdered className="size-4" />
              {insights.incidentPlan.title}
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed">
              <span className="font-semibold">Lead: </span>
              {insights.incidentPlan.escalation}
            </p>
            <ol className="mt-2 space-y-2.5">
              {insights.incidentPlan.steps.map((step) => (
                <li key={step.order} className="laya-step rounded-md border px-2.5 py-2">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[12px] font-bold tabular-nums">{step.order}.</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                      {step.phase} · {timingLabel(step.timing)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] font-semibold leading-snug">{step.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed opacity-95">{step.detail}</p>
                </li>
              ))}
            </ol>
          </div>

          {insights.cweEntries.length > 0 ? <CweSection entries={insights.cweEntries} /> : null}

          {(["vulnerability", "exposure", "response"] as const).map((section) => (
            <ChecklistSection
              key={section}
              title={SECTION_TITLE[section]}
              items={insights.checklist.items.filter((i) => i.section === section)}
            />
          ))}

          <div className="laya-panel rounded-md border px-3 py-2">
            <div className="text-[12px] font-bold uppercase tracking-wide opacity-80">Mitigation links</div>
            <ul className="mt-1.5 space-y-1.5">
              {insights.mitigate.map((row) => (
                <li key={row.label + (row.href ?? row.detail)} className="text-[13px] leading-snug">
                  <span className="font-semibold">{row.label}: </span>
                  {row.href ? (
                    <a
                      href={row.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="laya-link underline underline-offset-2"
                    >
                      {nvdLinkLabel(row.href)}
                      <ExternalLink className="ml-1 inline size-3" />
                    </a>
                  ) : (
                    row.detail
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="laya-panel rounded-md border px-3 py-2">
            <div className="text-[12px] font-bold uppercase tracking-wide opacity-80">Threat IOCs (hunt only)</div>
            {insights.threatIocs.length === 0 ? (
              <p className="mt-1.5 text-[13px] leading-relaxed opacity-90">
                None — advisory and vendor support URLs are not block targets.
              </p>
            ) : (
              <ul className="mt-1.5 space-y-2">
                {insights.threatIocs.map((ioc) => (
                  <li key={`${ioc.kind}-${ioc.value}`} className="text-[13px]">
                    <span className="font-mono font-semibold">{ioc.value}</span>
                    <span className="ml-2 text-[11px] opacity-70">{ioc.kind}</span>
                    {ioc.context ? (
                      <p className="mt-0.5 text-[12px] leading-snug opacity-90">{ioc.context}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {insights.referenceHosts.length ? (
              <p className="mt-2 text-[12px] leading-snug opacity-75">
                Reference hosts: {insights.referenceHosts.slice(0, 6).join(", ")}
                {insights.referenceHosts.length > 6 ? "…" : ""}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 text-[12px]">
            <Badge active={insights.flags.addToReport}>Report</Badge>
            <Badge active={insights.flags.followSource}>Follow feed</Badge>
            <Badge active={insights.flags.threatIocHunt}>IOC hunt</Badge>
            {onDesk ? (
              <button
                type="button"
                onClick={() => onDesk(insights.recommendedDesk)}
                className="laya-btn rounded px-2 py-0.5 font-medium"
              >
                Open {insights.recommendedDesk} desk
              </button>
            ) : null}
          </div>
        </div>
      ) : loading ? null : (
        <p className="mt-2 text-[12px] text-slate-500">Waiting for NVD/CVE context…</p>
      )}
    </div>
  );
}

function CweSection({ entries }: { entries: CweBrief[] }) {
  return (
    <div className="laya-panel rounded-md border px-3 py-2.5">
      <div className="text-[12px] font-bold uppercase tracking-wide opacity-90">
        MITRE CWE — weakness & mitigations
      </div>
      <p className="mt-1 text-[12px] leading-relaxed opacity-85">
        Fetched from{" "}
        <a href="https://cwe.mitre.org/" target="_blank" rel="noopener noreferrer" className="laya-link underline">
          cwe.mitre.org
        </a>{" "}
        (official REST API, cached 7 days).
      </p>
      <div className="mt-2 space-y-3">
        {entries.map((cwe) => (
          <div key={cwe.cweId} className="laya-step rounded-md border px-2.5 py-2">
            <a
              href={cwe.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-bold laya-link underline underline-offset-2"
            >
              {cwe.cweId}: {cwe.name}
              <ExternalLink className="ml-1 inline size-3" />
            </a>
            {cwe.likelihood ? (
              <p className="mt-0.5 text-[12px] opacity-80">Likelihood of exploit: {cwe.likelihood}</p>
            ) : null}
            {cwe.description ? (
              <p className="mt-1 text-[13px] leading-relaxed">
                {cwe.description.slice(0, 320)}
                {cwe.description.length > 320 ? "…" : ""}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChecklistSection({ title, items }: { title: string; items: ChecklistItem[] }) {
  return (
    <div>
      <div className="text-[12px] font-bold uppercase tracking-wide">{title}</div>
      <ul className="mt-1.5 space-y-2">
        {items.map((row) => (
          <li key={row.id} className="laya-checklist-item rounded-md border px-2.5 py-2">
            <p className="text-[13px] font-semibold leading-snug">{row.question}</p>
            <p className="mt-1 text-[13px] leading-relaxed">{row.answer}</p>
            <StatusPill status={row.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusPill({ status }: { status: ChecklistItem["status"] }) {
  const label =
    status === "answered"
      ? "From catalog/copy"
      : status === "partial"
        ? "Partial — confirm in advisory"
        : status === "action"
          ? "Your action needed"
          : "Unknown — scope in CMDB";
  return (
    <span className={`laya-status laya-status-${status} mt-1.5 inline-block rounded px-2 py-0.5 text-[11px] font-semibold`}>
      {label}
    </span>
  );
}

function Badge({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={
        active ? "laya-badge-active rounded px-2 py-0.5 font-semibold" : "laya-badge rounded px-2 py-0.5 opacity-50"
      }
    >
      {children}
    </span>
  );
}
