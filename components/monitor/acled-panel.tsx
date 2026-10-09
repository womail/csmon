"use client";

import { useEffect, useState } from "react";
import { Crosshair, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tip } from "@/components/monitor/tip";
import {
  ACLED_PRESETS,
  DEFAULT_ACLED_PROFILES,
  MAX_ACLED_ENABLED,
  MAX_ACLED_PROFILES,
  loadAcledProfiles,
  normalizeAcledProfiles,
  saveAcledProfiles,
  type AcledProfile,
} from "@/lib/acled";

export function AcledButton({
  busy,
  onLoad,
  onListChange,
}: {
  busy?: boolean;
  onLoad: (profiles: AcledProfile[]) => Promise<void> | void;
  onListChange?: (profiles: AcledProfile[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<AcledProfile[]>(DEFAULT_ACLED_PROFILES);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setProfiles(loadAcledProfiles());
    setHint(null);
  }, [open]);

  function commit(next: AcledProfile[]) {
    const stored = saveAcledProfiles(next);
    setProfiles(stored);
    onListChange?.(stored);
    return stored;
  }

  function patch(id: string, partial: Partial<AcledProfile>) {
    const current = profiles.find((row) => row.id === id);
    if (!current) return;
    if (partial.enabled && !current.enabled) {
      const enabled = profiles.filter((row) => row.enabled).length;
      if (enabled >= MAX_ACLED_ENABLED) {
        setHint(`Only ${MAX_ACLED_ENABLED} ACLED profiles load at once.`);
        return;
      }
    }
    setHint(null);
    commit(profiles.map((row) => (row.id === id ? { ...row, ...partial } : row)));
  }

  function addPreset(preset: AcledProfile) {
    if (profiles.some((row) => row.id === preset.id)) {
      setHint(`${preset.name} is already listed.`);
      return;
    }
    if (profiles.length >= MAX_ACLED_PROFILES) {
      setHint(`Cap is ${MAX_ACLED_PROFILES} profiles.`);
      return;
    }
    const enabled = profiles.filter((row) => row.enabled).length;
    commit([...profiles, { ...preset, enabled: enabled < MAX_ACLED_ENABLED && preset.enabled }]);
  }

  function addBlank() {
    if (profiles.length >= MAX_ACLED_PROFILES) return;
    const id = `custom-${profiles.length + 1}`;
    commit([
      ...profiles,
      {
        id,
        name: "Custom region",
        country: "",
        days: 14,
        limit: 100,
        enabled: false,
      },
    ]);
  }

  async function load() {
    const saved = commit(normalizeAcledProfiles(profiles));
    if (!saved.some((row) => row.enabled)) {
      setHint("Enable at least one profile, then Load.");
      return;
    }
    await onLoad(saved);
    setOpen(false);
  }

  return (
    <>
      <Tip text="ACLED conflict events (server API keys required)">
        <Button type="button" size="xs" variant="outline" className="shrink-0" onClick={() => setOpen(true)}>
          <Crosshair className="size-3" />
          ACLED
        </Button>
      </Tip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[15px]">ACLED</DialogTitle>
            <p className="text-[12px] leading-snug text-slate-500">
              Structured conflict and protest events. Create a free{" "}
              <a
                href="https://acleddata.com/data-exploration/access"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                myACLED
              </a>{" "}
              account, then set <code className="text-[11px]">ACLED_USERNAME</code> (your login email) and{" "}
              <code className="text-[11px]">ACLED_PASSWORD</code> in server <code className="text-[11px]">.env.local</code>{" "}
              (not in the browser). ACLED also assigns an <strong>API access group</strong> per account — if Load fails
              with HTTP 403 / Access denied, email{" "}
              <a href="mailto:access@acleddata.com" className="text-blue-600 underline">
                access@acleddata.com
              </a>{" "}
              to request API access. Check <code className="text-[11px]">/stats</code> or{" "}
              <code className="text-[11px]">GET /api/acled</code> for a probe.
            </p>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto px-1 pb-1">
            <div className="flex flex-wrap gap-1">
              {ACLED_PRESETS.map((preset) => (
                <button key={preset.id} type="button" className="tag" onClick={() => addPreset(preset)}>
                  {preset.name}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {profiles.map((row) => (
                <div key={row.id} className="rounded-md border border-slate-200 p-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={row.enabled}
                      onCheckedChange={(checked) => patch(row.id, { enabled: checked === true })}
                    />
                    <Input
                      className="h-7 flex-1 text-[12px]"
                      value={row.name}
                      onChange={(e) => patch(row.id, { name: e.target.value })}
                    />
                    <button
                      type="button"
                      className="rounded p-1 text-slate-400 hover:bg-slate-100"
                      onClick={() => commit(profiles.filter((entry) => entry.id !== row.id))}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <Input
                      className="h-7 min-w-[140px] flex-1 text-[12px]"
                      placeholder="Country (ACLED name, empty = sample)"
                      value={row.country}
                      onChange={(e) => patch(row.id, { country: e.target.value })}
                    />
                    <label className="flex items-center gap-1 text-[11px] text-slate-500">
                      Days
                      <Input
                        type="number"
                        min={1}
                        max={90}
                        className="h-7 w-14 text-[12px]"
                        value={row.days}
                        onChange={(e) => patch(row.id, { days: Number(e.target.value) })}
                      />
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-slate-500">
                      Limit
                      <Input
                        type="number"
                        min={10}
                        max={500}
                        className="h-7 w-16 text-[12px]"
                        value={row.limit}
                        onChange={(e) => patch(row.id, { limit: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={addBlank}>
                <Plus className="size-3" />
                Profile
              </Button>
              <Button type="button" size="sm" onClick={() => void load()} disabled={busy}>
                Load ACLED
              </Button>
            </div>
            {hint ? <p className="text-[11px] text-amber-700">{hint}</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
