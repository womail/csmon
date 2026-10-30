"use client";

import { useState, type ReactNode } from "react";
import { Copy, Link2 } from "lucide-react";
import { FacetChip, FACET_ICON } from "@/components/monitor/facet-chip";
import { Tip } from "@/components/monitor/tip";
import { connectionTip, type Connection, type RefKind } from "@/lib/connections";
import { facetsToSearchLine, type Facet, type FacetInput, type FacetKind } from "@/lib/facets";
import { SOURCE_TYPE_LABEL, isSourceType } from "@/lib/source-types";

const REF_FACET: Record<RefKind, FacetKind> = {
  topic: "topic",
  place: "place",
  person: "person",
  org: "org",
  vendor: "vendor",
  cve: "cve",
  category: "category",
  stype: "stype",
};

function connectionLabel(row: Connection) {
  if (row.kind === "stype" && isSourceType(row.value)) return SOURCE_TYPE_LABEL[row.value];
  return row.value;
}

/** Every active constraint as one removable chip, plus Clear and Copy as search line. */
export function ActiveFacetRow({
  facets,
  onRemove,
  onClear,
  leading,
  trailing,
  connections = [],
  onAddFacet,
}: {
  facets: Facet[];
  onRemove: (facet: Facet) => void;
  onClear: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  connections?: Connection[];
  onAddFacet?: (facet: FacetInput) => void;
}) {
  const [copied, setCopied] = useState(false);
  const line = facetsToSearchLine(facets);
  if (!facets.length && !leading && !trailing) return null;
  return (
    <>
      <div className="filter-chip-row filter-chip-row-applied" role="group" aria-label="Active filters">
        <span className="filter-chip-row-label">Active</span>
        {leading}
        {facets.map((facet) => (
          <FacetChip key={`${facet.from}-${facet.token}`} facet={facet} onRemove={() => onRemove(facet)} />
        ))}
        {trailing}
        {facets.length ? (
          <>
            <Tip text="Remove every filter. Desk, range, and an open dossier stay.">
              <button type="button" className="filter-chip filter-chip-toggle" onClick={onClear}>
                <span className="filter-chip-label">Clear {facets.length}</span>
              </button>
            </Tip>
            {line ? (
              <Tip text={copied ? "Copied" : `Copy as search line:\n${line}`}>
                <button
                  type="button"
                  className="filter-chip filter-chip-toggle inline-flex items-center gap-0.5"
                  aria-label="Copy as search line"
                  onClick={() => {
                    void navigator.clipboard?.writeText(line).then(() => {
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1500);
                    });
                  }}
                >
                  <Copy className="size-2.5" aria-hidden />
                </button>
              </Tip>
            ) : null}
          </>
        ) : null}
      </div>
      {connections.length && onAddFacet ? (
        <div className="filter-chip-row often-with-row" role="group" aria-label="Often with">
          <span className="filter-chip-row-label">
            <Link2 className="size-3" aria-hidden />
            Often with
          </span>
          {connections.map((row) => {
            const kind = REF_FACET[row.kind];
            const Icon = FACET_ICON[kind];
            const label = connectionLabel(row);
            return (
              <Tip key={`${row.kind}:${row.value}`} text={`${connectionTip(row, label)}\nClick to add · Alt+click or right-click to exclude.`}>
                <button
                  type="button"
                  className="filter-chip filter-chip-toggle often-with-chip"
                  onClick={(event) => onAddFacet({ kind, value: row.value, negate: event.altKey || undefined })}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    onAddFacet({ kind, value: row.value, negate: true });
                  }}
                >
                  <Icon className="size-2.5 shrink-0 opacity-70" aria-hidden />
                  <span className="filter-chip-label">{label}</span>
                  <span className="often-with-lift">{row.lift.toFixed(1)}×</span>
                </button>
              </Tip>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
