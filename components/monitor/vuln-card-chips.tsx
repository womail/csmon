"use client";

import { Tip } from "@/components/monitor/tip";
import { epssLabel, epssTone, type EpssScore } from "@/lib/vuln-intel";

const EPSS_STYLE = {
  hot: { background: "#fee2e2", color: "#991b1b" },
  warm: { background: "#fef3c7", color: "#92400e" },
  cool: { background: "#f1f5f9", color: "#475569" },
} as const;

export function VulnCardChips({
  cves,
  kevCveIds,
  epss,
  onCve,
}: {
  cves: string[];
  kevCveIds: ReadonlySet<string>;
  epss: ReadonlyMap<string, EpssScore>;
  onCve?: (cve: string) => void;
}) {
  if (!cves.length) return null;

  return (
    <div className="vuln-card-chips mt-1 flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}>
      {cves.map((cve) => {
        const inKev = kevCveIds.has(cve);
        const score = epss.get(cve);
        return (
          <span key={cve} className="inline-flex flex-wrap items-center gap-0.5">
            <Tip text={inKev ? `${cve} — on CISA KEV. Click to search / open patch context.` : `Filter board to ${cve}`}>
              <button
                type="button"
                className="tag font-mono text-[10px]"
                style={{ background: "#f1f5f9", color: "#0f172a" }}
                onClick={() => onCve?.(cve)}
              >
                {cve}
              </button>
            </Tip>
            {inKev ? (
              <Tip text="Listed in CISA Known Exploited Vulnerabilities">
                <span className="tag text-[10px] font-semibold" style={{ background: "#7f1d1d", color: "#fff" }}>
                  KEV
                </span>
              </Tip>
            ) : null}
            {score ? (
              <Tip
                text={`FIRST EPSS ${score.date}: ${(score.epss * 100).toFixed(2)}% exploitation probability (30d) · percentile ${(score.percentile * 100).toFixed(1)}`}
              >
                <span className="tag text-[10px]" style={EPSS_STYLE[epssTone(score)]}>
                  {epssLabel(score)}
                </span>
              </Tip>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
