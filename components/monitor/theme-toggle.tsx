"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/monitor/tip";
import { loadOptions, saveOptions } from "@/lib/options";
import { applyPalette, type Palette } from "@/lib/theme";

export function ThemeToggle() {
  const [palette, setPalette] = useState<Palette>("light");

  useEffect(() => {
    const next = loadOptions().palette;
    setPalette(next);
    applyPalette(next);
    const el = document.documentElement;
    const sync = () => setPalette(el.classList.contains("dark") ? "dark" : "light");
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  function toggle() {
    const next: Palette = palette === "dark" ? "light" : "dark";
    setPalette(next);
    saveOptions({ ...loadOptions(), palette: next });
  }

  return (
    <Tip text={palette === "dark" ? "Switch to the light palette" : "Switch to the dark palette"}>
      <Button size="xs" variant="outline" onClick={toggle} aria-label="Toggle palette">
        {palette === "dark" ? <Sun className="size-3" /> : <Moon className="size-3" />}
        {palette === "dark" ? "Light" : "Dark"}
      </Button>
    </Tip>
  );
}
