"use client";

import { Tip } from "@/components/monitor/tip";

export type ReaderContextChip = {
  id: string;
  label: string;
  hint?: string;
  onClick: () => void;
};

export function ReaderContextStrip({
  deskLabel,
  range,
  chips,
  onClearFilters,
}: {
  deskLabel: string;
  range: string;
  chips: ReaderContextChip[];
  onClearFilters?: () => void;
}) {
  return (
    <div className="reader-context-strip">
      <div className="reader-context-strip-row">
        <span className="reader-context-desk">{deskLabel}</span>
        <span className="reader-context-sep">·</span>
        <span className="reader-context-range">{range}</span>
        {chips.length > 0 ? (
          <>
            <span className="reader-context-sep hidden sm:inline">·</span>
            <div className="reader-context-chips">
              {chips.map((chip) => (
                <Tip key={chip.id} text={chip.hint ?? `Return to board · ${chip.label}`}>
                  <button
                    type="button"
                    className="reader-context-chip"
                    onClick={chip.onClick}
                  >
                    {chip.label}
                  </button>
                </Tip>
              ))}
            </div>
          </>
        ) : (
          <>
            <span className="reader-context-sep">·</span>
            <span className="reader-context-muted">full board</span>
          </>
        )}
        {onClearFilters ? (
          <button type="button" className="investigation-bar-btn reader-context-clear" onClick={onClearFilters}>
            Clear filters
          </button>
        ) : null}
      </div>
      <p className="reader-context-hint">
        Active filters stay on the desk. Click a chip to close the reader and stay in this investigation.
      </p>
    </div>
  );
}
