"use client";

import { FamilyDot } from "@/components/monitor/cards";
import { Tip } from "@/components/monitor/tip";
import { TOPIC_FAMILIES, type FamilyId } from "@/lib/topic-families";

/** One glance at the shape of the range: items per family with the change from the previous window. */
export function FamiliesStrip({
  current,
  previous,
  active,
  onFamily,
}: {
  current: Map<FamilyId, number>;
  /** Same-length window before the range; null when the range is "all". */
  previous: Map<FamilyId, number> | null;
  active: FamilyId[];
  onFamily: (id: FamilyId) => void;
}) {
  const rows = TOPIC_FAMILIES.map((family) => ({ family, count: current.get(family.id) ?? 0 })).filter((row) => row.count > 0);
  if (!rows.length) return null;
  return (
    <div className="families-strip" role="group" aria-label="Families">
      {rows.map(({ family, count }) => {
        const before = previous?.get(family.id) ?? 0;
        const delta = previous ? count - before : 0;
        const on = active.includes(family.id);
        return (
          <Tip
            key={family.id}
            text={`${family.label}: ${count} items${previous ? ` · ${before} in the previous window` : ""}\nClick to ${on ? "remove" : "add"} the ${family.label} filter.`}
          >
            <button
              type="button"
              className="families-strip-cell"
              aria-pressed={on}
              style={on ? { boxShadow: `inset 0 0 0 1px var(${family.tone})` } : undefined}
              onClick={() => onFamily(family.id)}
            >
              <FamilyDot family={family.id} />
              {family.label}
              <span className="font-semibold tabular-nums">{count}</span>
              {previous && delta !== 0 ? (
                <span className={delta > 0 ? "families-strip-delta-up" : "families-strip-delta-down"}>
                  {delta > 0 ? "▲" : "▼"}
                  {Math.abs(delta)}
                </span>
              ) : null}
            </button>
          </Tip>
        );
      })}
    </div>
  );
}
