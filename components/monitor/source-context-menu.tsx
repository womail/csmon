"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SourceMenuAction =
  | { kind: "preview" }
  | { kind: "subscribe" }
  | { kind: "unsubscribe" };

export function SourceContextMenu({
  x,
  y,
  sourceName,
  subscribed,
  onAction,
  onClose,
}: {
  x: number;
  y: number;
  sourceName: string;
  subscribed: boolean;
  onAction: (action: SourceMenuAction) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

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
  }, [x, y]);

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
      className="fixed z-[100] min-w-[200px] max-w-[min(92vw,280px)] rounded-md border border-border bg-popover py-1 shadow-lg"
      style={{ left: pos.x, top: pos.y }}
      role="menu"
    >
      <p className="px-2.5 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {sourceName}
      </p>
      <button
        type="button"
        className="flex w-full px-2.5 py-1.5 text-left text-[12px] hover:bg-muted"
        onClick={() => onAction({ kind: "preview" })}
      >
        Preview content…
      </button>
      {subscribed ? (
        <button
          type="button"
          className="flex w-full px-2.5 py-1.5 text-left text-[12px] hover:bg-muted"
          onClick={() => onAction({ kind: "unsubscribe" })}
        >
          Unsubscribe (hide layer)
        </button>
      ) : (
        <button
          type="button"
          className="flex w-full px-2.5 py-1.5 text-left text-[12px] hover:bg-muted"
          onClick={() => onAction({ kind: "subscribe" })}
        >
          Subscribe (enable layer)
        </button>
      )}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(menu, document.body);
}
