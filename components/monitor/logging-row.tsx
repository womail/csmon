"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type LogRow = {
  id: number;
  at: number;
  level: "info" | "warn" | "error";
  scope: string;
  message: string;
  detail: unknown;
};

type LogState = {
  enabled: boolean;
  count: number;
  logs: LogRow[];
};

function when(at: number) {
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function levelClass(level: LogRow["level"]) {
  if (level === "error") return "text-rose-700";
  if (level === "warn") return "text-amber-800";
  return "text-slate-600";
}

export function LoggingRow() {
  const [state, setState] = useState<LogState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<number>>(() => new Set());

  const load = useCallback(async () => {
    const res = await apiFetch("/api/logs?limit=200");
    const data = (await res.json()) as LogState & { error?: string };
    if (!res.ok) throw new Error(data.error || "Could not load logs");
    setState({ enabled: data.enabled, count: data.count, logs: data.logs });
    setPicked((prev) => {
      const ids = new Set(data.logs.map((row) => row.id));
      return new Set([...prev].filter((id) => ids.has(id)));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Could not load logs");
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!state?.enabled) return;
    const id = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(id);
  }, [load, state?.enabled]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logging request failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(enabled: boolean) {
    await run(async () => {
      const res = await apiFetch("/api/logs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = (await res.json()) as LogState & { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not update logging");
      setState({ enabled: data.enabled, count: data.count, logs: data.logs });
    });
  }

  async function remove(ids?: number[]) {
    await run(async () => {
      const res = await apiFetch("/api/logs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids?.length ? { ids } : {}),
      });
      const data = (await res.json()) as LogState & { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not delete logs");
      setState({ enabled: data.enabled, count: data.count, logs: data.logs });
      setPicked(new Set());
    });
  }

  function toggleRow(id: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
      <p className="text-[11px] font-medium text-slate-900">Logging</p>
      <p className="mt-1 text-[10px] leading-snug text-slate-600">
        Off by default. When on, the server records refreshes, scheduler ticks, source edits, intel
        packs, and classifier runs. Oldest rows drop after 2,000.
      </p>
      <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-700">
        <input
          type="checkbox"
          checked={state?.enabled === true}
          disabled={busy || state == null}
          onChange={(event) => void toggle(event.target.checked)}
        />
        Record updates and internal activity
      </label>
      {state ? (
        <p className="mt-1 text-[10px] text-slate-500">
          {state.count} stored row{state.count === 1 ? "" : "s"}
          {state.enabled ? " · refreshing every few seconds" : ""}
        </p>
      ) : (
        <p className="mt-1 text-[10px] text-slate-500">Checking…</p>
      )}
      {state?.logs.length ? (
        <ul className="mt-2 max-h-44 space-y-1 overflow-auto rounded border border-slate-200 bg-white p-1.5 font-mono text-[10px] leading-snug">
          {state.logs.map((row) => (
            <li key={row.id} className="flex items-start gap-1.5">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={picked.has(row.id)}
                onChange={() => toggleRow(row.id)}
                aria-label={`Select log ${row.id}`}
              />
              <span className="min-w-0">
                <span className="text-slate-400">{when(row.at)}</span>{" "}
                <span className={levelClass(row.level)}>{row.level}</span>{" "}
                <span className="text-slate-500">{row.scope}</span>{" "}
                <span className="text-slate-800">{row.message}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : state ? (
        <p className="mt-2 text-[10px] text-slate-500">
          {state.enabled ? "No rows yet — refresh a layer or wait for the next scheduler tick." : "No stored rows."}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1">
        <Button size="xs" variant="outline" disabled={busy} onClick={() => void load()}>
          Reload
        </Button>
        <Button
          size="xs"
          variant="outline"
          disabled={busy || picked.size === 0}
          onClick={() => void remove([...picked])}
        >
          Delete selected{picked.size ? ` · ${picked.size}` : ""}
        </Button>
        <Button
          size="xs"
          variant="outline"
          disabled={busy || !state?.count}
          onClick={() => {
            if (window.confirm("Delete every stored diagnostic log?")) void remove();
          }}
        >
          Delete all logs
        </Button>
      </div>
      {error ? <p className="mt-1 text-[10px] text-rose-700">{error}</p> : null}
    </div>
  );
}
