"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function LiveFilterForm({
  open,
  initialName,
  initialCriteria,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  initialName: string;
  initialCriteria: string;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, criteria: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [criteria, setCriteria] = useState(initialCriteria);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setCriteria(initialCriteria);
  }, [initialCriteria, initialName, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New live filter</DialogTitle>
          <DialogDescription>
            Name it, then set the search line. It is saved on this browser and appears under Live
            filters on the left. The line is the same search as the board: a word, a quoted phrase,
            or <span className="font-medium">place:Ireland</span>, <span className="font-medium">topic:cyber</span>,{" "}
            <span className="font-medium">person:Name</span>.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const nextName = name.trim();
            if (!nextName) return;
            onSave(nextName, criteria.trim());
            onOpenChange(false);
          }}
        >
          <label className="grid gap-1 text-[12px] text-slate-600">
            Name
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="MrXXX"
              maxLength={32}
              autoFocus
            />
          </label>
          <label className="grid gap-1 text-[12px] text-slate-600">
            Search criteria
            <Input
              value={criteria}
              onChange={(event) => setCriteria(event.target.value)}
              placeholder="place:Ireland topic:cyber"
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Save filter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
