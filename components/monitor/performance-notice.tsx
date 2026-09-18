"use client";

import { useEffect, useState } from "react";

const KEY = "csmon.layersNotice.dismissed";

export function PerformanceNotice({ layerCount }: { layerCount: number }) {
  const [open, setOpen] = useState(layerCount > 13);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(KEY) === "1") {
      setOpen(false);
      return;
    }
    setOpen(layerCount > 13);
  }, [layerCount]);

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 bg-black/25">
      <div className="pointer-events-auto absolute top-10 left-10 w-[340px] rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="mb-2 text-2xl">⚠️</div>
          <div className="text-[15px] font-semibold text-amber-500">
            Performance notice
          </div>
          <p className="mt-2 text-[13px] leading-snug text-slate-500">
            Enabling more than 13 layers may impact rendering performance and
            frame rate.
          </p>
          <label className="mt-4 flex items-center gap-2 text-[12px] text-slate-500">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
            />
            Don&apos;t show this again
          </label>
          <button
            type="button"
            className="mt-3 w-full rounded-md bg-amber-100 py-2 text-[13px] font-medium text-amber-900 hover:bg-amber-200"
            onClick={() => {
              if (dontShow) window.localStorage.setItem(KEY, "1");
              setOpen(false);
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
