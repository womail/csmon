"use client";

import { useMemo, useState } from "react";
import { FACET_ICON } from "@/components/monitor/facet-chip";
import { ToggleFilterChip } from "@/components/monitor/filter-chip";
import { Tip } from "@/components/monitor/tip";
import { FamilyDot } from "@/components/monitor/cards";
import { Input } from "@/components/ui/input";
import { KIND_LABEL, type FacetInput } from "@/lib/facets";
import {
  buildFacetIndex,
  entryKey,
  loadPaletteRecent,
  rankEntries,
  rememberPalettePick,
  type IndexEntry,
} from "@/lib/palette-index";
import { SOURCE_TYPE_LABEL, SOURCE_TYPES, isSourceType } from "@/lib/source-types";
import { TOPIC_FAMILIES, familiesForItem, type FamilyId } from "@/lib/topic-families";
import type { Item, Source } from "@/lib/types";

/** "Filter by anything…" over every facet value on the current board, with the count each would keep. */
export function FacetPicker({
  items,
  sources,
  onAdd,
}: {
  items: Item[];
  sources: Map<number, Source>;
  onAdd: (facet: FacetInput) => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const index = useMemo(() => (query.trim() ? buildFacetIndex(items, sources) : []), [items, query, sources]);
  const results = useMemo(
    () => (query.trim() ? rankEntries(index, query, { recent: loadPaletteRecent(), limit: 12 }) : []),
    [index, query],
  );

  function pick(entry: IndexEntry, negate: boolean) {
    rememberPalettePick(entry);
    onAdd({ kind: entry.kind, value: entry.value, negate: negate || undefined });
    setQuery("");
    setCursor(0);
  }

  return (
    <div className="facet-picker">
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setCursor(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setCursor((c) => Math.min(c + 1, results.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setCursor((c) => Math.max(c - 1, 0));
          } else if (event.key === "Enter" && results[cursor]) {
            event.preventDefault();
            pick(results[cursor], event.altKey);
          } else if (event.key === "Escape") {
            setQuery("");
          }
        }}
        placeholder="Filter by anything… (place:, org:, type:)"
        aria-label="Filter by anything"
        className="h-6 w-64 text-[11px]"
      />
      {results.length ? (
        <ul className="facet-picker-results" role="listbox" aria-label="Matching filters">
          {results.map((entry, i) => {
            const Icon = FACET_ICON[entry.kind];
            return (
              <li key={entryKey(entry)} role="option" aria-selected={i === cursor}>
                <button
                  type="button"
                  className="facet-picker-row"
                  data-active={i === cursor ? "true" : "false"}
                  onMouseEnter={() => setCursor(i)}
                  onClick={(event) => pick(entry, event.altKey)}
                >
                  <Icon className="size-3 shrink-0 opacity-70" aria-hidden />
                  <span className="facet-picker-kind">{KIND_LABEL[entry.kind]}</span>
                  <span className="facet-picker-label">{entry.label}</span>
                  {entry.hint ? <span className="facet-picker-hint">{entry.hint}</span> : null}
                  <span className="facet-picker-count">{entry.count}</span>
                </button>
              </li>
            );
          })}
          <li className="facet-picker-foot">Enter adds · Alt+Enter excludes</li>
        </ul>
      ) : null}
    </div>
  );
}

/** One short row per family: the family name, then its topics and subtags with counts. */
export function FamilyFacetRows({
  items,
  activeFamilies,
  activeTopics,
  onFamily,
  onTopic,
}: {
  items: Item[];
  activeFamilies: FamilyId[];
  activeTopics: string[];
  onFamily: (id: FamilyId) => void;
  onTopic: (topic: string) => void;
}) {
  const counts = useMemo(() => {
    const families = new Map<FamilyId, number>();
    const topics = new Map<string, number>();
    for (const item of items) {
      for (const id of familiesForItem(item)) families.set(id, (families.get(id) ?? 0) + 1);
      for (const topic of item.topics) topics.set(topic, (topics.get(topic) ?? 0) + 1);
    }
    return { families, topics };
  }, [items]);

  return (
    <div className="family-facet-rows">
      {TOPIC_FAMILIES.map((family) => {
        const total = counts.families.get(family.id) ?? 0;
        if (!total) return null;
        const members = [...family.topics, ...family.subtags]
          .map((topic) => [topic, counts.topics.get(topic) ?? 0] as const)
          .filter(([, count]) => count > 0)
          .sort((a, b) => b[1] - a[1]);
        const familyActive = activeFamilies.includes(family.id);
        return (
          <div key={family.id} className="family-facet-row">
            <Tip text={familyActive ? `Remove ${family.label}` : `Everything in ${family.label}: ${family.topics.join(", ") || "items with no topic"}`}>
              <button
                type="button"
                className="family-facet-name"
                data-active={familyActive ? "true" : "false"}
                aria-pressed={familyActive}
                onClick={() => onFamily(family.id)}
              >
                <FamilyDot family={family.id} />
                {family.label}
                <span className="family-facet-count">{total}</span>
              </button>
            </Tip>
            {members.slice(0, 8).map(([topic, count]) => {
              const active = activeTopics.includes(topic);
              return (
                <ToggleFilterChip
                  key={topic}
                  label={`${topic} ${count}`}
                  active={active}
                  accent="neutral"
                  onToggle={() => onTopic(topic)}
                  onDismiss={() => onTopic(topic)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Source type chips with counts on the current board. */
export function SourceTypeRow({
  items,
  sources,
  active,
  onToggle,
}: {
  items: Item[];
  sources: Map<number, Source>;
  active: string[];
  onToggle: (type: string) => void;
}) {
  const counts = useMemo(() => {
    const rows = new Map<string, number>();
    for (const item of items) {
      const type = sources.get(item.sourceId)?.sourceType;
      if (isSourceType(type)) rows.set(type, (rows.get(type) ?? 0) + 1);
    }
    return SOURCE_TYPES.filter((type) => rows.has(type) || active.includes(type)).map((type) => [type, rows.get(type) ?? 0] as const);
  }, [active, items, sources]);
  if (!counts.length) return null;
  return (
    <div className="filter-chip-row">
      <span className="filter-chip-row-label">Source type</span>
      {counts.map(([type, count]) => {
        const on = active.includes(type);
        return (
          <ToggleFilterChip
            key={type}
            label={`${SOURCE_TYPE_LABEL[type]} ${count}`}
            active={on}
            accent="neutral"
            onToggle={() => onToggle(type)}
            onDismiss={() => onToggle(type)}
          />
        );
      })}
    </div>
  );
}
