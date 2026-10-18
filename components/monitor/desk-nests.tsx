"use client";

import { useState } from "react";
import { Tip } from "@/components/monitor/tip";
import type { DeskFacet } from "@/lib/desk-nests";
import type { DeskNest } from "@/lib/user-desks";

export function DeskNestList({
  deskLabel,
  facets,
  saved,
  active,
  layout,
  onToggle,
  onClear,
  onAdd,
  onRemoveSaved,
}: {
  deskLabel: string;
  facets: DeskFacet[];
  saved: DeskNest[];
  active: string[];
  layout: "rail" | "bar";
  onToggle: (value: string) => void;
  onClear: () => void;
  onAdd: (label: string) => void;
  onRemoveSaved: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const savedQueries = new Set(saved.map((nest) => nest.query.toLowerCase()));
  const suggested = facets.filter((facet) => !savedQueries.has(facet.value));
  const anyOn = active.length > 0;

  function chip(value: string, label: string, count: number | null, savedId: string | null) {
    const on = active.includes(value);
    const tip = on
      ? `Clear ${label}. The rest of ${deskLabel} shows again.`
      : `Show ${label} inside ${deskLabel}. Click again to clear. Turn on more than one to see all of them.`;
    return (
      <span key={savedId ?? value} className="desk-nest-pair">
        <Tip text={tip}>
          <button
            type="button"
            className="desk-nest-chip"
            data-active={on ? "true" : "false"}
            aria-pressed={on}
            onClick={() => onToggle(value)}
          >
            {label}
            {count != null ? <span className="desk-nest-count">{count}</span> : null}
          </button>
        </Tip>
        {savedId ? (
          <Tip text={`Remove ${label} from ${deskLabel}`}>
            <button
              type="button"
              className="desk-nest-remove"
              aria-label={`Remove ${label} from ${deskLabel}`}
              onClick={() => onRemoveSaved(savedId)}
            >
              ×
            </button>
          </Tip>
        ) : null}
      </span>
    );
  }

  return (
    <div className={layout === "rail" ? "desk-nest desk-nest-rail" : "desk-nest desk-nest-bar"}>
      <Tip text={`Filters nested under ${deskLabel}. Nothing selected shows the whole desk.`}>
        <span className="desk-nest-label">Within {deskLabel}</span>
      </Tip>
      {saved.map((nest) => chip(nest.query.toLowerCase(), nest.label, null, nest.id))}
      {suggested.map((facet) => chip(facet.value, facet.label, facet.count, null))}
      {anyOn ? (
        <Tip text={`Clear the nested filters and show all of ${deskLabel}`}>
          <button type="button" className="desk-nest-clear" onClick={onClear}>
            Show all
          </button>
        </Tip>
      ) : null}
      <form
        className="desk-nest-add"
        onSubmit={(event) => {
          event.preventDefault();
          const name = draft.trim();
          if (!name) return;
          onAdd(name);
          setDraft("");
        }}
      >
        <Tip text={`Save a name under ${deskLabel}, such as Chelsea or Liverpool. It stays on this desk.`}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Chelsea"
            aria-label={`Add a filter inside ${deskLabel}`}
            maxLength={32}
          />
        </Tip>
        <button type="submit" disabled={!draft.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}
