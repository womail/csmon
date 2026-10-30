"use client";

import { useMemo } from "react";
import { FACET_ICON } from "@/components/monitor/facet-chip";
import type { Story } from "@/lib/cluster";
import { refKey, storiesWithRef, storyRefs, vendorInStack, type EntityRef } from "@/lib/connections";
import type { FacetKind } from "@/lib/facets";
import { orgAttribution, orgByName } from "@/lib/gazetteer/orgs";
import type { KevEntry } from "@/lib/kev";
import type { Source } from "@/lib/types";

export type EntityAction = "filter" | "dossier" | "watch";

const SHOWN = new Set(["person", "org", "place", "vendor", "cve"]);
const ORDER = ["org", "person", "place", "vendor", "cve"];

/** Everything the story names, each with how much else in range involves it. */
export function ConnectedPanel({
  story,
  pool,
  sources,
  kev = [],
  stack = "",
  onEntity,
  onOpenStory,
}: {
  story: Story;
  pool: Story[];
  sources: Map<number, Source>;
  kev?: KevEntry[];
  stack?: string;
  onEntity: (ref: EntityRef, action: EntityAction) => void;
  onOpenStory: (story: Story) => void;
}) {
  const rows = useMemo(() => {
    const refs = [...storyRefs(story, sources).values()].filter((ref) => SHOWN.has(ref.kind));
    return refs
      .map((ref) => ({ ref, others: storiesWithRef(ref, pool, sources, story) }))
      .sort((a, b) => ORDER.indexOf(a.ref.kind) - ORDER.indexOf(b.ref.kind) || b.others.length - a.others.length)
      .slice(0, 14);
  }, [pool, sources, story]);

  if (!rows.length) return null;
  return (
    <div className="mt-4">
      <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Connected</div>
      <ul className="mt-1 space-y-1">
        {rows.map(({ ref, others }) => {
          const Icon = FACET_ICON[ref.kind as FacetKind];
          const org = ref.kind === "org" ? orgByName(ref.value) : null;
          const attribution = org ? orgAttribution(org) : null;
          let vendorNote: string | null = null;
          if (ref.kind === "vendor") {
            const needle = ref.value.toLowerCase();
            const inKev = kev.filter((entry) => `${entry.vendor} ${entry.product}`.toLowerCase().includes(needle)).length;
            const mine = stack.trim() && vendorInStack(ref.value, stack);
            vendorNote = [inKev ? `${inKev} in KEV` : null, mine ? "in your stack" : null].filter(Boolean).join(" · ") || null;
          }
          return (
            <li key={refKey(ref)} className="connected-row">
              <details>
                <summary className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-slate-800">
                    <Icon className="size-3 shrink-0 text-slate-400" aria-hidden />
                    <span className="truncate font-medium">{ref.value}</span>
                    {attribution ? <span className="shrink-0 text-[10px] text-slate-400">{attribution}</span> : null}
                    {vendorNote ? <span className="shrink-0 text-[10px] text-rose-700">{vendorNote}</span> : null}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {others.length} other {others.length === 1 ? "story" : "stories"} in range
                  </span>
                </summary>
                <div className="mt-1 pl-4">
                  {others.slice(0, 3).map((other) => (
                    <button
                      key={other.id}
                      type="button"
                      className="block w-full truncate rounded px-1 py-0.5 text-left text-[11.5px] text-slate-700 hover:bg-slate-50"
                      onClick={() => onOpenStory(other)}
                    >
                      {other.title}
                    </button>
                  ))}
                  <div className="mt-1 flex gap-1">
                    <button type="button" className="connected-btn" onClick={() => onEntity(ref, "filter")}>
                      Filter
                    </button>
                    <button type="button" className="connected-btn" onClick={() => onEntity(ref, "dossier")}>
                      Dossier
                    </button>
                    <button type="button" className="connected-btn" onClick={() => onEntity(ref, "watch")}>
                      Watch
                    </button>
                  </div>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
