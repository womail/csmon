"use client";

import { useMemo } from "react";
import { Ago } from "@/components/monitor/ago";
import { SourceChip } from "@/components/monitor/cards";
import { Sparkline } from "@/components/monitor/charts";
import { FACET_ICON } from "@/components/monitor/facet-chip";
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import type { Story } from "@/lib/cluster";
import {
  connectionTip,
  connectionsFor,
  coverageByType,
  dailyCounts,
  itemMatchesRef,
  storyRefs,
  refKey,
  vendorInStack,
  type EntityRef,
} from "@/lib/connections";
import { KIND_LABEL, type FacetInput, type FacetKind } from "@/lib/facets";
import { figureByName } from "@/lib/gazetteer/people";
import { ORG_KIND_LABEL, orgAttribution, orgByName } from "@/lib/gazetteer/orgs";
import type { KevEntry } from "@/lib/kev";
import { SOURCE_TYPE_LABEL, isSourceType } from "@/lib/source-types";
import type { Item, Source } from "@/lib/types";
import { epssLabel, type EpssScore } from "@/lib/vuln-intel";

function typeCountLabel(type: string, n: number) {
  const label = isSourceType(type) ? SOURCE_TYPE_LABEL[type] : type;
  return `${n} ${label}${n === 1 ? "" : "s"}`;
}

function refLabel(ref: EntityRef) {
  return ref.kind === "stype" && isSourceType(ref.value) ? SOURCE_TYPE_LABEL[ref.value] : ref.value;
}

/** Dossier for any facet value: `?dossier=org:APT28`. Place and layer dossiers keep their own panes. */
export function EntityPane({
  entity,
  items,
  stories,
  sources,
  days,
  kev,
  epss,
  stack,
  onClose,
  onFilter,
  onExclude,
  onWatch,
  onSaveLiveFilter,
  onAddAllToReport,
  onOpenStory,
  onSource,
  onPivot,
  onDossier,
}: {
  entity: EntityRef;
  /** Board items in range. */
  items: Item[];
  /** Clustered stories in range. */
  stories: Story[];
  sources: Map<number, Source>;
  days: number;
  kev: KevEntry[];
  epss: Map<string, EpssScore>;
  stack: string;
  onClose: () => void;
  onFilter: () => void;
  onExclude: () => void;
  onWatch: () => void;
  onSaveLiveFilter: () => void;
  onAddAllToReport: (stories: Story[]) => void;
  onOpenStory: (story: Story) => void;
  onSource: (id: number) => void;
  onPivot: (facet: FacetInput) => void;
  onDossier: (token: string) => void;
}) {
  const label = refLabel(entity);
  const Icon = FACET_ICON[entity.kind as FacetKind];
  const matched = useMemo(
    () => items.filter((item) => itemMatchesRef(item, entity, sources.get(item.sourceId))),
    [entity, items, sources],
  );
  const key = refKey(entity);
  const focus = useMemo(
    () =>
      stories
        .filter((story) => storyRefs(story, sources).has(key))
        .sort((a, b) => b.sourceIds.length - a.sourceIds.length || b.latestAt - a.latestAt),
    [key, sources, stories],
  );
  const connected = useMemo(
    () => connectionsFor(focus, stories, sources, { exclude: [entity], perKind: 3, minTogether: 2 }),
    [entity, focus, sources, stories],
  );
  const coverage = useMemo(() => coverageByType(matched, sources), [matched, sources]);
  const spark = useMemo(() => dailyCounts(matched, Math.max(days, 2)), [days, matched]);
  const today = spark[spark.length - 1] ?? 0;

  const org = entity.kind === "org" ? orgByName(entity.value) : null;
  const figure = entity.kind === "person" ? figureByName(entity.value) : null;
  const subtitle = org
    ? [ORG_KIND_LABEL[org.kind], orgAttribution(org), org.aliases.slice(0, 3).join(", ")].filter(Boolean).join(" · ")
    : figure
      ? [figure.role, figure.country].filter(Boolean).join(" · ")
      : KIND_LABEL[entity.kind as FacetKind];

  const vendorKev = useMemo(() => {
    if (entity.kind !== "vendor") return [];
    const needle = entity.value.toLowerCase();
    return kev.filter((entry) => `${entry.vendor} ${entry.product}`.toLowerCase().includes(needle)).slice(0, 8);
  }, [entity, kev]);
  const actors = connected.filter((row) => row.kind === "org" && orgByName(row.value)?.kind === "threat_actor");
  const inStack = entity.kind === "vendor" && stack.trim() ? vendorInStack(entity.value, stack) : false;

  return (
    <aside className="flex h-full min-h-[70vh] flex-col border-l border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            {KIND_LABEL[entity.kind as FacetKind]} dossier
          </div>
          <div className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
            <Icon className="size-4 text-slate-500" />
            <span className="truncate">{label}</span>
          </div>
          {subtitle ? <div className="text-[11px] text-slate-500">{subtitle}</div> : null}
          {org?.note ? <div className="text-[11px] text-slate-400">{org.note}</div> : null}
        </div>
        <button type="button" onClick={onClose} className="text-[11px] text-slate-500">
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="flex flex-wrap gap-1">
          <Button size="xs" onClick={onFilter}>
            Filter
          </Button>
          <Button size="xs" variant="outline" onClick={onExclude}>
            Exclude
          </Button>
          <Button size="xs" variant="outline" onClick={onWatch}>
            Watch
          </Button>
          <Button size="xs" variant="outline" onClick={onSaveLiveFilter}>
            Save as live filter
          </Button>
          {focus.length ? (
            <Button size="xs" variant="outline" onClick={() => onAddAllToReport(focus.slice(0, 20))}>
              Add all to report
            </Button>
          ) : null}
        </div>

        <div className="dossier-section-label">Activity</div>
        <p className="text-[12px] text-slate-500">
          {matched.length} items · {focus.length} stories in range · {today} today
        </p>
        <Sparkline points={spark} color="#0e7490" />

        {entity.kind === "vendor" ? (
          <>
            <div className="dossier-section-label">Cyber chain</div>
            {inStack ? <p className="text-[12px] font-medium text-rose-700">In your stack</p> : null}
            {vendorKev.length ? (
              <ul className="space-y-0.5 text-[12px]">
                {vendorKev.map((entry) => {
                  const score = epss.get(entry.cveId);
                  return (
                    <li key={entry.cveId} className="flex items-baseline justify-between gap-2">
                      <button type="button" className="font-mono text-[11px] text-slate-800 hover:underline" onClick={() => onDossier(`cve:${entry.cveId}`)}>
                        {entry.cveId}
                      </button>
                      <span className="truncate text-[11px] text-slate-500">
                        {entry.product}
                        {entry.ransomware ? " · ransomware" : ""}
                        {score ? ` · ${epssLabel(score)}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[12px] text-slate-400">No KEV entries for {label} in the loaded catalog.</p>
            )}
            {actors.length ? (
              <p className="mt-1 text-[12px] text-slate-600">
                Threat actors seen with {label}:{" "}
                {actors.map((row, i) => (
                  <span key={row.value}>
                    {i ? ", " : ""}
                    <button type="button" className="hover:underline" onClick={() => onDossier(`org:${row.value}`)}>
                      {row.value}
                    </button>
                  </span>
                ))}
              </p>
            ) : null}
          </>
        ) : null}

        {coverage.length ? (
          <>
            <div className="dossier-section-label">Coverage</div>
            <p className="text-[12px] text-slate-500">
              {coverage.map((row) => typeCountLabel(row.type, row.sourceIds.length)).join(" · ")}
            </p>
            <div className="mt-1 flex flex-wrap content-start gap-1">
              {coverage
                .flatMap((row) => row.sourceIds)
                .slice(0, 12)
                .map((id) => {
                  const source = sources.get(id);
                  return source ? (
                    <SourceChip key={id} name={source.name} color={source.color} filled onClick={() => onSource(id)} />
                  ) : null;
                })}
            </div>
          </>
        ) : null}

        {connected.length ? (
          <>
            <div className="dossier-section-label">Connected</div>
            <div className="flex flex-wrap gap-1">
              {connected.map((row) => {
                const RowIcon = FACET_ICON[row.kind as FacetKind];
                const rowLabel = refLabel(row);
                return (
                  <Tip key={refKey(row)} text={`${connectionTip(row, rowLabel)}\nClick to filter · Shift+click for its dossier.`}>
                    <button
                      type="button"
                      className="filter-chip filter-chip-toggle often-with-chip"
                      onClick={(event) =>
                        event.shiftKey ? onDossier(`${row.kind}:${row.value}`) : onPivot({ kind: row.kind as FacetKind, value: row.value })
                      }
                    >
                      <RowIcon className="size-2.5 shrink-0 opacity-70" aria-hidden />
                      <span className="filter-chip-label">{rowLabel}</span>
                      <span className="often-with-lift">{row.together}</span>
                    </button>
                  </Tip>
                );
              })}
            </div>
          </>
        ) : null}

        <div className="dossier-section-label">Stories</div>
        <div className="space-y-1">
          {focus.slice(0, 30).map((story) => (
            <button
              key={story.id}
              type="button"
              onClick={() => onOpenStory(story)}
              className="block w-full rounded px-1 py-1.5 text-left hover:bg-slate-50"
            >
              <span className="block text-[12.5px] leading-snug font-medium text-slate-800">{story.title}</span>
              <span className="text-[10px] text-slate-400">
                {story.sourceIds.length} {story.sourceIds.length === 1 ? "source" : "sources"} · <Ago ts={story.latestAt} />
              </span>
            </button>
          ))}
          {focus.length === 0 ? (
            <p className="text-[12px] text-slate-500">No stories in this range mention {label}. Widen the time range.</p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
