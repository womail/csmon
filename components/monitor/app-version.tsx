"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { APP_VERSION } from "@/lib/version";

type VersionInfo = {
  version: string;
  commit: string;
  buildDate: string;
};

/** Shows running semver and build metadata in Options. */
export function AppVersionLine() {
  const [info, setInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    apiFetch("/api/version")
      .then(async (res) => {
        const data = (await res.json()) as VersionInfo;
        if (res.ok) setInfo(data);
      })
      .catch(() => undefined);
  }, []);

  const version = info?.version ?? APP_VERSION;
  const commit = info?.commit ?? "…";
  const buildDate = info?.buildDate ?? "…";

  return (
    <p className="text-[11px] text-slate-500">
      Running <span className="font-medium text-slate-700">csmon {version}</span>
      {commit !== "unknown" ? (
        <>
          {" "}
          · build <span className="font-mono text-[10px]">{commit}</span>
        </>
      ) : null}
      {buildDate !== "1970-01-01" ? <> · {buildDate}</> : null}
    </p>
  );
}
