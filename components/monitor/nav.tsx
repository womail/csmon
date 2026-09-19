"use client";

import { Activity, FileWarning, Layers, List, Newspaper, Shield } from "lucide-react";
import { DESKS } from "@/lib/board-state";
import type { Desk } from "@/lib/types";

const ICONS: Record<Desk, typeof Newspaper> = {
  brief: Newspaper,
  scan: List,
  pulse: Activity,
  advisories: FileWarning,
  patch: Shield,
  sources: Layers,
};

export function DeskRail({
  desk,
  onChange,
  counts,
  onClearFilters,
}: {
  desk: Desk;
  onChange: (desk: Desk) => void;
  counts: Partial<Record<Desk, number>>;
  onClearFilters?: () => void;
}) {
  return (
    <nav className="hidden min-h-screen w-[148px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="px-3 pt-3 pb-2 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
        Desks
      </div>
      {DESKS.map((item) => {
        const Icon = ICONS[item.id];
        const active = desk === item.id;
        const count = counts[item.id];
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`mx-2 mb-0.5 flex items-start gap-2 rounded-md px-2 py-1.5 text-left ${
              active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-1">
                <span className="text-[12px] font-medium">{item.label}</span>
                {count != null ? (
                  <span className={`text-[10px] ${active ? "text-slate-300" : "text-slate-400"}`}>
                    {count}
                  </span>
                ) : null}
              </span>
              <span className={`block text-[10px] ${active ? "text-slate-300" : "text-slate-400"}`}>
                {item.hint}
              </span>
            </span>
          </button>
        );
      })}
      <div className="mt-auto border-t border-slate-100 px-3 py-2.5">
        {onClearFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-[11px] font-medium text-slate-600 hover:text-slate-900"
          >
            Clear filters
          </button>
        ) : null}
        <p className="mt-1 text-[10px] leading-snug text-slate-400">
          Filters live in the URL
        </p>
      </div>
    </nav>
  );
}

export function DeskTabs({
  desk,
  onChange,
}: {
  desk: Desk;
  onChange: (desk: Desk) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto lg:hidden">
      {DESKS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] ${
            desk === item.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
