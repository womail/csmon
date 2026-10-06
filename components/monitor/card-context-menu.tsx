"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { listClassifyTopics } from "@/lib/classify";

export type CardMenuAction =
  | { kind: "reclassify"; topics: string[] }
  | { kind: "display-only" }
  | { kind: "add-display" }
  | { kind: "save-desk" }
  | { kind: "copy-link" }
  | { kind: "close" };

export function CardContextMenu({
  x,
  y,
  currentTopics,
  onAction,
  onClose,
}: {
  x: number;
  y: number;
  currentTopics: string[];
  onAction: (action: CardMenuAction) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(() => new Set(currentTopics));
  const [showTopics, setShowTopics] = useState(false);
  const [pos, setPos] = useState({ x, y });
  const options = listClassifyTopics();

  useEffect(() => {
    setPos({ x, y });
  }, [x, y]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = x;
    let top = y;
    if (rect.right > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (rect.bottom > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    setPos((prev) => (prev.x === left && prev.y === top ? prev : { x: left, y: top }));
  }, [x, y, showTopics]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  const menu = (
    <div
      ref={ref}
      className="fixed z-[100] flex max-h-[min(85vh,520px)] min-w-[200px] max-w-[min(92vw,280px)] flex-col overflow-hidden rounded-md border border-border bg-popover py-1 shadow-lg"
      style={{ left: pos.x, top: pos.y }}
      role="menu"
    >
      <div className="shrink-0">
        <button
          type="button"
          className="flex w-full px-2.5 py-1.5 text-left text-[12px] hover:bg-muted"
          onClick={() => onAction({ kind: "copy-link" })}
        >
          Copy link to card
        </button>
        <button
          type="button"
          className="flex w-full px-2.5 py-1.5 text-left text-[12px] hover:bg-muted"
          onClick={() => onAction({ kind: "display-only" })}
        >
          Display only this card
        </button>
        <button
          type="button"
          className="flex w-full px-2.5 py-1.5 text-left text-[12px] hover:bg-muted"
          onClick={() => onAction({ kind: "add-display" })}
        >
          Add to display collection
        </button>
        <button
          type="button"
          className="flex w-full px-2.5 py-1.5 text-left text-[12px] hover:bg-muted"
          onClick={() => onAction({ kind: "save-desk" })}
        >
          Save to My desk…
        </button>
        <button
          type="button"
          className="flex w-full px-2.5 py-1.5 text-left text-[12px] hover:bg-muted"
          onClick={() => setShowTopics((v) => !v)}
        >
          {showTopics ? "Hide reclassify" : "Reclassify topics…"}
        </button>
      </div>
      {showTopics ? (
        <div className="flex min-h-0 flex-1 flex-col border-t border-border">
          <p className="shrink-0 px-2.5 py-1 text-[10px] text-muted-foreground">
            Shift+click a chip to drop one tag.
          </p>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            style={{ maxHeight: "min(50vh, 280px)" }}
          >
            {options.map((topic) => (
              <button
                key={topic}
                type="button"
                role="menuitemcheckbox"
                aria-checked={selected.has(topic)}
                className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-[12px] hover:bg-muted"
                onClick={() => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(topic)) next.delete(topic);
                    else next.add(topic);
                    return next;
                  });
                }}
              >
                <span className="inline-block size-3 shrink-0 rounded border border-border bg-background text-[9px] leading-3">
                  {selected.has(topic) ? "✓" : ""}
                </span>
                {topic}
              </button>
            ))}
          </div>
          <div className="shrink-0 border-t border-border bg-popover px-2 py-1.5">
            <button
              type="button"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] font-medium hover:bg-muted disabled:opacity-40"
              disabled={selected.size === 0}
              onClick={() => onAction({ kind: "reclassify", topics: [...selected] })}
            >
              Apply topics
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(menu, document.body);
}
