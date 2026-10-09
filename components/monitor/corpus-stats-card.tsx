"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { Ago } from "@/components/monitor/ago";
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import type { SystemStats } from "@/lib/stats-types";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function CorpusStatsCard({
  enabledLayers,
  boardItems,
}: {
  enabledLayers: number;
  boardItems: number;
}) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/stats")
      .then(async (res) => {
        const data = (await res.json()) as SystemStats & { error?: string };
        if (!res.ok) throw new Error(data.error || res.statusText);
        if (!cancelled) setStats(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Stats unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="card-tile sm:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Corpus analysis
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Trust the gather phase: how much is stored, cached, and on the board right now.
          </p>
        </div>
        <Tip text="Full system stats — layers, GDELT, ACLED, extracts">
          <Button size="xs" variant="outline" asChild>
            <Link href="/stats">
              <BarChart3 className="size-3" />
              Open stats
            </Link>
          </Button>
        </Tip>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Board</dt>
          <dd className="font-semibold tabular-nums">{boardItems} items</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Subscribed</dt>
          <dd className="font-semibold tabular-nums">{enabledLayers} layers</dd>
        </div>
        {stats ? (
          <>
            <div>
              <dt className="text-muted-foreground">Stored items</dt>
              <dd className="font-semibold tabular-nums">{stats.totals.items}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Extracts</dt>
              <dd className="font-semibold tabular-nums">{stats.totals.extracts}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cache</dt>
              <dd className="font-semibold tabular-nums">
                {stats.totals.cacheEntries} · {formatBytes(stats.totals.cacheBytes)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Database</dt>
              <dd className="font-semibold tabular-nums">{formatBytes(stats.dbBytes)}</dd>
            </div>
            <div className="col-span-2 sm:col-span-4 text-[10px] text-muted-foreground">
              Snapshot <Ago ts={stats.generatedAt} /> ago
              {stats.totals.gdeltLayers > 0
                ? ` · GDELT ${stats.totals.gdeltLayers} layers`
                : ""}
              {stats.totals.acledLayers > 0
                ? ` · ACLED ${stats.totals.acledLayers} layers`
                : ""}
            </div>
          </>
        ) : error ? (
          <div className="col-span-2 text-[11px] text-rose-600 sm:col-span-4">{error}</div>
        ) : (
          <div className="col-span-2 text-[11px] text-muted-foreground sm:col-span-4">
            Loading corpus metrics…
          </div>
        )}
      </dl>
    </section>
  );
}
