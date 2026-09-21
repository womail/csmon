"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

type UpdateInfo = {
  current: string;
  latest: string | null;
  newer: boolean;
  repo: string;
  releaseUrl: string | null;
  notes?: string;
  apply?: string;
  error?: string;
};

export function UpdateChecker() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/update");
      const data = (await res.json()) as UpdateInfo;
      if (!res.ok) throw new Error(data.error || "Update check failed");
      setInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update check failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = info
    ? info.newer
      ? `Update available: ${info.current} → ${info.latest}`
      : info.latest
        ? `This instance is ${info.current} (latest ${info.latest})`
        : `This instance is ${info.current}`
    : "Check GitHub for a newer csmon release.";

  return (
    <div className="rounded-md border border-slate-200 p-2">
      <div className="text-[11px] font-medium text-slate-600">Application updates</div>
      <p className="mt-1 text-[12px] text-slate-600">{status}</p>
      {error ? <p className="mt-1 text-[12px] text-red-600">{error}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="xs" variant="outline" disabled={busy} onClick={() => void check()}>
          {busy ? "Checking…" : "Check now"}
        </Button>
        {info?.releaseUrl ? (
          <a
            className="text-[12px] text-slate-700 underline"
            href={info.releaseUrl}
            target="_blank"
            rel="noreferrer"
          >
            Release notes
          </a>
        ) : info?.repo ? (
          <a className="text-[12px] text-slate-700 underline" href={info.repo} target="_blank" rel="noreferrer">
            Repository
          </a>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Apply with <code>scripts/update.sh</code> or <code>scripts/update.sh docker</code>. The app never
        self-patches over HTTP.
      </p>
    </div>
  );
}
