"use client";

import { useState } from "react";
import { Filter, Plus, Trash2 } from "lucide-react";
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  QUERY_FIELDS,
  QUERY_OPS,
  emptyQuery,
  hasQuery,
  newQueryRule,
  summarizeQuery,
  type QueryJoin,
  type QueryOp,
  type QueryField,
  type QueryTree,
} from "@/lib/query-builder";

export function QueryBuilder({
  value,
  onChange,
}: {
  value: QueryTree;
  onChange: (next: QueryTree) => void;
}) {
  const rules = value.rules.length ? value.rules : [newQueryRule("and")];

  function patch(index: number, partial: Partial<(typeof rules)[number]>) {
    const next = rules.map((rule, i) => (i === index ? { ...rule, ...partial } : rule));
    onChange({ rules: next });
  }

  function add() {
    onChange({ rules: [...rules, newQueryRule(rules.length ? "and" : "and")].slice(0, 8) });
  }

  function remove(index: number) {
    const next = rules.filter((_, i) => i !== index);
    onChange({ rules: next });
  }

  return (
    <div className="space-y-1.5">
      {rules.map((rule, index) => (
        <div key={index} className="flex flex-wrap items-center gap-1">
          {index === 0 ? (
            <span className="w-12 shrink-0 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Where
            </span>
          ) : (
            <select
              className="h-7 w-12 shrink-0 rounded-md border border-border bg-background px-1 text-[11px] font-semibold uppercase"
              value={rule.join}
              onChange={(event) => patch(index, { join: event.target.value as QueryJoin })}
              aria-label="Combine with previous rule"
            >
              <option value="and">and</option>
              <option value="or">or</option>
            </select>
          )}
          <select
            className="h-7 min-w-[5.5rem] flex-1 rounded-md border border-border bg-background px-1.5 text-[12px]"
            value={rule.field}
            onChange={(event) => patch(index, { field: event.target.value as QueryField })}
            aria-label="Field"
          >
            {QUERY_FIELDS.map((field) => (
              <option key={field.id} value={field.id}>
                {field.label}
              </option>
            ))}
          </select>
          <select
            className="h-7 min-w-[6.5rem] rounded-md border border-border bg-background px-1.5 text-[12px]"
            value={rule.op}
            onChange={(event) => patch(index, { op: event.target.value as QueryOp })}
            aria-label="Operator"
          >
            {QUERY_OPS.map((op) => (
              <option key={op.id} value={op.id}>
                {op.label}
              </option>
            ))}
          </select>
          <Input
            className="h-7 min-w-[8rem] flex-[2] text-[12px]"
            value={rule.value}
            onChange={(event) => patch(index, { value: event.target.value })}
            placeholder="value"
          />
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:text-rose-700"
            onClick={() => remove(index)}
            aria-label="Remove rule"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      ))}
      {rules.length < 8 ? (
        <Button size="xs" variant="outline" onClick={add}>
          <Plus className="size-3" />
          Add rule
        </Button>
      ) : null}
    </div>
  );
}

export function QueryBuilderButton({
  value,
  onChange,
}: {
  value: QueryTree;
  onChange: (next: QueryTree) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const active = hasQuery(value);

  function openPanel() {
    setDraft(hasQuery(value) ? value : { rules: [newQueryRule("and")] });
    setOpen((current) => !current);
  }

  function apply() {
    onChange({
      rules: draft.rules.filter((rule) => rule.value.trim()).slice(0, 8),
    });
    setOpen(false);
  }

  return (
    <div className={`relative${open ? " z-50" : ""}`}>
      <Tip text="Build a query with equals, not equal, contains, AND, and OR">
        <Button size="xs" variant={active ? "default" : "outline"} onClick={openPanel}>
          <Filter className="size-3" />
          Query
        </Button>
      </Tip>
      {open ? (
        <div className="absolute top-8 right-0 z-50 w-[min(28rem,calc(100vw-2rem))] rounded-md border border-border bg-card p-2 text-card-foreground shadow-lg">
          <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Query builder
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Match title, summary, topic, place, vendor, source, author, or CVE. Combine rows with AND / OR.
          </p>
          <div className="mt-2">
            <QueryBuilder value={draft} onChange={setDraft} />
          </div>
          {hasQuery(draft) ? (
            <p className="mt-2 text-[10px] leading-snug text-muted-foreground">{summarizeQuery(draft)}</p>
          ) : null}
          <div className="mt-2 flex justify-end gap-1">
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                onChange(emptyQuery());
                setDraft({ rules: [newQueryRule("and")] });
                setOpen(false);
              }}
            >
              Clear
            </Button>
            <Button size="xs" onClick={apply}>
              Apply
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

