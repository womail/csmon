"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { IntelPack } from "@/lib/intel-feeds";
import { knownPlaceNames } from "@/lib/places";

export const SETUP_WIZARD_DISMISSED_KEY = "csmon.setup-wizard-dismissed";

type PackOption = {
  id: IntelPack | "kev";
  label: string;
  hint: string;
};

const PACK_OPTIONS: PackOption[] = [
  { id: "core", label: "World RSS", hint: "DW, France 24, Sky — wire baseline" },
  { id: "security", label: "Security RSS", hint: "CISA, Krebs, NCSC, BleepingComputer" },
  { id: "hazard", label: "Hazards", hint: "USGS, NWS, Met Éireann, GDACS" },
  { id: "kev", label: "CISA KEV", hint: "Exploited CVE catalog for Patch desk" },
];

export function SetupMonitoringWizard({
  open,
  onOpenChange,
  homePlace,
  busy,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  homePlace: string;
  busy: boolean;
  onComplete: (opts: {
    packs: IntelPack[];
    loadKev: boolean;
    homePlace: string;
    watchName: string;
    watchQuery: string;
    createWatch: boolean;
  }) => void | Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Set<IntelPack | "kev">>(
    () => new Set(["core", "security"]),
  );
  const [place, setPlace] = useState(homePlace);
  const [watchName, setWatchName] = useState("");
  const [watchQuery, setWatchQuery] = useState("place:Ireland");
  const [createWatch, setCreateWatch] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setPlace(homePlace);
  }, [homePlace, open]);

  function togglePack(id: IntelPack | "kev") {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function finish() {
    const packs = PACK_OPTIONS.filter((row) => row.id !== "kev" && selected.has(row.id)).map(
      (row) => row.id as IntelPack,
    );
    await onComplete({
      packs,
      loadKev: selected.has("kev"),
      homePlace: place.trim() || homePlace,
      watchName: watchName.trim(),
      watchQuery: watchQuery.trim(),
      createWatch: createWatch && Boolean(watchQuery.trim()),
    });
    window.localStorage.setItem(SETUP_WIZARD_DISMISSED_KEY, "1");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Set up monitoring</DialogTitle>
          <p className="text-[12px] text-muted-foreground">
            Pick public layers, home location, and an optional watch — then csmon loads feeds and
            opens Home.
          </p>
        </DialogHeader>
        {step === 0 ? (
          <div className="space-y-3">
            <p className="text-[11px] font-medium text-foreground">Source packs</p>
            <ul className="space-y-2">
              {PACK_OPTIONS.map((row) => (
                <li key={row.id}>
                  <label className="flex cursor-pointer gap-2 rounded-md border border-border px-2 py-2 hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => togglePack(row.id)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-[12px] font-medium">{row.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{row.hint}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                Skip
              </Button>
              <Button size="sm" onClick={() => setStep(1)} disabled={selected.size === 0}>
                Next
              </Button>
            </div>
          </div>
        ) : null}
        {step === 1 ? (
          <div className="space-y-3">
            <label className="block text-[11px] font-medium text-foreground">
              Home location
              <Input
                className="mt-1 h-8 text-[12px]"
                list="setup-wizard-places"
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                placeholder="Dublin"
              />
              <datalist id="setup-wizard-places">
                {knownPlaceNames().map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
            <p className="text-[11px] text-muted-foreground">
              Used for weather pins, Home map center, and Flights ADS-B radius.
            </p>
            <div className="flex justify-between gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button size="sm" onClick={() => setStep(2)}>
                Next
              </Button>
            </div>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={createWatch}
                onChange={(event) => setCreateWatch(event.target.checked)}
              />
              Create a watchlist after load
            </label>
            {createWatch ? (
              <>
                <label className="block text-[11px] font-medium">
                  Watch name
                  <Input
                    className="mt-1 h-8 text-[12px]"
                    value={watchName}
                    onChange={(event) => setWatchName(event.target.value)}
                    placeholder="Ireland situation"
                  />
                </label>
                <label className="block text-[11px] font-medium">
                  Query
                  <Input
                    className="mt-1 h-8 font-mono text-[12px]"
                    value={watchQuery}
                    onChange={(event) => setWatchQuery(event.target.value)}
                    placeholder="place:Ireland"
                  />
                </label>
              </>
            ) : null}
            <div className="flex justify-between gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void finish()}>
                Load & go to Home
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
