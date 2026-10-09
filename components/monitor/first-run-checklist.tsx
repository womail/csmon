"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const FIRST_RUN_CHECKLIST_KEY = "csmon.first-run-checklist-dismissed";

type Step = {
  id: string;
  label: string;
  done: boolean;
  action?: React.ReactNode;
};

export function FirstRunChecklist({
  enabledLayers,
  hasBriefing,
  onSetUpMonitoring,
  onOpenSaved,
  onDismiss,
}: {
  enabledLayers: number;
  hasBriefing: boolean;
  onSetUpMonitoring: () => void;
  onOpenSaved: () => void;
  onDismiss: () => void;
}) {
  const feedsDone = enabledLayers > 0;
  const steps: Step[] = [
    {
      id: "feeds",
      label: "Load public feeds (world, security, or hazards)",
      done: feedsDone,
      action: feedsDone ? null : (
        <Button size="xs" variant="outline" onClick={onSetUpMonitoring}>
          Set up monitoring
        </Button>
      ),
    },
    {
      id: "home",
      label: "Pick home location (weather, map, flights radius)",
      done: feedsDone,
      action: (
        <Button size="xs" variant="outline" asChild>
          <Link href="/help/options-limits">Options guide</Link>
        </Button>
      ),
    },
    {
      id: "briefing",
      label: "Save My briefing so you can resume one click",
      done: hasBriefing,
      action: hasBriefing ? null : (
        <Button size="xs" variant="outline" onClick={onOpenSaved}>
          Open Saved
        </Button>
      ),
    },
  ];

  const allDone = steps.every((step) => step.done);

  if (allDone) return null;

  return (
    <div className="first-run-checklist no-print" role="region" aria-label="Getting started">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-foreground">Getting started</p>
          <p className="text-[11px] text-muted-foreground">
            Three steps to go from empty board to a bookmarkable investigation.{" "}
            <Link href="/help/start" className="underline underline-offset-2">
              User guide
            </Link>
          </p>
        </div>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss checklist"
          onClick={onDismiss}
        >
          <X className="size-3.5" />
        </button>
      </div>
      <ol className="mt-2 space-y-1.5">
        {steps.map((step, index) => (
          <li key={step.id} className="flex flex-wrap items-center gap-2 text-[12px]">
            <span
              className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                step.done
                  ? "bg-emerald-100 text-emerald-800"
                  : "border border-border bg-card text-muted-foreground"
              }`}
            >
              {step.done ? <Check className="size-3" /> : index + 1}
            </span>
            <span className={step.done ? "text-muted-foreground line-through" : "text-foreground"}>
              {step.label}
            </span>
            {step.action}
          </li>
        ))}
      </ol>
    </div>
  );
}
