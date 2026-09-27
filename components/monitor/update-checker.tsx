"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { loadOptions, saveOptions } from "@/lib/options";

type UpdateInfo = {
  current: string;
  latest: string | null;
  newer: boolean;
  repo: string | null;
  releaseUrl: string | null;
  publishedAt?: string | null;
  commit?: string | null;
  source?: "manifest" | "github" | "none";
  manifestUrl?: string | null;
  notes?: string;
  apply?: string;
  docker?: { composeHint?: string; image?: string };
  error?: string;
};

function updateQuery(manifestUrl: string) {
  if (!manifestUrl.trim()) return "/api/update";
  return `/api/update?manifestUrl=${encodeURIComponent(manifestUrl.trim())}`;
}

/** Check-only comparison against a manifest URL and/or GitHub releases. */
export function UpdateChecker() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manifestDraft, setManifestDraft] = useState("");

  useEffect(() => {
    setManifestDraft(loadOptions().updateManifestUrl);
  }, []);

  async function check(manifestUrl?: string) {
    setBusy(true);
    setError(null);
    try {
      const url = updateQuery(manifestUrl ?? loadOptions().updateManifestUrl);
      const res = await apiFetch(url);
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

  function saveManifestUrl() {
    const opts = loadOptions();
    saveOptions({ ...opts, updateManifestUrl: manifestDraft.trim() });
    void check(manifestDraft.trim());
  }

  const status = info
    ? info.newer
      ? `Update available: ${info.current} → ${info.latest}`
      : info.latest
        ? `This instance is ${info.current} (latest ${info.latest})`
        : `This instance is ${info.current}`
    : "Check your manifest or GitHub for a newer release.";

  const sourceLabel =
    info?.source === "manifest"
      ? "Custom manifest"
      : info?.source === "github"
        ? "GitHub release"
        : null;

  return (
    <div className="rounded-md border border-slate-200 p-2">
      <div className="text-[11px] font-medium text-slate-600">Application updates</div>
      <p className="mt-1 text-[12px] text-slate-600">{status}</p>
      {sourceLabel ? (
        <p className="mt-0.5 text-[10px] text-slate-500">
          Source: {sourceLabel}
          {info?.manifestUrl ? ` · ${info.manifestUrl.replace(/^https?:\/\//, "")}` : null}
        </p>
      ) : null}
      {error ? <p className="mt-1 text-[12px] text-red-600">{error}</p> : null}
      <label className="mt-2 block text-[10px] font-medium text-slate-600">
        Update manifest URL (optional)
        <Input
          className="mt-1 h-8 text-[11px]"
          placeholder="https://csmon.example.com/csmon-update.json"
          value={manifestDraft}
          onChange={(e) => setManifestDraft(e.target.value)}
        />
      </label>
      <p className="mt-1 text-[10px] text-slate-500">
        Host a static JSON (see <code className="text-[9px]">public/csmon-update.example.json</code>
        ). Server env <code className="text-[9px]">CSMON_UPDATE_MANIFEST_URL</code> is the default;
        your URL here must match the maintainer&apos;s allowed domain suffix.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="xs" variant="outline" disabled={busy} onClick={() => void check()}>
          {busy ? "Checking…" : "Check now"}
        </Button>
        <Button size="xs" variant="outline" disabled={busy} onClick={saveManifestUrl}>
          Save URL & check
        </Button>
        {info?.releaseUrl ? (
          <a
            className="self-center text-[12px] text-slate-700 underline"
            href={info.releaseUrl}
            target="_blank"
            rel="noreferrer"
          >
            Release notes
          </a>
        ) : info?.repo ? (
          <a className="self-center text-[12px] text-slate-700 underline" href={info.repo} target="_blank" rel="noreferrer">
            Repository
          </a>
        ) : null}
      </div>
      {info?.apply ? (
        <p className="mt-2 text-[11px] text-slate-600">
          <span className="font-medium">Apply on the host:</span> {info.apply}
        </p>
      ) : null}
      {info?.docker?.composeHint ? (
        <p className="mt-1 font-mono text-[10px] text-slate-500">{info.docker.composeHint}</p>
      ) : null}
      <p className="mt-2 text-[11px] text-slate-500">
        The app never self-patches over HTTP. Use <code className="text-[10px]">scripts/update.sh docker</code>{" "}
        or your compose rebuild on the machine that runs the container.
      </p>
    </div>
  );
}
