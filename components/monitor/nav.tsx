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
  NotebookPen,
  Plane,
  Plus,
  Rss,
  Shield,
  Users,
} from "lucide-react";
import { DeskNestList } from "@/components/monitor/desk-nests";
import { Tip } from "@/components/monitor/tip";
import type { DeskFacet } from "@/lib/desk-nests";
import type { DeskNest } from "@/lib/user-desks";
import {
  DESK_GROUP_LABEL,
  groupedBuiltinDesks,
  type DeskNavRow,
} from "@/lib/desk-groups";
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
  reports: NotebookPen,
  flights: Plane,
  advisories: FileWarning,
  patch: Shield,
  feeds: Rss,
  sources: Layers,
};

function DeskRailItem({
  item,
  desk,
  count,
  onChange,
  onHome,
  onEditDesk,
  onDeleteDesk,
}: {
  item: DeskNavRow;
  desk: Desk;
  count?: number;
  onChange: (desk: Desk) => void;
  onHome?: () => void;
  onEditDesk?: (id: string) => void;
  onDeleteDesk?: (id: string) => void;
}) {
  const Icon = ICONS[item.id] ?? Bookmark;
  const active = desk === item.id;
  return (
    <div
      className={`desk-rail-item mx-2 mb-0.5 flex items-start gap-1 rounded-md ${
        active ? "bg-foreground text-background" : "text-muted-foreground"
      }`}
    >
      <button
        type="button"
        onClick={() => {
          if (item.id === "home") onHome?.();
          onChange(item.id);
        }}
        title={
          isBuiltinDesk(item.id)
            ? item.hint
            : `${item.label} is a desk you made. Filters nested under the name narrow it. Click a nested filter to turn it on, and click it again to show all of ${item.label}.`
        }
        className={`flex min-w-0 flex-1 items-start gap-2 px-2 py-1.5 text-left ${
          active ? "" : "hover:bg-muted"
        }`}
      >
        <Icon className="mt-0.5 size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="flex min-w-0 items-baseline justify-between gap-1">
            <span className="truncate text-[12px] font-medium">{item.label}</span>
            {count != null ? (
              <span className={`shrink-0 text-[10px] ${active ? "opacity-70" : "opacity-60"}`}>
                {count}
              </span>
            ) : null}
          </span>
          <span className={`block truncate text-[10px] ${active ? "opacity-70" : "opacity-80"}`}>
            {item.hint}
          </span>
        </span>
      </button>
      {!isBuiltinDesk(item.id) && onEditDesk ? (
        <Tip text={`Tune filters for ${item.label}`}>
          <button
            type="button"
            className={`px-1 py-1 text-[10px] ${active ? "opacity-70" : "opacity-60"}`}
            onClick={() => onEditDesk(item.id)}
          >
            edit
          </button>
        </Tip>
      ) : null}
      {!isBuiltinDesk(item.id) && onDeleteDesk ? (
        <button
          type="button"
          className={`px-1 py-1 text-[10px] ${active ? "opacity-70" : "opacity-60"}`}
          onClick={() => onDeleteDesk(item.id)}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export function DeskRail({
  desk,
  onChange,
  counts,
  onClearFilters,
  onHome,
  customDesks,
  onCreateDesk,
  onCreateFilter,
  onDeleteDesk,
  onEditDesk,
  nestFacets,
  nestSaved,
  nestActive,
  onToggleNest,
  onClearNest,
  onAddNest,
  onRemoveNest,
}: {
  desk: Desk;
  onChange: (desk: Desk) => void;
  counts: Partial<Record<string, number>>;
  onClearFilters?: () => void;
  onHome?: () => void;
  customDesks?: UserDesk[];
  onCreateDesk?: () => void;
  onCreateFilter?: () => void;
  onDeleteDesk?: (id: string) => void;
  onEditDesk?: (id: string) => void;
  nestFacets?: DeskFacet[];
  nestSaved?: DeskNest[];
  nestActive?: string[];
  onToggleNest?: (value: string) => void;
  onClearNest?: () => void;
  onAddNest?: (label: string) => void;
  onRemoveNest?: (id: string) => void;
}) {
  const groups = groupedBuiltinDesks();
  const yours: DeskNavRow[] = (customDesks ?? []).map((item) => ({
    id: item.id as Desk,
    label: item.label,
    hint: item.hint,
  }));

  return (
    <nav className="desk-rail hidden min-h-screen w-[148px] shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="px-3 pt-3 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        Desks
      </div>
      {groups.map(({ group, desks }) => (
        <div key={group}>
          <div className="desk-rail-group-label">{DESK_GROUP_LABEL[group]}</div>
          {desks.map((item) => (
            <DeskRailItem
              key={item.id}
              item={item}
              desk={desk}
              count={counts[item.id]}
              onChange={onChange}
              onHome={onHome}
              onEditDesk={onEditDesk}
              onDeleteDesk={onDeleteDesk}
            />
          ))}
        </div>
      ))}
      <div>
        <div className="desk-rail-yours-label">Live filters</div>
        {yours.length === 0 ? (
          <p className="mx-3 mb-1 text-[10px] leading-snug text-muted-foreground">
            Named searches live here. New filter saves the criteria you type.
          </p>
        ) : (
          yours.map((item) => (
            <div key={item.id}>
              <DeskRailItem
                item={item}
                desk={desk}
                count={counts[item.id]}
                onChange={onChange}
                onHome={onHome}
                onEditDesk={onEditDesk}
                onDeleteDesk={onDeleteDesk}
              />
              {desk === item.id && onToggleNest && onClearNest && onAddNest && onRemoveNest ? (
                <DeskNestList
                  deskLabel={item.label}
                  facets={nestFacets ?? []}
                  saved={nestSaved ?? []}
                  active={nestActive ?? []}
                  layout="rail"
                  onToggle={onToggleNest}
                  onClear={onClearNest}
                  onAdd={onAddNest}
                  onRemoveSaved={onRemoveNest}
                />
              ) : null}
            </div>
          ))
        )}
        {onCreateFilter ? (
          <Tip text="Name a search and keep it on this rail. Open it, then add narrower names underneath, such as a team inside a sport.">
            <button
              type="button"
              onClick={onCreateFilter}
              className="mx-2 mt-0.5 flex items-center gap-1 rounded-md px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:bg-muted"
            >
              <Plus className="size-3.5" />
              New filter
            </button>
          </Tip>
        ) : null}
      </div>
      {onCreateDesk ? (
        <Tip text="Save the current board as a desk you name. After it is on the rail, add nested filters under it, such as NFL or Chelsea inside Sport.">
          <button
            type="button"
            onClick={onCreateDesk}
            className="mx-2 mt-1 flex items-center gap-1 rounded-md px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:bg-muted"
          >
            <Plus className="size-3.5" />
            New desk
          </button>
        </Tip>
      ) : null}
      <div className="mt-auto border-t border-border px-3 py-2.5">
        {onClearFilters ? (
          <Tip text="Clear topic, place, vendor, person, layer, and search">
            <button
              type="button"
              onClick={onClearFilters}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              Clear filters
            </button>
          </Tip>
        ) : null}
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">Filters live in the URL</p>
      </div>
    </nav>
  );
}

export function DeskTabs({
  desk,
  onChange,
  customDesks,
  onCreateFilter,
}: {
  desk: Desk;
  onChange: (desk: Desk) => void;
  customDesks?: UserDesk[];
  onCreateFilter?: () => void;
}) {
  const groups = groupedBuiltinDesks();
  const yours: DeskNavRow[] = (customDesks ?? []).map((item) => ({
    id: item.id as Desk,
    label: item.label,
    hint: item.hint,
  }));

  return (
    <div className="flex gap-1 overflow-x-auto lg:hidden">
      {groups.map(({ group, desks }, groupIndex) => (
        <span key={group} className="flex shrink-0 items-center gap-1">
          {groupIndex > 0 ? <span className="desk-tabs-group-gap" aria-hidden /> : null}
          {desks.map((item) => (
            <Tip key={item.id} text={item.hint}>
              <button
                type="button"
                onClick={() => onChange(item.id)}
                className={`max-w-[7.5rem] shrink-0 truncate rounded-md px-1.5 py-0.5 text-[11px] ${
                  desk === item.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </button>
            </Tip>
          ))}
        </span>
      ))}
      {yours.length > 0 || onCreateFilter ? (
        <span className="flex shrink-0 items-center gap-1">
          <span className="desk-tabs-group-gap" aria-hidden />
          {onCreateFilter ? (
            <button
              type="button"
              onClick={onCreateFilter}
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              + Filter
            </button>
          ) : null}
          {yours.map((item) => (
            <Tip key={item.id} text={item.hint}>
              <button
                type="button"
                onClick={() => onChange(item.id)}
                className={`max-w-[7.5rem] shrink-0 truncate rounded-md px-1.5 py-0.5 text-[11px] ${
                  desk === item.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </button>
            </Tip>
          ))}
        </span>
      ) : null}
    </div>
  );
}
