"use client";

import {
  Activity,
  Bookmark,
  CloudLightning,
  FileText,
  FileWarning,
  Home,
  Layers,
  List,
  Newspaper,
  Plane,
  Plus,
  Shield,
  Users,
} from "lucide-react";
import { Tip } from "@/components/monitor/tip";
import { DESKS } from "@/lib/board-state";
import type { UserDesk } from "@/lib/user-desks";
import { isBuiltinDesk, type Desk } from "@/lib/types";

const ICONS: Record<string, typeof Newspaper> = {
  home: Home,
  brief: Newspaper,
  scan: List,
  pulse: Activity,
  weather: CloudLightning,
  people: Users,
  documents: FileText,
  flights: Plane,
  advisories: FileWarning,
  patch: Shield,
  sources: Layers,
};

export function DeskRail({
  desk,
  onChange,
  counts,
  onClearFilters,
  onHome,
  customDesks,
  onCreateDesk,
  onDeleteDesk,
}: {
  desk: Desk;
  onChange: (desk: Desk) => void;
  counts: Partial<Record<string, number>>;
  onClearFilters?: () => void;
  onHome?: () => void;
  customDesks?: UserDesk[];
  onCreateDesk?: () => void;
  onDeleteDesk?: (id: string) => void;
}) {
  const rows = [
    ...DESKS,
    ...(customDesks ?? []).map((item) => ({
      id: item.id as Desk,
      label: item.label,
      hint: item.hint,
    })),
  ];
  return (
    <nav className="hidden min-h-screen w-[148px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="px-3 pt-3 pb-2 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
        Desks
      </div>
      {rows.map((item) => {
        const Icon = ICONS[item.id] ?? Bookmark;
        const active = desk === item.id;
        const count = counts[item.id];
        return (
          <Tip key={item.id} text={`${item.label}: ${item.hint}`}>
            <div
              className={`mx-2 mb-0.5 flex items-start gap-1 rounded-md ${
                active ? "bg-foreground text-background" : "text-slate-600"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  if (item.id === "home") onHome?.();
                  onChange(item.id);
                }}
                className={`flex min-w-0 flex-1 items-start gap-2 px-2 py-1.5 text-left ${
                  active ? "" : "hover:bg-slate-50"
                }`}
              >
                <Icon className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-1">
                    <span className="text-[12px] font-medium">{item.label}</span>
                    {count != null ? (
                      <span className={`text-[10px] ${active ? "opacity-70" : "text-slate-400"}`}>
                        {count}
                      </span>
                    ) : null}
                  </span>
                  <span className={`block text-[10px] ${active ? "opacity-70" : "text-slate-400"}`}>
                    {item.hint}
                  </span>
                </span>
              </button>
              {!isBuiltinDesk(item.id) && onDeleteDesk ? (
                <button
                  type="button"
                  className={`px-1 py-1 text-[10px] ${active ? "opacity-70" : "text-slate-400"}`}
                  onClick={() => onDeleteDesk(item.id)}
                >
                  ×
                </button>
              ) : null}
            </div>
          </Tip>
        );
      })}
      {onCreateDesk ? (
        <Tip text="Save the current filters as a new desk in this browser">
          <button
            type="button"
            onClick={onCreateDesk}
            className="mx-2 mt-1 flex items-center gap-1 rounded-md px-2 py-1.5 text-left text-[11px] text-slate-600 hover:bg-slate-50"
          >
            <Plus className="size-3.5" />
            New desk
          </button>
        </Tip>
      ) : null}
      <div className="mt-auto border-t border-slate-100 px-3 py-2.5">
        {onClearFilters ? (
          <Tip text="Clear topic, place, vendor, person, layer, and search">
            <button
              type="button"
              onClick={onClearFilters}
              className="text-[11px] font-medium text-slate-600 hover:text-slate-900"
            >
              Clear filters
            </button>
          </Tip>
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
  customDesks,
}: {
  desk: Desk;
  onChange: (desk: Desk) => void;
  customDesks?: UserDesk[];
}) {
  const rows = [
    ...DESKS,
    ...(customDesks ?? []).map((item) => ({
      id: item.id as Desk,
      label: item.label,
      hint: item.hint,
    })),
  ];
  return (
    <div className="flex gap-1 overflow-x-auto lg:hidden">
      {rows.map((item) => (
        <Tip key={item.id} text={item.hint}>
          <button
            type="button"
            onClick={() => onChange(item.id)}
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] ${
              desk === item.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            {item.label}
          </button>
        </Tip>
      ))}
    </div>
  );
}
