"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

function loadHeight(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 160 && n <= 900) return n;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function ResizablePanel({
  storageKey,
  defaultHeight = 280,
  minHeight = 180,
  maxHeight = 720,
  className = "",
  children,
}: {
  storageKey: string;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
  children: ReactNode;
}) {
  const [height, setHeight] = useState(defaultHeight);
  const heightRef = useRef(defaultHeight);

  useEffect(() => {
    const h = loadHeight(storageKey, defaultHeight);
    setHeight(h);
    heightRef.current = h;
  }, [defaultHeight, storageKey]);

  const onResizeStart = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      const originY = event.clientY;
      const start = heightRef.current;

      function move(ev: PointerEvent) {
        const next = Math.min(maxHeight, Math.max(minHeight, start + (ev.clientY - originY)));
        heightRef.current = next;
        setHeight(next);
      }
      function up() {
        handle.releasePointerCapture(event.pointerId);
        window.localStorage.setItem(storageKey, String(heightRef.current));
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
      }
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    },
    [maxHeight, minHeight, storageKey],
  );

  return (
    <div
      className={`resizable-panel ${className}`}
      style={{ height, minHeight }}
    >
      <div className="resizable-panel-body">{children}</div>
      <button
        type="button"
        className="resize-handle-h"
        aria-label="Resize panel"
        onPointerDown={onResizeStart}
      />
    </div>
  );
}
