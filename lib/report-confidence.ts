export type ReportConfidence = "verified" | "likely" | "needs-work" | "noise";

export const REPORT_CONFIDENCE_OPTIONS: {
  id: ReportConfidence;
  label: string;
  hint: string;
}[] = [
  { id: "verified", label: "Verified", hint: "Corroborated or primary-source confirmed" },
  { id: "likely", label: "Likely", hint: "Credible but not fully confirmed" },
  { id: "needs-work", label: "Needs work", hint: "Open questions or weak sourcing" },
  { id: "noise", label: "Noise", hint: "Low value for the briefing" },
];

export function parseReportConfidence(value: unknown): ReportConfidence | undefined {
  if (value === "verified" || value === "likely" || value === "needs-work" || value === "noise") {
    return value;
  }
  return undefined;
}

export function reportConfidenceLabel(value: ReportConfidence | undefined) {
  if (!value) return null;
  return REPORT_CONFIDENCE_OPTIONS.find((row) => row.id === value)?.label ?? value;
}
