"use client";

import { useEffect } from "react";

/** Marks the document ready so the startup notice stays hidden. */
export function ClientReady() {
  useEffect(() => {
    document.documentElement.dataset.csmon = "ready";
    const el = document.getElementById("csmon-boot");
    if (el) el.hidden = true;
  }, []);
  return null;
}
