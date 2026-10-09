"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { Ago } from "@/components/monitor/ago";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { formatBytes } from "@/lib/format-bytes";
import type { AcledLayerStats, GdeltLayerStats, IngestLayerStatus, SystemStats } from "@/lib/stats-types";

const STATUS_LABEL: Record<IngestLayerStatus, string> = {
  data: "Has articles",
  cached: "Cached only",
  empty: "No matches",
  never: "Never loaded",
  stale: "Stale / empty",
  disabled: "Disabled",
};

const STATUS_CLASS: Record<IngestLayerStatus, string> = {
  data: "bg-emerald-100 text-emerald-800",
  cached: "bg-sky-100 text-sky-800",
  empty: "bg-amber-100 text-amber-900",
  never: "bg-slate-100 text-slate-600",
  stale: "bg-orange-100 text-orange-900",
  disabled: "bg-slate-100 text-slate-500",
};

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-2.5 dark:border-border dark:bg-background">
      <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      {hint ? <p className="mt-1 text-[10px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

function AcledLayerCard({
  row,
  retryId,
  onRetry,
}: {
  row: AcledLayerStats;
  retryId: number | null;
  onRetry: () => void;
}) {
  const filterLabel = row.country
    ? `${row.country} · last ${row.days}d · limit ${row.limit}`
    : `Global sample · last ${row.days}d · limit ${row.limit}`;

  return (
    <div className="rounded-md border border-slate-200 bg-white p-2.5 dark:border-border dark:bg-background">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold">{row.name}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_CLASS[row.status]}`}>
          {STATUS_LABEL[row.status]}
        </span>
        {!row.enabled ? <span className="text-[10px] text-slate-400">off</span> : null}
        {row.enabled && (row.status === "never" || row.status === "stale" || row.status === "empty") ? (
          <Button type="button" size="xs" variant="outline" disabled={retryId != null} onClick={onRetry}>
            <RefreshCw className={`size-3 ${retryId === row.id ? "animate-spin" : ""}`} />
            Fetch now
          </Button>
        ) : null}
      </div>
      <p className="mt-1 font-mono text-[10px] text-slate-500">{filterLabel}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-slate-400">Items in DB</dt>
          <dd className="font-medium">{row.itemCount}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Last 24h</dt>
          <dd className="font-medium">{row.itemsLast24h}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Cached events</dt>
          <dd className="font-medium">{row.cacheEvents == null ? "—" : row.cacheEvents}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Last fetch</dt>
          <dd className="font-medium">{row.lastFetchedAt ? <Ago ts={row.lastFetchedAt} /> : "Never"}</dd>
        </div>
      </dl>
      {row.latestTitle ? (
        <p className="mt-2 text-[11px] text-slate-600">
          Latest: <span className="text-slate-800">{row.latestTitle}</span>
          {row.latestAt ? (
            <>
              {" "}
              · <Ago ts={row.latestAt} />
            </>
          ) : null}
        </p>
      ) : row.status === "never" ? (
        <p className="mt-2 text-[11px] text-slate-500">
          No successful fetch yet — check credentials, myACLED access, and that the profile is enabled. Use{" "}
          <strong>Fetch now</strong> or header <strong>ACLED → Load</strong>.
        </p>
      ) : row.status === "empty" ? (
        <p className="mt-2 text-[11px] text-slate-500">
          Fetch succeeded but no events matched this country/window (or API returned an empty set).
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-slate-400">No events stored for this profile yet.</p>
      )}
    </div>
  );
}

export function StatsView() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryId, setRetryId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/stats");
      const text = await res.text();
      if (!text.trim()) {
        throw new Error(
          res.ok
            ? "Empty response from the server."
            : `Statistics request failed (${res.status}). Is the app running?`,
        );
      }
      let data: SystemStats & { error?: string };
      try {
        data = JSON.parse(text) as SystemStats & { error?: string };
      } catch {
        throw new Error("Server returned invalid JSON. Try refreshing after the dev server restarts.");
      }
      if (!res.ok) throw new Error(data.error || res.statusText);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  async function retryLayer(id: number, label: string) {
    setRetryId(id);
    setError(null);
    try {
      const res = await apiFetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      const text = await res.text();
      let data: { error?: string };
      try {
        data = text.trim() ? (JSON.parse(text) as { error?: string }) : {};
      } catch {
        throw new Error("Refresh returned invalid JSON.");
      }
      if (!res.ok) throw new Error(data.error || `Refresh failed (${res.status})`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not refresh ${label} layer`);
    } finally {
      setRetryId(null);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-background dark:text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-border dark:bg-background/95">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-slate-500" />
            <div>
              <h1 className="text-[15px] font-semibold">Statistical analysis</h1>
              <p className="text-[11px] text-slate-500">
                Storage, cache, layer volume, and GDELT / ACLED ingest health
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-4">
        {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
        {!stats && loading ? (
          <p className="text-[12px] text-slate-500">Loading metrics…</p>
        ) : null}
        {stats ? (
          <>
            <p className="text-[11px] text-slate-500">
              Snapshot <Ago ts={stats.generatedAt} /> · data dir{" "}
              <code className="text-[10px]">{stats.dataDir}</code>
            </p>

            <section>
              <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                Storage &amp; size
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="SQLite database" value={formatBytes(stats.dbBytes)} />
                <Metric
                  label="Outbound cache"
                  value={`${stats.totals.cacheEntries} · ${formatBytes(stats.totals.cacheBytes)}`}
                  hint="TTL-backed fetch bodies (RSS, JSON, KEV, HTML)"
                />
                <Metric
                  label="Page extracts"
                  value={`${stats.totals.extracts} · ${formatBytes(stats.totals.extractBytes)}`}
                  hint="Read-in-place corpus in FTS"
                />
                <Metric
                  label="Board SQL cap"
                  value={String(stats.boardItemLimit)}
                  hint="Max recent items loaded onto desks"
                />
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                Inventory
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Items stored" value={String(stats.totals.items)} />
                <Metric
                  label="Layers"
                  value={`${stats.totals.sourcesEnabled} enabled / ${stats.totals.sources}`}
                />
                <Metric
                  label="GDELT items"
                  value={`${stats.totals.gdeltItems} (${stats.totals.gdeltItemsLast24h} in 24h)`}
                  hint={`${stats.totals.gdeltLayers} GDELT layer(s) registered`}
                />
                <Metric
                  label="GDELT JSON cache"
                  value={`${stats.gdeltCache.articles} articles · ${formatBytes(stats.gdeltCache.bytes)}`}
                  hint={`${stats.gdeltCache.entries} cached DOC response(s)`}
                />
                <Metric
                  label="ACLED items"
                  value={`${stats.totals.acledItems} (${stats.totals.acledItemsLast24h} in 24h)`}
                  hint={`${stats.totals.acledLayers} ACLED profile(s) registered`}
                />
                <Metric
                  label="ACLED API"
                  value={
                    !stats.acledAuth.configured
                      ? "Not configured"
                      : stats.acledAuth.probe?.apiAccessDenied
                        ? "Access denied"
                        : stats.acledAuth.probe?.readHttp === 200
                          ? "Read OK"
                          : stats.acledAuth.tokenCached
                            ? "Token OK"
                            : "No token yet"
                  }
                  hint={
                    !stats.acledAuth.configured
                      ? "Set ACLED_USERNAME / ACLED_PASSWORD on the server"
                      : stats.acledAuth.probe?.hint ||
                        (stats.acledAuth.tokenExpiresAt
                          ? `OAuth expires ${new Date(stats.acledAuth.tokenExpiresAt).toLocaleString()}`
                          : "GET /api/acled or Load ACLED to run a probe")
                  }
                />
                <Metric
                  label="ACLED JSON cache"
                  value={`${stats.acledCache.events} events · ${formatBytes(stats.acledCache.bytes)}`}
                  hint={`${stats.acledCache.entries} cached read response(s)`}
                />
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                Cache by kind
              </h2>
              <div className="overflow-x-auto rounded-md border border-slate-200 bg-white dark:border-border dark:bg-background">
                <table className="w-full min-w-[320px] text-left text-[11px]">
                  <thead className="border-b border-slate-100 text-[10px] text-slate-400 uppercase">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Kind</th>
                      <th className="px-2 py-1.5 font-medium">Entries</th>
                      <th className="px-2 py-1.5 font-medium">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.cacheByKind.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-2 py-2 text-slate-500">
                          No live cache entries.
                        </td>
                      </tr>
                    ) : (
                      stats.cacheByKind.map((row) => (
                        <tr key={row.kind} className="border-b border-slate-50 last:border-0">
                          <td className="px-2 py-1.5 font-medium">{row.kind}</td>
                          <td className="px-2 py-1.5">{row.entries}</td>
                          <td className="px-2 py-1.5">{formatBytes(row.bytes)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                Layers by origin
              </h2>
              <div className="overflow-x-auto rounded-md border border-slate-200 bg-white dark:border-border dark:bg-background">
                <table className="w-full min-w-[420px] text-left text-[11px]">
                  <thead className="border-b border-slate-100 text-[10px] text-slate-400 uppercase">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Origin</th>
                      <th className="px-2 py-1.5 font-medium">Layers</th>
                      <th className="px-2 py-1.5 font-medium">Enabled</th>
                      <th className="px-2 py-1.5 font-medium">Items</th>
                      <th className="px-2 py-1.5 font-medium">24h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.origins.map((row) => (
                      <tr key={row.reason} className="border-b border-slate-50 last:border-0">
                        <td className="px-2 py-1.5 font-medium">{row.reason}</td>
                        <td className="px-2 py-1.5">{row.layers}</td>
                        <td className="px-2 py-1.5">{row.enabled}</td>
                        <td className="px-2 py-1.5">{row.items}</td>
                        <td className="px-2 py-1.5">{row.itemsLast24h}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                GDELT queries
              </h2>
              {stats.gdelt.length === 0 ? (
                <p className="text-[12px] text-slate-500">
                  No GDELT layers yet. Use the header <strong>GDELT</strong> button → Load GDELT.
                </p>
              ) : (
                <div className="space-y-2">
                  {stats.gdelt.map((row) => (
                    <div
                      key={row.key}
                      className="rounded-md border border-slate-200 bg-white p-2.5 dark:border-border dark:bg-background"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold">{row.name}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_CLASS[row.status]}`}>
                          {STATUS_LABEL[row.status]}
                        </span>
                        {!row.enabled ? (
                          <span className="text-[10px] text-slate-400">off</span>
                        ) : null}
                        {row.enabled && (row.status === "never" || row.status === "stale") ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            disabled={retryId != null}
                            onClick={() => void retryLayer(row.id, "GDELT")}
                          >
                            <RefreshCw className={`size-3 ${retryId === row.id ? "animate-spin" : ""}`} />
                            Fetch now
                          </Button>
                        ) : null}
                      </div>
                      {row.query ? (
                        <p className="mt-1 truncate font-mono text-[10px] text-slate-500" title={row.query}>
                          {row.query}
                        </p>
                      ) : null}
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-4">
                        <div>
                          <dt className="text-slate-400">Items in DB</dt>
                          <dd className="font-medium">{row.itemCount}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Last 24h</dt>
                          <dd className="font-medium">{row.itemsLast24h}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Cached articles</dt>
                          <dd className="font-medium">
                            {row.cacheArticles == null ? "—" : row.cacheArticles}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Last fetch</dt>
                          <dd className="font-medium">
                            {row.lastFetchedAt ? <Ago ts={row.lastFetchedAt} /> : "Never"}
                          </dd>
                        </div>
                      </dl>
                      {row.latestTitle ? (
                        <p className="mt-2 text-[11px] text-slate-600">
                          Latest: <span className="text-slate-800">{row.latestTitle}</span>
                          {row.latestAt ? (
                            <>
                              {" "}
                              · <Ago ts={row.latestAt} />
                            </>
                          ) : null}
                        </p>
                      ) : row.status === "never" ? (
                        <p className="mt-2 text-[11px] text-slate-500">
                          No successful fetch yet — often GDELT rate limits (one request every ~5s) or a timeout when
                          several queries load together. Use <strong>Fetch now</strong> with other GDELT layers off, or
                          header <strong>GDELT → Load GDELT</strong>.
                        </p>
                      ) : (
                        <p className="mt-2 text-[11px] text-slate-400">No headlines stored for this query yet.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[10px] leading-snug text-slate-500">
                <strong>Has articles</strong> = SQLite rows from that query. <strong>Cached only</strong> = DOC JSON
                in fetch cache but nothing ingested. <strong>No matches</strong> = fetch ran but GDELT returned no
                articles. Refresh uses cached GDELT JSON for 30 minutes unless you Load GDELT again.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                ACLED profiles
              </h2>
              {!stats.acledAuth.configured ? (
                <p className="text-[12px] text-amber-900 dark:text-amber-200">
                  Server credentials missing. Add <code className="text-[11px]">ACLED_USERNAME</code> and{" "}
                  <code className="text-[11px]">ACLED_PASSWORD</code> from myACLED to{" "}
                  <code className="text-[11px]">.env.local</code>, restart, then header <strong>ACLED → Load</strong>.
                </p>
              ) : stats.acledAuth.probe?.apiAccessDenied ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[12px] leading-snug text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  <p className="font-semibold">OAuth works, but ACLED blocked event reads (HTTP 403).</p>
                  <p className="mt-1">
                    {stats.acledAuth.probe.hint} Email{" "}
                    <a href="mailto:access@acleddata.com" className="underline">
                      access@acleddata.com
                    </a>{" "}
                    from the same address as <code className="text-[11px]">ACLED_USERNAME</code>.
                  </p>
                  {stats.acledAuth.lastError ? (
                    <p className="mt-1 font-mono text-[10px] opacity-90">{stats.acledAuth.lastError}</p>
                  ) : null}
                </div>
              ) : stats.acledAuth.probe?.readHttp === 200 ? (
                <p className="text-[12px] text-emerald-800 dark:text-emerald-300">
                  Last probe: {stats.acledAuth.probe.readMessage ?? "read OK"} ·{" "}
                  <Ago ts={stats.acledAuth.probe.at} />
                </p>
              ) : null}
              {stats.acledAuth.configured &&
              stats.acled.length === 0 &&
              !stats.acledAuth.probe?.apiAccessDenied ? (
                <p className="text-[12px] text-slate-500">
                  No ACLED layers yet. Use the header <strong>ACLED</strong> button → Load with at least one profile
                  enabled.
                </p>
              ) : null}
              {stats.acled.length > 0 ? (
                <div className="space-y-2">
                  {stats.acled.map((row) => (
                    <AcledLayerCard
                      key={row.key}
                      row={row}
                      retryId={retryId}
                      onRetry={() => void retryLayer(row.id, "ACLED")}
                    />
                  ))}
                </div>
              ) : null}
              {stats.acledAuth.configured ? (
                <p className="mt-2 text-[10px] leading-snug text-slate-500">
                  <strong>Has articles</strong> = conflict events stored as items. <strong>Cached only</strong> = API
                  JSON in fetch cache but not ingested. OAuth token is cached in SQLite between loads. Event JSON cache
                  TTL matches other JSON fetches (~30 minutes).
                </p>
              ) : null}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
