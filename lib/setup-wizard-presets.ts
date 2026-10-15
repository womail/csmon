import type { IntelPack } from "./intel-feeds";

/** One-click packs for the quick setup path (watch step skipped). */
export const QUICK_WIZARD_PACKS: IntelPack[] = ["core", "security", "hazard"];

export type SetupWizardMode = "quick" | "full";
