"use client";

import { useState } from "react";
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { summarizeDesk, type UserDesk } from "@/lib/user-desks";
import type { BoardFilters } from "@/lib/board-state";

export function DeskEditor({
  open,
  onOpenChange,
  current,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: BoardFilters;
  onCreate: (label: string) => UserDesk[] | void;
}) {
  const [label, setLabel] = useState("");

  function save() {
    onCreate(label || summarizeDesk(current));
    setLabel("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Create a desk</DialogTitle>
          <p className="text-[12px] text-slate-500">
            Pins the current filters to the rail. Opening it restores topic, place, source, person,
            and search.
          </p>
        </DialogHeader>
        <div className="space-y-3 px-1 pb-1">
          <label className="block text-[11px] font-medium text-slate-600">
            Desk name
            <Input
              className="mt-1 h-8 text-[12px]"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={summarizeDesk(current)}
            />
          </label>
          <p className="text-[11px] text-slate-500">Saves as: {summarizeDesk(current)}</p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Tip text="Add this desk to the left rail">
              <Button size="sm" onClick={save}>
                Create desk
              </Button>
            </Tip>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
