"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { OsvSummary } from "@/lib/vuln-intel";

/** Open-source packages and fixed versions from OSV.dev for the CVEs this story names. */
export function OsvPanel({ cveKey, onFollow }: { cveKey: string; onFollow: (url: string) => void }) {
  const [loaded, setLoaded] = useState<{ key: string; entries: OsvSummary[] } | null>(null);
  const entries = loaded?.key === cveKey ? loaded.entries : null;

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/osv?cves=${encodeURIComponent(cveKey)}`)
      .then(async (res) => {
        const data = (await res.json()) as { entries?: OsvSummary[] };
        if (!cancelled) setLoaded({ key: cveKey, entries: res.ok ? (data.entries ?? []) : [] });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key: cveKey, entries: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [cveKey]);

  const withPackages = (entries ?? []).filter((row) => row.packages.length > 0);
  if (entries === null) {
    return <p className="mt-3 text-[11px] text-slate-500">Checking OSV for open-source packages…</p>;
  }
  if (!withPackages.length) return null;

  return (
    <section className="mt-4 rounded-md border border-slate-200 p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          Open-source packages (OSV)
        </h3>
        <span className="text-[10px] text-slate-400">ecosystem · package · fixed in</span>
      </div>
      {withPackages.map((entry) => (
        <div key={entry.cve} className="mt-2">
          <p className="text-[11px] text-slate-700">
            <span className="font-mono">{entry.cve}</span>
            {entry.severity ? <span className="ml-1.5 text-[10px] text-rose-700">{entry.severity}</span> : null}
            {entry.summary ? <span className="ml-1.5 text-slate-500">{entry.summary}</span> : null}
          </p>
          <table className="mt-1 w-full text-[11px]">
            <tbody>
              {entry.packages.map((pkg) => (
                <tr key={`${pkg.ecosystem}:${pkg.name}`} className="border-t border-slate-100 align-top">
                  <td className="py-0.5 pr-2 text-slate-500">{pkg.ecosystem}</td>
                  <td className="py-0.5 pr-2 font-mono break-all text-slate-800">{pkg.name}</td>
                  <td className="py-0.5 text-emerald-700">
                    {pkg.fixed.length ? pkg.fixed.join(", ") : `no fix · last affected ${pkg.lastAffected.join(", ")}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px]">
            {entry.ids.map((id) => (
              <button
                key={id}
                type="button"
                className="text-sky-700 hover:underline"
                onClick={() => onFollow(`https://osv.dev/vulnerability/${id}`)}
              >
                osv.dev/{id}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
