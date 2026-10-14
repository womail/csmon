"use client";

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

export type SelectionAction = {
  id: string;
  label: string;
  run: (text: string) => void | string | Promise<void | string>;
};

const MIN_CHARS = 3;
const MAX_CHARS = 1200;

/**
 * Floating toolbar over a text selection inside `containerRef`. An action may return a short
 * confirmation that replaces the toolbar for a moment.
 */
export function SelectionPopover({
  containerRef,
  actions,
}: {
  containerRef: RefObject<HTMLElement | null>;
  actions: SelectionAction[];
}) {
  const [state, setState] = useState<{ text: string; x: number; y: number } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    function read() {
      const container = containerRef.current;
      const selection = window.getSelection();
      if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) {
        setState(null);
        return;
      }
      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        setState(null);
        return;
      }
      const text = selection.toString().replace(/\s+/g, " ").trim();
      if (text.length < MIN_CHARS || text.length > MAX_CHARS) {
        setState(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setDone(null);
      setState({ text, x: rect.left + rect.width / 2, y: Math.max(40, rect.top) });
    }
    function onUp() {
      window.setTimeout(read, 0);
    }
    function onSelectionChange() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) setState(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setState(null);
      else if (e.shiftKey) window.setTimeout(read, 0);
    }
    const container = containerRef.current;
    container?.addEventListener("mouseup", onUp);
    container?.addEventListener("keyup", onKey);
    container?.addEventListener("scroll", onSelectionChange, { passive: true });
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      container?.removeEventListener("mouseup", onUp);
      container?.removeEventListener("keyup", onKey);
      container?.removeEventListener("scroll", onSelectionChange);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [containerRef]);

  if (!state || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="selection-popover no-print"
      style={{ left: state.x, top: state.y }}
      role="toolbar"
      aria-label="Selected text actions"
      onMouseDown={(e) => e.preventDefault()}
    >
      {done ? (
        <span className="px-2 py-0.5 text-[11px] text-muted-foreground">{done}</span>
      ) : (
        actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={async () => {
              const result = await action.run(state.text);
              if (typeof result === "string") {
                setDone(result);
                window.setTimeout(() => setState(null), 1500);
              } else {
                setState(null);
              }
            }}
          >
            {action.label}
          </button>
        ))
      )}
    </div>,
    document.body,
  );
}
