"use client";

import { useMemo, useState } from "react";
import { SourceChip } from "@/components/monitor/cards";
import { ContextMenu } from "@/components/monitor/context-menu";
import {
  SourceContextMenu,
  type SourceMenuAction,
} from "@/components/monitor/source-context-menu";
import { itemHasPerson, type PersonRow } from "@/lib/people";
import type { Item, Source } from "@/lib/types";

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

export type PersonMenuAction = "filter" | "live" | "copy";

export function PeopleDesk({
  rows,
  items,
  sources,
  activePerson,
  onPerson,
  onPreviewSource,
  onToggleSource,
  onPersonAction,
}: {
  rows: PersonRow[];
  items: Item[];
  sources: Map<number, Source>;
  activePerson: string | null;
  onPerson: (name: string) => void;
  onPreviewSource: (sourceId: number) => void;
  onToggleSource: (sourceId: number, enabledNow: boolean) => void;
  onPersonAction: (name: string, action: PersonMenuAction) => void;
}) {
  const [menu, setMenu] = useState<SourceMenuState | null>(null);
  const [personMenu, setPersonMenu] = useState<PersonMenuState | null>(null);

  const countsByPersonSource = useMemo(() => {
    const map = new Map<string, Map<number, number>>();
    for (const row of rows) {
      map.set(row.name.toLowerCase(), new Map());
    }
    for (const item of items) {
      const source = sources.get(item.sourceId);
      for (const row of rows) {
        if (!itemHasPerson(item, row.name, source)) continue;
        const bucket = map.get(row.name.toLowerCase())!;
        bucket.set(item.sourceId, (bucket.get(item.sourceId) ?? 0) + 1);
      }
    }
    return map;
  }, [items, rows, sources]);

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
          Authors and named voices on the current board. Click a person to filter the board. Right-click
          a person to save that name as a live filter. Source chips show whether that layer is subscribed
          (filled) or in the pool only (outline). Right-click a source to preview or subscribe.
        </p>
      </div>
      <div className="board">
        {rows.map((row) => {
          const active = activePerson?.toLowerCase() === row.name.toLowerCase();
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
                onClick={() => onPerson(row.name)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setPersonMenu({ x: event.clientX, y: event.clientY, name: row.name });
                }}
              >
                <p className="text-[13px] leading-snug font-medium text-slate-800">{row.name}</p>
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
        })}
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
                  label: "Filter the board to this person",
                  onSelect: () => {
                    const name = personMenu.name;
                    setPersonMenu(null);
                    onPersonAction(name, "filter");
                  },
                },
                {
                  id: "live",
                  label: "Save as a live filter",
                  onSelect: () => {
                    const name = personMenu.name;
                    setPersonMenu(null);
                    onPersonAction(name, "live");
                  },
                },
                {
                  id: "copy",
                  label: "Copy name",
                  onSelect: () => {
                    const name = personMenu.name;
                    setPersonMenu(null);
                    onPersonAction(name, "copy");
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
