"use client";

import { useEffect, useState } from "react";
import { BookmarkCheck, Save } from "lucide-react";
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import type { BoardFilters } from "@/lib/board-state";
import {
  captureBriefingFromBoard,
  loadMyBriefing,
  saveMyBriefing,
  type MyBriefingProfile,
} from "@/lib/briefing-profile";

export function BriefingButton({
  filters,
  enabledSourceKeys,
  onApply,
}: {
  filters: BoardFilters;
  enabledSourceKeys: string[];
  onApply: (profile: MyBriefingProfile) => void | Promise<void>;
}) {
  const [saved, setSaved] = useState<MyBriefingProfile | null>(null);

  useEffect(() => {
    setSaved(loadMyBriefing());
  }, []);

  function save() {
    const profile = captureBriefingFromBoard(filters, enabledSourceKeys);
    saveMyBriefing(profile);
    setSaved(profile);
  }

  return (
    <>
      <Tip text="Save current desk, filters, 2+ sources, rising, and enabled layers">
        <Button size="xs" variant="outline" onClick={save}>
          <Save className="size-3" />
          Briefing
        </Button>
      </Tip>
      {saved ? (
        <Tip text={`Apply “${saved.name}” (${new Date(saved.updatedAt).toLocaleDateString()})`}>
          <Button size="xs" variant="outline" onClick={() => void onApply(saved)}>
            <BookmarkCheck className="size-3" />
            Apply
          </Button>
        </Tip>
      ) : null}
    </>
  );
}
