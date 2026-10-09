"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ActiveReportToast({
  title,
  storyCount,
  onOpen,
  onDismiss,
}: {
  title: string;
  storyCount: number;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="active-report-toast fixed bottom-4 left-1/2 z-[90] flex max-w-md -translate-x-1/2 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 shadow-lg">
      <div className="min-w-0 flex-1 text-[12px] text-amber-950">
        <span className="font-medium">Added to report</span>
        <span className="block truncate">{title}</span>
        {storyCount > 0 ? (
          <span className="text-[10px] text-amber-800">{storyCount} stories</span>
        ) : null}
      </div>
      <Button size="xs" onClick={onOpen}>
        Open
      </Button>
      <button type="button" className="text-amber-700 hover:text-amber-950" onClick={onDismiss}>
        <X className="size-4" />
      </button>
    </div>
  );
}
