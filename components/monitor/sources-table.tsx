"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Ago } from "@/components/monitor/ago";
import { originCopy } from "@/components/monitor/cards";
import { Tip } from "@/components/monitor/tip";
import { shortSourceName } from "@/lib/source-label";
import type { Source } from "@/lib/types";

type SortKey = "name" | "origin" | "items" | "fetched" | "status" | "added" | "next";

const STATUS_RANK = { error: 0, not_modified: 2, ok: 3 } as const;

function statusRank(source: Source) {
  const status = source.health?.status;
  if (!status) return 1;
  return STATUS_RANK[status];
}

function untilText(ts: number | null | undefined, now: number) {
  if (!ts) return "on next tick";
  const minutes = Math.round((ts - now) / 60000);
  if (minutes <= 0) return "due";
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 6) / 10;
  return `in ${hours}h`;
}

export function SourcesTable({
  sources,
  itemCounts,
  activeId,
  onOpen,
  onRefresh,
  onToggle,
  onMenu,
}: {
  sources: Source[];
  itemCounts: Map<number, number>;
  activeId: number | null;
  onOpen: (id: number) => void;
  onRefresh: (id: number) => void;
  onToggle: (id: number) => void;
  onMenu?: (source: Source, event: MouseEvent) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "status", dir: 1 });
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);
  const errorCount = sources.filter((source) => source.health?.status === "error").length;

  const rows = useMemo(() => {
    const value = (source: Source): string | number => {
      switch (sort.key) {
        case "name":
          return shortSourceName(source.name).toLowerCase();
        case "origin":
          return originCopy(source).label.toLowerCase();
        case "items":
          return itemCounts.get(source.id) ?? 0;
        case "fetched":
          return source.lastFetchedAt ?? 0;
        case "status":
          return statusRank(source) * 1000 - (source.health?.failCount ?? 0);
        case "added":
          return source.health?.lastAdded ?? -1;
        case "next":
          return source.health?.nextFetchAt ?? 0;
      }
    };
    return sources
      .filter((source) => !errorsOnly || source.health?.status === "error")
      .sort((a, b) => {
        const av = value(a);
        const bv = value(b);
        const cmp = typeof av === "string" ? av.localeCompare(String(bv)) : av - (bv as number);
        return cmp * sort.dir || a.name.localeCompare(b.name);
      });
  }, [sources, sort, errorsOnly, itemCounts]);

  const header = (key: SortKey, label: string, tip: string, numeric = false) => (
    <th
      scope="col"
      aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
      className={numeric ? "text-right" : undefined}
    >
      <Tip text={tip}>
        <button
          type="button"
          onClick={() =>
            setSort((prev) => ({ key, dir: prev.key === key ? (prev.dir === 1 ? -1 : 1) : numeric ? -1 : 1 }))
          }
        >
          {label}
          {sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
        </button>
      </Tip>
    </th>
  );

  return (
    <section className="card-tile sources-table-wrap">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
          {sources.length} layers · {errorCount} failing
        </div>
        <label className="flex items-center gap-1 text-[11px] text-slate-600">
          <input type="checkbox" checked={errorsOnly} onChange={(event) => setErrorsOnly(event.target.checked)} />
          Failing only
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="sources-table">
          <thead>
            <tr>
              {header("name", "Layer", "Feed or account name")}
              {header("origin", "Origin", "Why this layer is on the board")}
              {header("items", "Items", "Items from this layer on the current board", true)}
              {header("fetched", "Last fetch", "When the server last pulled this layer")}
              {header("status", "Status", "Result of the last pull; 304 means the feed was unchanged")}
              {header("added", "New", "New items added by the last pull", true)}
              {header("next", "Next", "When the server scheduler will pull it again")}
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((source) => {
              const health = source.health;
              const status = health?.status;
              return (
                <tr
                  key={source.id}
                  className={activeId === source.id ? "is-active" : undefined}
                  onClick={() => onOpen(source.id)}
                  onContextMenu={onMenu ? (event) => onMenu(source, event) : undefined}
                >
                  <td>
                    <Tip text={source.feedUrl || source.url}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="size-1.5 shrink-0 rounded-full" style={{ background: source.color }} />
                        <span className="truncate font-medium text-slate-800">{shortSourceName(source.name)}</span>
                        <span className="text-[10px] text-slate-400">{source.platform}</span>
                      </span>
                    </Tip>
                  </td>
                  <td className="text-slate-500">{originCopy(source).label}</td>
                  <td className="text-right tabular-nums">{itemCounts.get(source.id) ?? 0}</td>
                  <td className="text-slate-500">
                    {source.lastFetchedAt ? <Ago ts={source.lastFetchedAt} /> : "never"}
                  </td>
                  <td>
                    {status === "error" ? (
                      <Tip text={health?.error || "Fetch failed"}>
                        <span className="source-status source-status-error">
                          error{health && health.failCount > 1 ? ` ×${health.failCount}` : ""}
                        </span>
                      </Tip>
                    ) : status === "not_modified" ? (
                      <Tip text="The feed answered 304 Not Modified, so nothing was downloaded">
                        <span className="source-status">unchanged</span>
                      </Tip>
                    ) : status === "ok" ? (
                      <span className="source-status source-status-ok">ok</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">{health?.lastAdded ?? "—"}</td>
                  <td className="text-slate-500">{untilText(health?.nextFetchAt, now)}</td>
                  <td className="whitespace-nowrap text-right">
                    <button
                      type="button"
                      className="sources-table-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRefresh(source.id);
                      }}
                    >
                      Refresh
                    </button>
                    <button
                      type="button"
                      className="sources-table-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggle(source.id);
                      }}
                    >
                      Hide
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="mt-2 text-[12px] text-slate-500">No layers match.</p> : null}
    </section>
  );
}
