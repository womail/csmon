"use client";

import { useMemo, useState } from "react";
import { SourceChip } from "@/components/monitor/cards";
import { MiniSpark } from "@/components/monitor/charts";
import { ContextMenu } from "@/components/monitor/context-menu";
import {
  SourceContextMenu,
  type SourceMenuAction,
} from "@/components/monitor/source-context-menu";
import { dailyCounts } from "@/lib/connections";
import { ORG_KIND_LABEL, ORG_KIND_ORDER, orgAttribution } from "@/lib/gazetteer/orgs";
import type { OrgRow, PersonRow } from "@/lib/people";
import type { Item, Source } from "@/lib/types";

export type PeopleTab = "news" | "orgs" | "bylines";

const TAB_LABEL: Record<PeopleTab, string> = {
  news: "In the news",
  orgs: "Organisations",
  bylines: "Bylines",
};

type SourceMenuState = {
  x: number;
  y: number;
  sourceId: number;
};

type PersonMenuState = {
  x: number;
  y: number;
  name: string;
};

export type PersonMenuAction = "filter" | "live" | "copy" | "dossier" | "exclude";

export function PeopleDesk({
  newsRows,
  orgRows,
  bylineRows,
  items,
  sources,
  activePerson,
  activeOrg,
  onPerson,
  onOrg,
  onPreviewSource,
  onToggleSource,
  onPersonAction,
}: {
  newsRows: PersonRow[];
  orgRows: OrgRow[];
  bylineRows: PersonRow[];
  items: Item[];
  sources: Map<number, Source>;
  activePerson: string | null;
  activeOrg: string | null;
  onPerson: (name: string) => void;
  onOrg: (name: string) => void;
  onPreviewSource: (sourceId: number) => void;
  onToggleSource: (sourceId: number, enabledNow: boolean) => void;
  onPersonAction: (name: string, action: PersonMenuAction, kind: "person" | "org") => void;
}) {
  const [menu, setMenu] = useState<SourceMenuState | null>(null);
  const [personMenu, setPersonMenu] = useState<PersonMenuState | null>(null);
  const [tab, setTab] = useState<PeopleTab>(() => (newsRows.length ? "news" : bylineRows.length ? "bylines" : "orgs"));

  const rows: PersonRow[] = tab === "news" ? newsRows : tab === "orgs" ? orgRows : bylineRows;
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const orgGroups = useMemo(() => {
    if (tab !== "orgs") return null;
    return ORG_KIND_ORDER.map((kind) => ({ kind, rows: orgRows.filter((row) => row.org.kind === kind) })).filter(
      (group) => group.rows.length,
    );
  }, [orgRows, tab]);

  const countsByPersonSource = useMemo(() => {
    const map = new Map<string, Map<number, number>>();
    for (const row of rows) {
      const bucket = new Map<number, number>();
      for (const id of row.itemIds ?? []) {
        const item = itemsById.get(id);
        if (item) bucket.set(item.sourceId, (bucket.get(item.sourceId) ?? 0) + 1);
      }
      map.set(row.name.toLowerCase(), bucket);
    }
    return map;
  }, [itemsById, rows]);

  function spark(row: PersonRow) {
    const rowItems = (row.itemIds ?? []).map((id) => itemsById.get(id)).filter((item): item is Item => Boolean(item));
    return dailyCounts(rowItems, 7);
  }

  const menuKind: "person" | "org" = tab === "orgs" ? "org" : "person";

  function openMenu(sourceId: number, event: { clientX: number; clientY: number; preventDefault: () => void; stopPropagation: () => void }) {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, sourceId });
  }

  function handleMenuAction(action: SourceMenuAction) {
    if (!menu) return;
    const source = sources.get(menu.sourceId);
    if (!source) {
      setMenu(null);
      return;
    }
    if (action.kind === "preview") onPreviewSource(menu.sourceId);
    if (action.kind === "subscribe") onToggleSource(menu.sourceId, false);
    if (action.kind === "unsubscribe") onToggleSource(menu.sourceId, true);
    setMenu(null);
  }

  const menuSource = menu ? sources.get(menu.sourceId) : null;

  return (
    <div className="space-y-2 p-3">
      <div>
        <div className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">People</div>
        <p className="mt-1 text-[12px] text-slate-600">
          Who the stories are about, the organisations they name, and who wrote them. Click a row to filter
          the board; right-click for its dossier, a live filter, or Exclude. Source chips show whether that layer
          is subscribed (filled) or in the pool only (outline).
        </p>
        <div className="mt-2 flex gap-1" role="tablist" aria-label="People views">
          {(Object.keys(TAB_LABEL) as PeopleTab[]).map((id) => {
            const count = id === "news" ? newsRows.length : id === "orgs" ? orgRows.length : bylineRows.length;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`investigation-bar-btn ${tab === id ? "is-active" : ""}`}
                onClick={() => setTab(id)}
              >
                {TAB_LABEL[id]} {count}
              </button>
            );
          })}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-[12px] text-slate-500">
          {tab === "news"
            ? "No named people on the board in this range."
            : tab === "orgs"
              ? "No known organisations on the board in this range."
              : "No bylines on the board in this range. Many feeds publish without an author."}
        </p>
      ) : null}
      <div className="board">
        {(orgGroups ? orgGroups.flatMap((group) => [{ head: ORG_KIND_LABEL[group.kind], rows: group.rows }]) : [{ head: null, rows }]).flatMap(({ head, rows: groupRows }) => [
          head ? (
            <div key={`head-${head}`} className="board-section-head">
              <span>{head}</span>
              <span className="board-section-head-count">{groupRows.length}</span>
            </div>
          ) : null,
          ...groupRows.map((row) => {
          const org = (row as OrgRow).org;
          const active = org
            ? activeOrg?.toLowerCase() === row.name.toLowerCase()
            : activePerson?.toLowerCase() === row.name.toLowerCase();
          const attribution = org ? orgAttribution(org) : null;
          const sourceCounts = countsByPersonSource.get(row.name.toLowerCase());
          const sourceIds = [...row.sourceIds].sort((a, b) => {
            const sa = sources.get(a)?.enabled ? 0 : 1;
            const sb = sources.get(b)?.enabled ? 0 : 1;
            if (sa !== sb) return sa - sb;
            return (sourceCounts?.get(b) ?? 0) - (sourceCounts?.get(a) ?? 0);
          });

          return (
            <article
              key={row.name}
              className={`card-tile w-full text-left ${active ? "ring-1 ring-violet-600" : ""}`}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => (org ? onOrg(row.name) : onPerson(row.name))}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setPersonMenu({ x: event.clientX, y: event.clientY, name: row.name });
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] leading-snug font-medium text-slate-800">{row.name}</p>
                  <MiniSpark points={spark(row)} color={org?.kind === "threat_actor" ? "#be123c" : "#6d28d9"} />
                </div>
                {row.role || attribution || row.outlets?.length ? (
                  <p className="text-[11px] text-slate-500">
                    {[row.role, attribution, tab === "bylines" ? row.outlets?.slice(0, 3).join(", ") : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-slate-500">
                  {row.count} items · {row.topics.slice(0, 3).join(" · ") || "no topic"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{row.sample}</p>
              </button>
              {sourceIds.length > 0 ? (
                <div
                  className="mt-2 flex flex-wrap content-start gap-1"
                  onClick={(event) => event.stopPropagation()}
                >
                  {sourceIds.map((sourceId) => {
                    const source = sources.get(sourceId);
                    if (!source) return null;
                    const subscribed = source.enabled;
                    const count = sourceCounts?.get(sourceId);
                    const tip = subscribed
                      ? `${source.name} · subscribed · ${count ?? 0} from ${row.name} · click preview · right-click menu`
                      : `${source.name} · not subscribed (pool only) · ${count ?? 0} from ${row.name} · right-click to subscribe`;

                    return (
                      <SourceChip
                        key={sourceId}
                        name={source.name}
                        color={source.color}
                        count={count}
                        filled={subscribed}
                        subscribed={subscribed}
                        tip={tip}
                        onClick={() => onPreviewSource(sourceId)}
                        onContextMenu={(event) => openMenu(sourceId, event)}
                      />
                    );
                  })}
                </div>
              ) : null}
            </article>
          );
        }),
        ])}
      </div>
      {personMenu ? (
        <ContextMenu
          x={personMenu.x}
          y={personMenu.y}
          title={personMenu.name}
          onClose={() => setPersonMenu(null)}
          sections={[
            {
              items: [
                {
                  id: "filter",
                  label: menuKind === "org" ? "Filter the board to this organisation" : "Filter the board to this person",
                  onSelect: () => {
                    const name = personMenu.name;
                    setPersonMenu(null);
                    onPersonAction(name, "filter", menuKind);
                  },
                },
                {
                  id: "dossier",
                  label: "Open dossier",
                  onSelect: () => {
                    const name = personMenu.name;
                    setPersonMenu(null);
                    onPersonAction(name, "dossier", menuKind);
                  },
                },
                {
                  id: "exclude",
                  label: "Exclude from the board",
                  onSelect: () => {
                    const name = personMenu.name;
                    setPersonMenu(null);
                    onPersonAction(name, "exclude", menuKind);
                  },
                },
                {
                  id: "live",
                  label: "Save as a live filter",
                  onSelect: () => {
                    const name = personMenu.name;
                    setPersonMenu(null);
                    onPersonAction(name, "live", menuKind);
                  },
                },
                {
                  id: "copy",
                  label: "Copy name",
                  onSelect: () => {
                    const name = personMenu.name;
                    setPersonMenu(null);
                    onPersonAction(name, "copy", menuKind);
                  },
                },
              ],
            },
          ]}
        />
      ) : null}
      {menu && menuSource ? (
        <SourceContextMenu
          x={menu.x}
          y={menu.y}
          sourceName={menuSource.name}
          subscribed={menuSource.enabled}
          onAction={handleMenuAction}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}
