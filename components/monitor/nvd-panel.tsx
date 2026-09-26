"use client";

import { ExternalLink, ShieldAlert, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/monitor/tip";
import type { KevEntry } from "@/lib/kev";
import { nvdLinkLabel, type NvdCveBrief, type NvdReference } from "@/lib/nvd";

function severityTone(severity: string | null, score: number | null) {
  const s = (severity ?? "").toLowerCase();
  if (s.includes("critical") || (score != null && score >= 9)) {
    return "border-rose-200 bg-rose-50 text-rose-950";
  }
  if (s.includes("high") || (score != null && score >= 7)) {
    return "border-orange-200 bg-orange-50 text-orange-950";
  }
  return "border-slate-200 bg-slate-50 text-slate-800";
}

function RefLinks({
  refs,
  variant = "default",
}: {
  refs: NvdReference[];
  variant?: "default" | "highlight-patch" | "highlight-mitigate";
}) {
  if (!refs.length) return null;
  const box =
    variant === "highlight-patch"
      ? "border-emerald-300 bg-emerald-50/90"
      : variant === "highlight-mitigate"
        ? "border-amber-300 bg-amber-50/90"
        : "border-slate-200 bg-white";
  return (
    <ul className={`mt-1.5 space-y-1 rounded-md border px-2 py-1.5 ${box}`}>
      {refs.slice(0, 8).map((ref) => (
        <li key={ref.url}>
          <a
            href={ref.url}
            target="_blank"
            rel="noopener noreferrer"
            title={ref.url}
            className="group flex items-start gap-1.5 text-[11px] leading-snug text-sky-900 hover:underline"
          >
            <ExternalLink className="mt-0.5 size-3 shrink-0 opacity-70 group-hover:opacity-100" />
            <span className="min-w-0 break-all">
              <span className="font-medium">{nvdLinkLabel(ref.url)}</span>
              {ref.tags.length ? (
                <span className="ml-1 text-[9px] font-normal text-slate-500">
                  [{ref.tags.join(" · ")}]
                </span>
              ) : null}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function ActionBanner({ entry, kev }: { entry: NvdCveBrief; kev?: KevEntry }) {
  if (entry.actionKind === "patch") {
    return (
      <div className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-950">
          <Wrench className="size-3.5" />
          Patch or fixed release available
        </div>
        {entry.fixedVersions.length ? (
          <p className="mt-1 text-[10px] leading-snug text-emerald-900">
            {entry.fixedVersions.join(" · ")}
          </p>
        ) : null}
        <RefLinks
          refs={[...entry.patches, ...entry.releaseNotes].slice(0, 6)}
          variant="highlight-patch"
        />
      </div>
    );
  }
  if (entry.actionKind === "mitigate") {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-950">
          <ShieldAlert className="size-3.5" />
          Mitigate until patched
        </div>
        {entry.cisaRequiredAction ? (
          <p className="mt-1 text-[10px] leading-snug text-amber-950">{entry.cisaRequiredAction}</p>
        ) : null}
        {kev?.requiredAction ? (
          <p className="mt-1 text-[10px] leading-snug text-rose-900">
            <span className="font-medium">KEV: </span>
            {kev.requiredAction}
          </p>
        ) : null}
        <RefLinks refs={entry.mitigations} variant="highlight-mitigate" />
      </div>
    );
  }
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-600">
      No patch or mitigation tag in NVD yet — check vendor advisories below or monitor the Patch desk.
    </div>
  );
}

function NvdCard({
  entry,
  kev,
  onCve,
  onVendor,
  onFollow,
}: {
  entry: NvdCveBrief;
  kev?: KevEntry;
  onCve: (cve: string) => void;
  onVendor?: (vendor: string) => void;
  onFollow?: (url: string) => void;
}) {
  const tone = severityTone(entry.severity, entry.cvssScore);
  const primaryVendor = entry.vendors[0] ?? kev?.vendor;
  const advisoryForFollow =
    entry.vendorAdvisories[0]?.url ?? entry.patches[0]?.url ?? entry.releaseNotes[0]?.url;

  return (
    <article className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className={`border-b px-2.5 py-2 ${tone}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Tip text="Filter the board to this CVE on Patch">
            <button
              type="button"
              onClick={() => onCve(entry.cveId)}
              className="font-mono text-[12px] font-bold underline-offset-2 hover:underline"
            >
              {entry.cveId}
            </button>
          </Tip>
          {entry.cvssScore != null ? (
            <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              CVSS {entry.cvssScore}
              {entry.severity ? ` · ${entry.severity}` : ""}
            </span>
          ) : null}
          <span className="text-[10px] opacity-80">{entry.status}</span>
          {kev ? (
            <span className="rounded bg-rose-200/80 px-1.5 py-0.5 text-[9px] font-semibold text-rose-950">
              CISA KEV
              {kev.ransomware ? " · ransomware" : ""}
            </span>
          ) : null}
        </div>
        {(primaryVendor || entry.products.length > 0) && (
          <p className="mt-1 text-[10px] opacity-90">
            {primaryVendor ? (
              onVendor ? (
                <Tip text={`Filter to vendor ${primaryVendor}`}>
                  <button type="button" className="font-medium hover:underline" onClick={() => onVendor(primaryVendor)}>
                    {primaryVendor}
                  </button>
                </Tip>
              ) : (
                <span className="font-medium">{primaryVendor}</span>
              )
            ) : null}
            {entry.products.length ? (
              <span className="text-slate-700">
                {primaryVendor ? " · " : ""}
                {entry.products.slice(0, 4).join(", ")}
                {entry.products.length > 4 ? "…" : ""}
              </span>
            ) : null}
          </p>
        )}
      </div>

      <div className="space-y-2 px-2.5 py-2">
        <ActionBanner entry={entry} kev={kev} />

        {entry.description ? (
          <p className="text-[11px] leading-relaxed text-slate-700">{entry.description}</p>
        ) : null}

        {entry.cwes.length ? (
          <p className="text-[10px] text-slate-500">
            <span className="font-medium text-slate-600">Weakness: </span>
            {entry.cwes.join(" · ")}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-1 border-t border-slate-100 pt-2">
          <Tip text="Show Patch desk stories for this CVE">
            <Button size="xs" variant="outline" onClick={() => onCve(entry.cveId)}>
              Mine on Patch desk
            </Button>
          </Tip>
          <Tip text="Open full record on NVD">
            <Button size="xs" variant="outline" asChild>
              <a href={entry.url} target="_blank" rel="noopener noreferrer">
                NVD detail
                <ExternalLink className="size-3" />
              </a>
            </Button>
          </Tip>
          {advisoryForFollow && onFollow ? (
            <Tip text="Add this advisory URL as a follow layer">
              <Button size="xs" variant="outline" onClick={() => onFollow(advisoryForFollow)}>
                Follow advisory
              </Button>
            </Tip>
          ) : null}
        </div>

        {entry.vendorAdvisories.length ? (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Vendor advisories
            </div>
            <RefLinks refs={entry.vendorAdvisories} />
          </div>
        ) : null}

        {entry.actionKind === "patch" && entry.mitigations.length ? (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Also: mitigations
            </div>
            <RefLinks refs={entry.mitigations} variant="highlight-mitigate" />
          </div>
        ) : null}

        {entry.otherReferences.length ? (
          <details className="text-[10px] text-slate-500">
            <summary className="cursor-pointer font-medium text-slate-600">
              More references ({entry.otherReferences.length})
            </summary>
            <RefLinks refs={entry.otherReferences} />
          </details>
        ) : null}
      </div>
    </article>
  );
}

export function NvdPanel({
  entries,
  kevHits = [],
  onCve,
  onVendor,
  onFollow,
}: {
  entries: NvdCveBrief[];
  kevHits?: KevEntry[];
  onCve: (cve: string) => void;
  onVendor?: (vendor: string) => void;
  onFollow?: (url: string) => void;
}) {
  const kevByCve = new Map(kevHits.map((row) => [row.cveId.toUpperCase(), row]));
  const nvdCveSet = new Set(entries.map((e) => e.cveId.toUpperCase()));
  const kevOnly = kevHits.filter((row) => !nvdCveSet.has(row.cveId.toUpperCase()));

  if (!entries.length && !kevOnly.length) return null;

  return (
    <div className="mt-4 space-y-2">
      <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
        CVE catalog (NVD)
      </div>
      <p className="text-[10px] leading-snug text-slate-500">
        Patch and mitigation links come from NVD reference tags. Click a CVE to filter the board; open
        links in a new tab; follow an advisory to watch the vendor feed.
      </p>
      <div className="space-y-3">
        {entries.map((entry) => (
          <NvdCard
            key={entry.cveId}
            entry={entry}
            kev={kevByCve.get(entry.cveId.toUpperCase())}
            onCve={onCve}
            onVendor={onVendor}
            onFollow={onFollow}
          />
        ))}
      </div>
      {kevOnly.length > 0 ? (
        <div className="rounded-md border border-rose-100 bg-rose-50/50 px-2 py-1.5">
          <div className="text-[10px] font-semibold text-rose-800">KEV (no NVD card loaded)</div>
          {kevOnly.map((entry) => (
            <button
              key={entry.cveId}
              type="button"
              onClick={() => onCve(entry.cveId)}
              className="mt-1 block w-full text-left text-[11px] text-slate-800 hover:underline"
            >
              {entry.cveId} — {entry.vendor} {entry.product}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
