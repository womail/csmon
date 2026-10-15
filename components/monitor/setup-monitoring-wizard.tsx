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
import { QUICK_WIZARD_PACKS, type SetupWizardMode } from "@/lib/setup-wizard-presets";

export const SETUP_WIZARD_DISMISSED_KEY = "csmon.setup-wizard-dismissed";

type PackOption = {
  id: IntelPack | "kev";
  label: string;
  hint: string;
};

const PACK_OPTIONS: PackOption[] = [
  { id: "core", label: "World RSS", hint: "DW, France 24, Sky — wire baseline" },
  { id: "security", label: "Security RSS", hint: "CISA, CSIRTS KEV, CCCS, Krebs, NCSC" },
  { id: "politics", label: "Politics RSS", hint: "Politico, Foreign Affairs, BBC Politics, Reuters" },
  { id: "hazard", label: "Hazards", hint: "USGS, NWS, Met Éireann, GDACS" },
  { id: "kev", label: "CISA KEV", hint: "Exploited CVE catalog for Patch desk" },
];

export type SetupWizardCompleteOpts = {
  packs: IntelPack[];
  loadKev: boolean;
  homePlace: string;
  watchName: string;
  watchQuery: string;
  createWatch: boolean;
  pinPoliticsDesk: boolean;
  openPoliticsDesk: boolean;
};

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
  onComplete: (opts: SetupWizardCompleteOpts) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<SetupWizardMode>("quick");
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Set<IntelPack | "kev">>(
    () => new Set(["core", "security", "hazard", "kev"]),
  );
  const [place, setPlace] = useState(homePlace);
  const [watchName, setWatchName] = useState("");
  const [watchQuery, setWatchQuery] = useState("place:Ireland");
  const [createWatch, setCreateWatch] = useState(false);
  const [quickPolitics, setQuickPolitics] = useState(false);
  const [pinPoliticsDesk, setPinPoliticsDesk] = useState(true);
  const [openPoliticsDesk, setOpenPoliticsDesk] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode("quick");
    setStep(0);
    setPlace(homePlace);
    setQuickPolitics(false);
    setPinPoliticsDesk(true);
    setOpenPoliticsDesk(false);
  }, [homePlace, open]);

  function togglePack(id: IntelPack | "kev") {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function packsFromSelection(): IntelPack[] {
    return PACK_OPTIONS.filter((row) => row.id !== "kev" && selected.has(row.id)).map(
      (row) => row.id as IntelPack,
    );
  }

  async function finishQuick() {
    const packs = [...QUICK_WIZARD_PACKS];
    if (quickPolitics) packs.push("politics");
    await onComplete({
      packs,
      loadKev: true,
      homePlace: place.trim() || homePlace,
      watchName: "",
      watchQuery: "",
      createWatch: false,
      pinPoliticsDesk: quickPolitics && pinPoliticsDesk,
      openPoliticsDesk: quickPolitics && openPoliticsDesk,
    });
    window.localStorage.setItem(SETUP_WIZARD_DISMISSED_KEY, "1");
    onOpenChange(false);
  }

  async function finishFull() {
    const packs = packsFromSelection();
    const politics = packs.includes("politics");
    await onComplete({
      packs,
      loadKev: selected.has("kev"),
      homePlace: place.trim() || homePlace,
      watchName: watchName.trim(),
      watchQuery: watchQuery.trim(),
      createWatch: createWatch && Boolean(watchQuery.trim()),
      pinPoliticsDesk: politics && pinPoliticsDesk,
      openPoliticsDesk: politics && openPoliticsDesk,
    });
    window.localStorage.setItem(SETUP_WIZARD_DISMISSED_KEY, "1");
    onOpenChange(false);
  }

  const politicsInFull = selected.has("politics");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Set up monitoring</DialogTitle>
          <p className="text-[12px] text-muted-foreground">
            Quick load gets you on Home in one step; full setup adds packs, watches, and optional
            Politics desk.
          </p>
        </DialogHeader>

        {step === 0 && mode === "quick" ? (
          <div className="space-y-3">
            <div className="flex gap-1 rounded-md border border-border p-0.5">
              <button
                type="button"
                className="flex-1 rounded px-2 py-1.5 text-[11px] font-semibold bg-muted text-foreground"
                onClick={() => setMode("quick")}
              >
                Quick
              </button>
              <button
                type="button"
                className="flex-1 rounded px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/50"
                onClick={() => {
                  setMode("full");
                  setStep(1);
                }}
              >
                Full customize
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Loads <strong>world</strong>, <strong>security</strong>, <strong>hazards</strong>, and{" "}
              <strong>CISA KEV</strong>.
            </p>
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
            <label className="flex cursor-pointer gap-2 rounded-md border border-border px-2 py-2">
              <input
                type="checkbox"
                checked={quickPolitics}
                onChange={(event) => setQuickPolitics(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-[12px] font-medium">Also load Politics RSS</span>
                <span className="block text-[11px] text-muted-foreground">
                  Politico, Foreign Affairs, BBC Politics, Reuters World
                </span>
              </span>
            </label>
            {quickPolitics ? (
              <div className="ml-1 space-y-2 border-l-2 border-border pl-3">
                <label className="flex items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={pinPoliticsDesk}
                    onChange={(event) => setPinPoliticsDesk(event.target.checked)}
                  />
                  Pin <strong>Politics</strong> desk on the rail (Brief · topic politics)
                </label>
                <label className="flex items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={openPoliticsDesk}
                    onChange={(event) => setOpenPoliticsDesk(event.target.checked)}
                  />
                  Open Politics desk after load
                </label>
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                Skip
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void finishQuick()}>
                Load & go to Home
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "full" && step === 1 ? (
          <div className="space-y-3">
            <div className="flex gap-1 rounded-md border border-border p-0.5">
              <button
                type="button"
                className="flex-1 rounded px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/50"
                onClick={() => {
                  setMode("quick");
                  setStep(0);
                }}
              >
                Quick
              </button>
              <button
                type="button"
                className="flex-1 rounded px-2 py-1.5 text-[11px] font-semibold bg-muted text-foreground"
              >
                Full customize
              </button>
            </div>
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
            {politicsInFull ? (
              <div className="space-y-2 rounded-md bg-muted/40 px-2 py-2">
                <label className="flex items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={pinPoliticsDesk}
                    onChange={(event) => setPinPoliticsDesk(event.target.checked)}
                  />
                  Pin Politics desk on the rail
                </label>
                <label className="flex items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={openPoliticsDesk}
                    onChange={(event) => setOpenPoliticsDesk(event.target.checked)}
                  />
                  Open Politics desk after load
                </label>
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                Skip
              </Button>
              <Button size="sm" onClick={() => setStep(2)} disabled={selected.size === 0}>
                Next
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "full" && step === 2 ? (
          <div className="space-y-3">
            <label className="block text-[11px] font-medium text-foreground">
              Home location
              <Input
                className="mt-1 h-8 text-[12px]"
                list="setup-wizard-places-full"
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                placeholder="Dublin"
              />
              <datalist id="setup-wizard-places-full">
                {knownPlaceNames().map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
            <div className="flex justify-between gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button size="sm" onClick={() => setStep(3)}>
                Next
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "full" && step === 3 ? (
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
              <Button size="sm" variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void finishFull()}>
                Load & go to Home
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
