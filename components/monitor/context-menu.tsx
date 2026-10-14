"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ContextMenuItem = {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
};

export type ContextMenuSection = {
  label?: string;
  items: ContextMenuItem[];
};

/** Where to anchor a menu: pointer position for right-click, element corner for buttons and keys. */
export function menuAnchor(event: { clientX: number; clientY: number; currentTarget: EventTarget | null; type: string }) {
  const el = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  const fromKeyboard = event.clientX === 0 && event.clientY === 0;
  if (el && (event.type === "click" || fromKeyboard)) {
    const rect = el.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom + 2 };
  }
  return { x: event.clientX, y: event.clientY };
}

/**
 * One menu for cards, chips, and sources. Arrow keys move, Home/End jump, Enter selects,
 * Escape or a click outside closes, and focus returns to whatever opened it.
 */
export function ContextMenu({
  x,
  y,
  title,
  sections,
  footer,
  onClose,
}: {
  x: number;
  y: number;
  title?: string;
  sections: ContextMenuSection[];
  /** Extra panel below the items (e.g. reclassify checklist). */
  footer?: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    return () => {
      if (opener.current instanceof HTMLElement && document.contains(opener.current)) {
        opener.current.focus({ preventScroll: true });
      }
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    const left = rect.width + x > window.innerWidth - pad ? Math.max(pad, window.innerWidth - rect.width - pad) : x;
    const top = rect.height + y > window.innerHeight - pad ? Math.max(pad, window.innerHeight - rect.height - pad) : y;
    setPos((prev) => (prev.x === left && prev.y === top ? prev : { x: left, y: top }));
  }, [x, y, footer, sections]);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not([disabled])")?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onBlur() {
      onClose();
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("blur", onBlur);
    window.addEventListener("resize", onBlur);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onBlur);
    };
  }, [onClose]);

  function onKeyDown(e: React.KeyboardEvent) {
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not([disabled])") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const move = (next: number) => {
      e.preventDefault();
      items[(next + items.length) % items.length]?.focus();
    };
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "ArrowDown") move(index + 1);
    else if (e.key === "ArrowUp") move(index - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(items.length - 1);
    else if (e.key === "Tab") {
      e.preventDefault();
      onClose();
    }
  }

  const visible = sections.filter((section) => section.items.length > 0);
  const menu = (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: pos.x, top: pos.y }}
      role="menu"
      aria-label={title ?? "Actions"}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {title ? <p className="context-menu-title">{title}</p> : null}
      <div className="context-menu-scroll">
        {visible.map((section, sectionIndex) => (
          <div key={section.label ?? sectionIndex} className="context-menu-section" role="group" aria-label={section.label}>
            {section.label ? <p className="context-menu-label">{section.label}</p> : null}
            {section.items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={`context-menu-item ${item.danger ? "is-danger" : ""}`}
                onClick={() => {
                  item.onSelect();
                }}
              >
                <span className="truncate">{item.label}</span>
                {item.hint ? <span className="context-menu-hint">{item.hint}</span> : null}
              </button>
            ))}
          </div>
        ))}
      </div>
      {footer}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(menu, document.body);
}
