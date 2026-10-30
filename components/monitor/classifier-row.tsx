"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

type Status = { pending: number; version: number };

/** Options → Data: classifier version, items waiting for a re-score, and a button to finish now. */
export function ClassifierRow() {
  const [status, setStatus] = useState<Status | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiFetch("/api/items/reclassify-all")
      .then((res) => (res.ok ? (res.json() as Promise<Status>) : null))
      .then((data) => {
        if (!cancelled && data) setStatus(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function rescore() {
    setRunning(true);
    let changed = 0;
    let updated = 0;
    try {
      for (let round = 0; round < 60; round += 1) {
        const res = await apiFetch("/api/items/reclassify-all", { method: "POST" });
        if (!res.ok) throw new Error(`Re-score failed (${res.status})`);
        const data = (await res.json()) as { updated: number; changed: number; remaining: number; version: number };
        updated += data.updated;
        changed += data.changed;
        setProgress(`${updated.toLocaleString()} re-scored · ${changed.toLocaleString()} changed · ${data.remaining.toLocaleString()} left`);
        setStatus({ pending: data.remaining, version: data.version });
        if (data.remaining === 0 || data.updated === 0) break;
      }
    } catch (error) {
      setProgress(error instanceof Error ? error.message : "Re-score failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
      <p className="text-[11px] font-medium text-slate-900">Classifier</p>
      <p className="mt-1 text-[10px] leading-snug text-slate-600">
        {status == null
          ? "Checking stored items…"
          : status.pending > 0
            ? `Version ${status.version} · ${status.pending.toLocaleString()} items waiting. The server re-scores 2,000 a minute.`
            : `All items use classifier version ${status.version}. Topics you set by hand stay as you left them.`}
      </p>
      {status && status.pending > 0 ? (
        <button
          type="button"
          disabled={running}
          onClick={() => void rescore()}
          className="mt-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium hover:bg-slate-100 disabled:opacity-50"
        >
          {running ? "Re-scoring…" : "Re-score now"}
        </button>
      ) : null}
      {progress ? <p className="mt-1 text-[10px] text-slate-500">{progress}</p> : null}
    </div>
  );
}
