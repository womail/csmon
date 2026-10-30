"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { loadOptions, saveOptions } from "@/lib/options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { INTEL_FEEDS, type IntelPack } from "@/lib/intel-feeds";
import { apiFetch } from "@/lib/api-client";
import {
  buildContributionFile,
  downloadJson,
  loadSourceLibrary,
  rowToDraft,
  saveSourceLibrary,
  type LocalSourceDraft,
} from "@/lib/source-library";
import { parseSourceImportJson } from "@/lib/source-import";
import type { SourceCatalogRow } from "@/lib/source-catalog-shared";
import type { MonitorState } from "@/lib/types";
import { SOURCE_TYPES, SOURCE_TYPE_LABEL, type SourceType } from "@/lib/source-types";

type CatalogResponse = {
  rows: Array<{
    id: number;
    key: string;
    name: string;
    handle: string | null;
    url: string;
    feedUrl: string | null;
    description: string | null;
    enabled: boolean;
    lastFetchedAt: number | null;
    itemCount: number;
    itemsLast24h: number;
    latestItemAt: number | null;
    latestTitle: string | null;
    stale: boolean;
    silent: boolean;
    primaryReason: string;
    retentionDays: number | null;
    intelFeed: { id: string; pack: IntelPack } | null;
    category: string;
    storedCategory: string | null;
    sourceType: SourceType;
    storedSourceType: SourceType | null;
  }>;
  summary: {
    total: number;
    enabled: number;
    stale: number;
    silent: number;
    itemsLast24h: number;
    notInShippedCatalog: number;
    suggestions: string[];
    purgePreviewCount?: number;
  };
  shippedFeedCount: number;
  feedOverrides?: {
    path: string;
    count: number;
    updatedAt: string | null;
    shippedCount: number;
    effectiveCount: number;
  };
};

const PACKS: IntelPack[] = [
  "core",
  "relief",
  "security",
  "politics",
  "hazard",
  "tech",
  "markets",
  "sports",
];

function rowCategory(row: LocalSourceDraft) {
  return row.category?.trim() || row.shownCategory || "Other";
}

function rowType(row: LocalSourceDraft): SourceType {
  return row.sourceType ?? row.shownType ?? "outlet";
}

function relTime(ts: number | null) {
  if (ts == null) return "never";
  const sec = Math.round((ts - Date.now()) / 1000);
  const abs = Math.abs(sec);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60) return rtf.format(sec, "second");
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  return rtf.format(Math.round(sec / 86400), "day");
}

function mergeDrafts(
  catalog: CatalogResponse,
  saved: Record<number, LocalSourceDraft>,
): LocalSourceDraft[] {
  return catalog.rows.map((row) => {
    const savedRow = saved[row.id];
    const base = rowToDraft(
      {
        id: row.id,
        key: row.key,
        name: row.name,
        handle: row.handle,
        url: row.url,
        feedUrl: row.feedUrl,
        platform: "rss",
        kind: "feed",
        description: row.description,
        enabled: row.enabled,
        lastFetchedAt: row.lastFetchedAt,
        createdAt: 0,
        origins: [],
        intelFeed: row.intelFeed
          ? {
              id: row.intelFeed.id,
              name: row.name,
              url: row.url,
              feedUrl: row.feedUrl ?? "",
              pack: row.intelFeed.pack,
              blurb: row.description ?? "",
            }
          : null,
        itemCount: row.itemCount,
        itemsLast24h: row.itemsLast24h,
        latestItemAt: row.latestItemAt,
        latestTitle: row.latestTitle,
        stale: row.stale,
        silent: row.silent,
        retentionDays: row.retentionDays ?? null,
        primaryReason: row.primaryReason as SourceCatalogRow["primaryReason"],
        category: row.category,
        storedCategory: row.storedCategory,
        sourceType: row.sourceType,
        storedSourceType: row.storedSourceType,
      },
      savedRow?.notes ?? "",
    );
    if (!savedRow) return base;
    return {
      ...base,
      name: savedRow.name,
      url: savedRow.url,
      feedUrl: savedRow.feedUrl,
      description: savedRow.description,
      enabled: savedRow.enabled,
      intelId: savedRow.intelId,
      pack: savedRow.pack,
      notes: savedRow.notes,
      retentionDays: savedRow.retentionDays ?? base.retentionDays,
      category: savedRow.category !== undefined ? savedRow.category : base.category,
      sourceType: savedRow.sourceType !== undefined ? savedRow.sourceType : base.sourceType,
    };
  });
}

function draftPayload(row: LocalSourceDraft) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    feedUrl: row.feedUrl,
    description: row.description,
    enabled: row.enabled,
    retentionDays: row.retentionDays,
    category: row.category ?? null,
    sourceType: row.sourceType ?? null,
  };
}

export function SourceWorkbenchBody({
  onApplied,
}: {
  onApplied?: (state: MonitorState) => void;
}) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [drafts, setDrafts] = useState<LocalSourceDraft[]>([]);
  const [filter, setFilter] = useState<"all" | "enabled" | "stale" | "silent" | "custom">("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [dirty, setDirty] = useState<Set<number>>(() => new Set());
  const [purgeDays, setPurgeDays] = useState(30);
  const [defaultRetention, setDefaultRetention] = useState<number | null>(30);
  const [showAdd, setShowAdd] = useState(false);
  const [showOpml, setShowOpml] = useState(false);
  const [opmlUrl, setOpmlUrl] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  const opmlFileRef = useRef<HTMLInputElement>(null);
  const [newLayer, setNewLayer] = useState({
    name: "",
    url: "",
    feedUrl: "",
    description: "",
    enabled: true,
  });

  const load = useCallback(async () => {
    setError(null);
    const qs = purgeDays > 0 ? `?purgePreviewDays=${purgeDays}` : "";
    const res = await apiFetch(`/api/source-catalog${qs}`);
    const data = (await res.json()) as CatalogResponse & { error?: string };
    if (!res.ok) throw new Error(data.error || "Could not load sources");
    setCatalog(data);
    const saved = loadSourceLibrary();
    setDrafts(mergeDrafts(data, saved));
    setDefaultRetention(loadOptions().defaultRetentionDays);
  }, [purgeDays]);

  useEffect(() => {
    setMessage(null);
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : "Load failed"),
    );
  }, [load]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drafts.filter((row) => {
      if (filter === "enabled" && !row.enabled) return false;
      if (filter === "stale") {
        const cat = catalog?.rows.find((r) => r.id === row.id);
        if (!cat?.stale) return false;
      }
      if (filter === "silent") {
        const cat = catalog?.rows.find((r) => r.id === row.id);
        if (!cat?.silent) return false;
      }
      if (filter === "custom") {
        const cat = catalog?.rows.find((r) => r.id === row.id);
        if (cat?.intelFeed) return false;
      }
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.key.toLowerCase().includes(q) ||
        (row.feedUrl?.toLowerCase().includes(q) ?? false) ||
        (row.notes.toLowerCase().includes(q) ?? false) ||
        rowCategory(row).toLowerCase().includes(q) ||
        SOURCE_TYPE_LABEL[rowType(row)].toLowerCase().includes(q)
      );
    });
  }, [catalog?.rows, drafts, filter, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, LocalSourceDraft[]>();
    for (const row of filtered) {
      const key = rowCategory(row);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const categories = useMemo(
    () => [...new Set(drafts.map(rowCategory))].sort((a, b) => a.localeCompare(b)),
    [drafts],
  );

  function patchDraft(id: number, patch: Partial<LocalSourceDraft>) {
    setDrafts((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setDirty((prev) => new Set(prev).add(id));
  }

  function persistDefaultRetention(days: number | null) {
    setDefaultRetention(days);
    const opts = loadOptions();
    saveOptions({ ...opts, defaultRetentionDays: days });
  }

  function saveLocal() {
    saveSourceLibrary(drafts);
    setMessage("Saved drafts in this browser (localStorage). Export JSON to share or back up.");
  }

  function exportFile() {
    const file = buildContributionFile(drafts);
    downloadJson(`csmon-sources-${new Date().toISOString().slice(0, 10)}.json`, file);
    setMessage(
      "Downloaded contribution JSON. Add feeds to lib/intel-feeds.ts in your GitHub fork and open a pull request — csmon never pushes upstream for you.",
    );
  }

  async function saveInstanceOverrides() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch("/api/source-catalog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saveFeedOverrides: true, refresh: false }),
      });
      const data = (await res.json()) as {
        error?: string;
        catalog?: CatalogResponse;
        feedOverrides?: { saved: number; path: string; updatedAt: string };
      };
      if (!res.ok) throw new Error(data.error || "Could not save overrides");
      if (data.catalog) setCatalog(data.catalog);
      setMessage(
        `Saved ${data.feedOverrides?.saved ?? 0} intel feed override(s) on this server. ` +
          `File: ${data.feedOverrides?.path ?? "data/overrides/feeds.json"}. ` +
          "These beat shipped lib/intel-feeds.ts on load and intel pack refresh.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save overrides failed");
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const text = await file.text();
      const parsed = parseSourceImportJson(text);
      if (!parsed.layers.length) {
        throw new Error(parsed.warnings[0] || "No layers to import.");
      }
      const res = await apiFetch("/api/source-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ import: parsed.layers, refresh: true }),
      });
      const data = (await res.json()) as {
        error?: string;
        catalog?: CatalogResponse;
        state?: MonitorState;
        import?: { created: number; skipped: number; errors: string[] };
      };
      if (!res.ok) throw new Error(data.error || "Import failed");
      if (data.catalog) {
        setCatalog(data.catalog);
        setDrafts(mergeDrafts(data.catalog, loadSourceLibrary()));
      }
      if (data.state && onApplied) onApplied(data.state);
      const imp = data.import;
      const parts = [
        imp ? `Added ${imp.created} layer${imp.created === 1 ? "" : "s"}` : "Import finished",
        imp?.skipped ? `${imp.skipped} already present` : "",
        imp?.errors?.length ? `${imp.errors.length} failed` : "",
      ].filter(Boolean);
      const warn =
        parsed.warnings.length > 0
          ? ` · ${parsed.warnings.slice(0, 3).join(" ")}${parsed.warnings.length > 3 ? "…" : ""}`
          : "";
      setMessage(`${parts.join(", ")}.${warn}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  function importSummary(
    imp: { created: number; skipped: number; errors: string[] } | undefined,
    warnings: string[],
    title?: string | null,
  ) {
    const parts = [
      title ? title : "",
      imp ? `Added ${imp.created} layer${imp.created === 1 ? "" : "s"}` : "Import finished",
      imp?.skipped ? `${imp.skipped} already present` : "",
      imp?.errors?.length ? `${imp.errors.length} failed` : "",
    ].filter(Boolean);
    const warn =
      warnings.length > 0
        ? ` · ${warnings.slice(0, 3).join(" ")}${warnings.length > 3 ? "…" : ""}`
        : "";
    return `${parts.join(", ")}.${warn}`;
  }

  async function finishImport(res: Response) {
    const data = (await res.json()) as {
      error?: string;
      catalog?: CatalogResponse;
      state?: MonitorState;
      import?: { created: number; skipped: number; errors: string[] };
      opmlTitle?: string | null;
      warnings?: string[];
    };
    if (!res.ok) throw new Error(data.error || "Import failed");
    if (data.catalog) {
      setCatalog(data.catalog);
      setDrafts(mergeDrafts(data.catalog, loadSourceLibrary()));
    }
    if (data.state && onApplied) onApplied(data.state);
    setMessage(importSummary(data.import, data.warnings ?? [], data.opmlTitle));
    setShowOpml(false);
  }

  async function importOpmlUrl() {
    const url = opmlUrl.trim();
    if (!url) {
      setError("Paste an OPML URL, or choose an .opml file.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch("/api/source-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opmlUrl: url, refresh: true }),
      });
      await finishImport(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OPML import failed");
    } finally {
      setBusy(false);
    }
  }

  async function importOpmlFile(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (file.size > 1_000_000) throw new Error("That OPML file is larger than 1 MB.");
      const opml = await file.text();
      const res = await apiFetch("/api/source-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opml, refresh: true }),
      });
      await finishImport(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OPML import failed");
    } finally {
      setBusy(false);
      if (opmlFileRef.current) opmlFileRef.current.value = "";
    }
  }

  async function applyRows(ids: number[], refresh = true) {
    if (!ids.length) {
      setError("No changes to apply. Edit a layer and use Save layer, or mark changes first.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const batch = drafts.filter((row) => ids.includes(row.id));
      const res = await apiFetch("/api/source-catalog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refresh,
          updates: batch.map(draftPayload),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        catalog?: CatalogResponse;
        state?: MonitorState;
      };
      if (!res.ok) throw new Error(data.error || "Apply failed");
      const nextDrafts = Object.fromEntries(batch.map((d) => [d.id, d]));
      if (data.catalog) {
        setCatalog(data.catalog);
        setDrafts(mergeDrafts(data.catalog, { ...loadSourceLibrary(), ...nextDrafts }));
      }
      saveSourceLibrary(drafts);
      setDirty((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      if (data.state && onApplied) onApplied(data.state);
      setMessage(
        refresh
          ? `Saved ${ids.length} layer${ids.length === 1 ? "" : "s"} and refreshed.`
          : `Saved ${ids.length} layer${ids.length === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  }

  async function applyServer(refresh = true) {
    if (!dirty.size) {
      setError("No unsaved edits. Change a field, then Apply — or use Save layer on an open row.");
      return;
    }
    await applyRows([...dirty], refresh);
  }

  async function purgeOldItems(mode: "fixed" | "policy") {
    if (!window.confirm(mode === "fixed" ? `Delete items older than ${purgeDays} days?` : "Run per-layer retention policy now?")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body =
        mode === "fixed"
          ? { purge: { maxAgeDays: purgeDays }, refresh: false }
          : {
              retentionPolicy: { globalDefaultDays: defaultRetention },
              refresh: false,
            };
      const res = await apiFetch("/api/source-catalog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: string;
        catalog?: CatalogResponse;
        state?: MonitorState;
        purged?: number;
      };
      if (!res.ok) throw new Error(data.error || "Purge failed");
      if (data.catalog) {
        setCatalog(data.catalog);
        setDrafts(mergeDrafts(data.catalog, Object.fromEntries(drafts.map((d) => [d.id, d]))));
      }
      if (data.state && onApplied) onApplied(data.state);
      setMessage(`Removed ${data.purged ?? 0} stale items.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purge failed");
    } finally {
      setBusy(false);
    }
  }

  async function addLayer() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/source-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          create: {
            name: newLayer.name,
            url: newLayer.url,
            feedUrl: newLayer.feedUrl,
            description: newLayer.description || null,
            enabled: newLayer.enabled,
            retentionDays: defaultRetention,
          },
          refresh: true,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        catalog?: CatalogResponse;
        state?: MonitorState;
      };
      if (!res.ok) throw new Error(data.error || "Could not add layer");
      if (data.catalog) {
        setCatalog(data.catalog);
        setDrafts(mergeDrafts(data.catalog, loadSourceLibrary()));
      }
      if (data.state && onApplied) onApplied(data.state);
      setNewLayer({ name: "", url: "", feedUrl: "", description: "", enabled: true });
      setShowAdd(false);
      setMessage("Added layer and fetched items.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeLayer(id: number, name: string) {
    if (!window.confirm(`Delete layer “${name}” and all of its stored items?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/source-catalog?id=${id}`, { method: "DELETE" });
      const data = (await res.json()) as {
        error?: string;
        catalog?: CatalogResponse;
        state?: MonitorState;
      };
      if (!res.ok) throw new Error(data.error || "Delete failed");
      if (data.catalog) {
        setCatalog(data.catalog);
        setDrafts(mergeDrafts(data.catalog, loadSourceLibrary()));
      }
      if (expanded === id) setExpanded(null);
      setDirty((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (data.state && onApplied) onApplied(data.state);
      setMessage(`Deleted ${name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  function openPopout() {
    window.open("/sources/workbench", "_blank", "noopener,noreferrer,width=1100,height=820");
  }

  const summary = catalog?.summary;

  return (
    <div className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                <Layers className="size-4" />
                Source library
              </h2>
              <p className="mt-1 max-w-2xl text-[12px] text-slate-500">
                Layers live in SQLite. Apply edits, then <strong className="font-medium">Save instance overrides</strong>{" "}
                for intel feeds on this server (
                <code className="text-[11px]">data/overrides/feeds.json</code>). Export JSON for git or other hosts.
                Shipped: {catalog?.shippedFeedCount ?? "—"} · DB: {summary?.total ?? "—"}
                {catalog?.feedOverrides?.count
                  ? ` · overrides: ${catalog.feedOverrides.count}`
                  : ""}
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button size="xs" variant="outline" onClick={() => void load()}>
                <RefreshCw className="size-3" />
                Reload stats
              </Button>
              <Button size="xs" variant="outline" onClick={openPopout}>
                <ExternalLink className="size-3" />
                Pop out
              </Button>
            </div>
          </div>
        </div>

        {summary ? (
          <div className="grid gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:grid-cols-5">
            {[
              ["Layers", summary.total],
              ["Enabled", summary.enabled],
              ["Stale fetch", summary.stale],
              ["Silent", summary.silent],
              ["Items 24h", summary.itemsLast24h],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
                <div className="text-[16px] font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {summary?.suggestions.length ? (
          <ul className="border-b border-amber-100 bg-amber-50/90 px-4 py-2 text-[11px] text-amber-950">
            {summary.suggestions.map((tip) => (
              <li key={tip} className="list-disc ml-4">
                {tip}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-100 px-3 py-1.5 text-[11px]">
          <span className="mr-0.5 font-medium text-slate-600">Retention</span>
          <label className="inline-flex items-center gap-1 text-slate-500">
            Purge older than
            <input
              type="number"
              min={1}
              aria-label="Purge items older than days"
              className="h-6 w-11 rounded-md border border-slate-200 bg-white px-1 text-center text-[11px] tabular-nums text-slate-900 dark:border-input dark:bg-background dark:text-foreground"
              value={purgeDays}
              onChange={(e) => setPurgeDays(Math.max(1, Number(e.target.value) || 30))}
            />
            d
          </label>
          <Button
            size="xs"
            variant="outline"
            disabled={busy}
            title="Count items that would be removed"
            onClick={() => void load()}
          >
            Preview {summary?.purgePreviewCount != null ? `· ${summary.purgePreviewCount}` : ""}
          </Button>
          <Button
            size="xs"
            variant="outline"
            disabled={busy}
            title="Delete items older than the age above"
            onClick={() => void purgeOldItems("fixed")}
          >
            Purge
          </Button>
          <span className="mx-0.5 hidden text-slate-300 sm:inline" aria-hidden>
            |
          </span>
          <label className="inline-flex items-center gap-1 text-slate-500">
            Default
            <input
              type="number"
              min={0}
              aria-label="Default retention days"
              className="h-6 w-11 rounded-md border border-slate-200 bg-white px-1 text-center text-[11px] tabular-nums text-slate-900 dark:border-input dark:bg-background dark:text-foreground"
              value={defaultRetention ?? ""}
              placeholder="—"
              onChange={(e) => {
                const v = e.target.value.trim();
                persistDefaultRetention(v === "" ? null : Math.max(0, Number(v) || 0));
              }}
            />
            d
          </label>
          <Button
            size="xs"
            variant="outline"
            disabled={busy || !defaultRetention}
            title="Purge using each layer’s retention or the default"
            onClick={() => void purgeOldItems("policy")}
          >
            Apply policy
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-1.5">
          <Button size="xs" variant="outline" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="size-3" />
            Add RSS layer
          </Button>
          <Input
            className="h-6 max-w-[200px] text-[11px]"
            placeholder="Search layers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="h-6 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-900 dark:border-input dark:bg-background dark:text-foreground"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">All layers</option>
            <option value="enabled">Enabled only</option>
            <option value="stale">Stale fetch (24h+)</option>
            <option value="silent">Silent (0 items)</option>
            <option value="custom">Not in shipped catalog</option>
          </select>
          <div className="ml-auto flex flex-wrap gap-1">
            <Button size="xs" variant="outline" disabled={busy} onClick={saveLocal}>
              <Save className="size-3" />
              Save locally
            </Button>
            <Button size="xs" variant="outline" disabled={busy} onClick={exportFile}>
              <Download className="size-3" />
              Export JSON
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file);
              }}
            />
            <Button
              size="xs"
              variant="outline"
              disabled={busy}
              title="Import Export JSON or a list of RSS layers from another csmon"
              onClick={() => importInputRef.current?.click()}
            >
              Import JSON
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={busy}
              title="Import an OPML subscription list from a URL or a file"
              onClick={() => setShowOpml((open) => !open)}
            >
              Import OPML
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={busy}
              title="Write intel-layer edits to data/overrides/feeds.json on this server"
              onClick={() => void saveInstanceOverrides()}
            >
              <Save className="size-3" />
              Save instance overrides
            </Button>
            <Button size="xs" variant="outline" disabled={busy} onClick={() => void applyServer(false)}>
              Apply (no refresh)
            </Button>
            <Button size="xs" disabled={busy} onClick={() => void applyServer(true)}>
              <Upload className="size-3" />
              Apply & refresh
            </Button>
          </div>
        </div>

        {showOpml ? (
          <div className="border-b border-slate-100 bg-white px-4 py-3">
            <p className="text-[11px] font-medium text-slate-700">OPML subscription list</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Paste a list URL, such as https://threatfilter.dev/feeds.opml, or choose an .opml file.
              New feeds are enabled and fetched. Feeds already in the library stay as they are.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                className="h-8 min-w-[16rem] flex-1 text-[12px]"
                placeholder="https://threatfilter.dev/feeds.opml"
                value={opmlUrl}
                onChange={(e) => setOpmlUrl(e.target.value)}
              />
              <Button size="xs" disabled={busy} onClick={() => void importOpmlUrl()}>
                Import URL & fetch
              </Button>
              <input
                ref={opmlFileRef}
                type="file"
                accept=".opml,text/x-opml,application/xml,text/xml,.xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importOpmlFile(file);
                }}
              />
              <Button
                size="xs"
                variant="outline"
                disabled={busy}
                onClick={() => opmlFileRef.current?.click()}
              >
                Choose file
              </Button>
              <Button size="xs" variant="outline" onClick={() => setShowOpml(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {showAdd ? (
          <div className="border-b border-slate-100 bg-white px-4 py-3">
            <p className="text-[11px] font-medium text-slate-700">New RSS layer</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Input
                className="h-8 text-[12px]"
                placeholder="Display name"
                value={newLayer.name}
                onChange={(e) => setNewLayer((n) => ({ ...n, name: e.target.value }))}
              />
              <Input
                className="h-8 text-[12px]"
                placeholder="Site URL (https://…)"
                value={newLayer.url}
                onChange={(e) => setNewLayer((n) => ({ ...n, url: e.target.value }))}
              />
              <Input
                className="col-span-full h-8 text-[12px]"
                placeholder="Feed URL (https://…/rss.xml)"
                value={newLayer.feedUrl}
                onChange={(e) => setNewLayer((n) => ({ ...n, feedUrl: e.target.value }))}
              />
              <Input
                className="col-span-full h-8 text-[12px]"
                placeholder="Short description (optional)"
                value={newLayer.description}
                onChange={(e) => setNewLayer((n) => ({ ...n, description: e.target.value }))}
              />
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="xs" disabled={busy} onClick={() => void addLayer()}>
                Add & fetch
              </Button>
              <Button size="xs" variant="outline" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {error ? <p className="px-4 py-2 text-[12px] text-red-600">{error}</p> : null}
        {message ? <p className="px-4 py-2 text-[12px] text-emerald-800">{message}</p> : null}

        <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 bg-white text-left text-slate-500">
              <tr>
                <th className="px-2 py-1.5 font-medium">On</th>
                <th className="px-2 py-1.5 font-medium">Layer</th>
                <th className="px-2 py-1.5 font-medium">Type</th>
                <th className="px-2 py-1.5 font-medium">Origin</th>
                <th className="px-2 py-1.5 font-medium">Last fetch</th>
                <th className="px-2 py-1.5 font-medium">Items</th>
                <th className="px-2 py-1.5 font-medium">Latest</th>
                <th className="px-2 py-1.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {grouped.map(([category, rows]) => (
                <Fragment key={`group-${category}`}>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={8} className="px-2 py-1">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600"
                      aria-expanded={!collapsed.has(category)}
                      onClick={() =>
                        setCollapsed((prev) => {
                          const next = new Set(prev);
                          if (next.has(category)) next.delete(category);
                          else next.add(category);
                          return next;
                        })
                      }
                    >
                      <span aria-hidden>{collapsed.has(category) ? "▸" : "▾"}</span>
                      {category}
                      <span className="font-normal normal-case text-slate-400">
                        {rows.length} layer{rows.length === 1 ? "" : "s"}
                      </span>
                    </button>
                  </td>
                </tr>
              {collapsed.has(category) ? null : rows.map((row) => {
                const cat = catalog?.rows.find((r) => r.id === row.id);
                const isOpen = expanded === row.id;
                const isDirty = dirty.has(row.id);
                return (
                  <Fragment key={row.id}>
                  <tr className="border-t border-slate-100 align-top">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) => patchDraft(row.id, { enabled: e.target.checked })}
                      />
                    </td>
                    <td className="max-w-[200px] px-2 py-2">
                      <div className="font-medium text-slate-900">
                        {isDirty ? <span className="mr-1 text-amber-600">●</span> : null}
                        {row.name}
                      </div>
                      <div className="truncate text-[10px] text-slate-400">{row.key}</div>
                      {cat?.silent ? (
                        <span className="mt-0.5 inline-block rounded bg-rose-100 px-1 text-[9px] text-rose-800">
                          silent
                        </span>
                      ) : null}
                      {cat?.stale ? (
                        <span className="mt-0.5 ml-1 inline-block rounded bg-amber-100 px-1 text-[9px] text-amber-900">
                          stale
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-slate-700">{SOURCE_TYPE_LABEL[rowType(row)]}</td>
                    <td className="px-2 py-2 text-slate-600">{row.primaryReason}</td>
                    <td className="whitespace-nowrap px-2 py-2 tabular-nums text-slate-600">
                      {relTime(cat?.lastFetchedAt ?? null)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                      {cat?.itemsLast24h ?? 0} / {cat?.itemCount ?? 0}
                    </td>
                    <td className="max-w-[180px] px-2 py-2">
                      <div className="truncate text-slate-700" title={cat?.latestTitle ?? ""}>
                        {cat?.latestTitle ?? "—"}
                      </div>
                      <div className="text-[10px] text-slate-400">{relTime(cat?.latestItemAt ?? null)}</div>
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        size="xs"
                        variant="ghost"
                        className="h-7 text-[10px]"
                        onClick={() => setExpanded(isOpen ? null : row.id)}
                      >
                        {isOpen ? "Close" : "Edit"}
                      </Button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr key={`${row.id}-edit`} className="border-t border-slate-100 bg-slate-50/80">
                      <td colSpan={8} className="px-2 py-2">
                        <EditorPanel
                          draft={row}
                          categories={categories}
                          busy={busy}
                          defaultRetention={defaultRetention}
                          onChange={(patch) => patchDraft(row.id, patch)}
                          onSave={(refresh) => void applyRows([row.id], refresh)}
                          onDelete={() => void removeLayer(row.id, row.name)}
                        />
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                );
              })}
                </Fragment>
              ))}
            </tbody>
          </table>
          {!filtered.length && !error ? (
            <p className="p-4 text-center text-[12px] text-slate-500">No layers match this filter.</p>
          ) : null}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-[10px] text-slate-500">
          Refine mining: disable silent layers, fix broken feed URLs, assign packs for intel feeds before
          export. Reference ids in shipped catalog: {INTEL_FEEDS.length} entries in{" "}
          <code>lib/intel-feeds.ts</code>.
        </div>
    </div>
  );
}

export function SourceWorkbench({
  open,
  onOpenChange,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: (state: MonitorState) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none">
        {open ? <SourceWorkbenchBody onApplied={onApplied} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EditorPanel({
  draft,
  categories,
  onChange,
  onSave,
  onDelete,
  busy,
  defaultRetention,
}: {
  draft: LocalSourceDraft;
  categories: string[];
  onChange: (patch: Partial<LocalSourceDraft>) => void;
  onSave: (refresh: boolean) => void;
  onDelete: () => void;
  busy: boolean;
  defaultRetention: number | null;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-[10px] font-medium text-slate-600">
          Display name
          <Input
            className="mt-0.5 h-8 text-[12px]"
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </label>
        <label className="block text-[10px] font-medium text-slate-600">
          Intel id (for GitHub export)
          <Input
            className="mt-0.5 h-8 text-[12px]"
            value={draft.intelId ?? ""}
            onChange={(e) => onChange({ intelId: e.target.value || null })}
            placeholder="bbc-world"
          />
        </label>
        <label className="block text-[10px] font-medium text-slate-600 sm:col-span-2">
          Site URL
          <Input
            className="mt-0.5 h-8 text-[12px]"
            value={draft.url}
            onChange={(e) => onChange({ url: e.target.value })}
          />
        </label>
        <label className="block text-[10px] font-medium text-slate-600 sm:col-span-2">
          Feed URL
          <Input
            className="mt-0.5 h-8 text-[12px]"
            value={draft.feedUrl ?? ""}
            onChange={(e) => onChange({ feedUrl: e.target.value || null })}
          />
        </label>
        <label className="block text-[10px] font-medium text-slate-600">
          Category
          <Input
            className="mt-0.5 h-8 text-[12px]"
            list={`workbench-categories-${draft.id}`}
            value={draft.category ?? ""}
            placeholder={draft.shownCategory ?? "Derived from pack"}
            onChange={(e) => onChange({ category: e.target.value || null })}
          />
          <datalist id={`workbench-categories-${draft.id}`}>
            {categories.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label className="block text-[10px] font-medium text-slate-600">
          Type
          <select
            className="mt-0.5 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px]"
            value={draft.sourceType ?? ""}
            onChange={(e) => onChange({ sourceType: (e.target.value || null) as SourceType | null })}
          >
            <option value="">
              Automatic{draft.shownType ? ` (${SOURCE_TYPE_LABEL[draft.shownType]})` : ""}
            </option>
            {SOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {SOURCE_TYPE_LABEL[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] font-medium text-slate-600 sm:col-span-2">
          Blurb / description
          <Input
            className="mt-0.5 h-8 text-[12px]"
            value={draft.description ?? ""}
            onChange={(e) => onChange({ description: e.target.value || null })}
          />
        </label>
        <label className="block text-[10px] font-medium text-slate-600">
          Retention (days, empty = board default
          {defaultRetention != null ? ` ${defaultRetention}d` : ""})
          <Input
            type="number"
            min={0}
            className="mt-0.5 h-8 text-[12px]"
            value={draft.retentionDays ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              onChange({ retentionDays: v === "" ? null : Math.max(0, Number(v) || 0) });
            }}
            placeholder="default"
          />
        </label>
        <label className="block text-[10px] font-medium text-slate-600">
          Pack (export to intel-feeds)
          <select
            className="mt-0.5 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px]"
            value={draft.pack ?? ""}
            onChange={(e) =>
              onChange({ pack: (e.target.value || null) as IntelPack | null })
            }
          >
            <option value="">— custom layer —</option>
            {PACKS.map((pack) => (
              <option key={pack} value={pack}>
                {pack}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] font-medium text-slate-600 sm:col-span-2">
          Your notes (local + export only)
          <textarea
            className="mt-0.5 min-h-[56px] w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px]"
            value={draft.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Why this feed, region focus, suggested pack changes…"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="xs" disabled={busy} onClick={() => onSave(false)}>
          Save layer
        </Button>
        <Button size="xs" variant="outline" disabled={busy} onClick={() => onSave(true)}>
          Save & refresh layer
        </Button>
        <Button size="xs" variant="outline" disabled={busy} onClick={onDelete}>
          <Trash2 className="size-3" />
          Delete layer
        </Button>
      </div>
    </div>
  );
}

