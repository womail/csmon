"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { Tip } from "@/components/monitor/tip";
import { trailLine, type TrailEntry } from "@/lib/filter-trail";

/** ◀ ▶ through the views visited this session, plus a Trail list and "Save trail to report". */
export function TrailControls({
  entries,
  cursor,
  onBack,
  onForward,
  onGo,
  onSave,
}: {
  entries: TrailEntry[];
  cursor: number;
  onBack: () => void;
  onForward: () => void;
  onGo: (index: number) => void;
  onSave?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  if (entries.length < 2) return null;
  return (
    <div className="trail-controls" ref={ref}>
      <Tip text="Previous view  [">
        <button type="button" className="investigation-bar-btn" onClick={onBack} disabled={cursor <= 0} aria-label="Previous view">
          <ChevronLeft className="size-3" />
        </button>
      </Tip>
      <Tip text="Next view  ]">
        <button
          type="button"
          className="investigation-bar-btn"
          onClick={onForward}
          disabled={cursor >= entries.length - 1}
          aria-label="Next view"
        >
          <ChevronRight className="size-3" />
        </button>
      </Tip>
      <Tip text="Views you walked through this session">
        <button
          type="button"
          className={`investigation-bar-btn ${open ? "is-active" : ""}`}
          onClick={() => {
            setNow(Date.now());
            setOpen((v) => !v);
          }}
          aria-expanded={open}
        >
          <History className="size-3" />
          Trail {entries.length}
        </button>
      </Tip>
      {open ? (
        <div className="trail-menu" role="menu">
          <ol>
            {entries
              .map((entry, index) => ({ entry, index }))
              .reverse()
              .map(({ entry, index }) => (
                <li key={`${entry.at}-${index}`}>
                  <button
                    type="button"
                    role="menuitem"
                    className="trail-menu-row"
                    data-active={index === cursor ? "true" : "false"}
                    onClick={() => {
                      onGo(index);
                      setOpen(false);
                    }}
                  >
                    {trailLine(entry, now)}
                  </button>
                </li>
              ))}
          </ol>
          {onSave ? (
            <button
              type="button"
              className="trail-menu-save"
              onClick={() => {
                onSave();
                setOpen(false);
              }}
            >
              Save trail to report
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
