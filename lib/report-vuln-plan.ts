import type { VulnInsights } from "./laya-insights";

export type ReportVulnPlanSnapshot = {
  capturedAt: number;
  worryLabel: string;
  summary: string;
  thumbRule: string;
  responsePriority: string;
  recommendedDesk: string;
  impactTier: string;
  rulesApplied: string[];
  catalogNotes: string[];
  incidentSteps: { order: number; phase: string; title: string; timing: string }[];
  cweIds: string[];
  cweMitigationSample: string[];
};

export function reportVulnPlanFromInsights(insights: VulnInsights): ReportVulnPlanSnapshot {
  return {
    capturedAt: Date.now(),
    worryLabel: insights.worryLabel,
    summary: insights.summary,
    thumbRule: insights.checklist.thumbRule,
    responsePriority: insights.responsePriority,
    recommendedDesk: insights.recommendedDesk,
    impactTier: insights.impactTier,
    rulesApplied: insights.rulesApplied,
    catalogNotes: insights.catalogNotes,
    incidentSteps: insights.incidentPlan.steps.map((s) => ({
      order: s.order,
      phase: s.phase,
      title: s.title,
      timing: s.timing,
    })),
    cweIds: insights.cweEntries.map((e) => e.cweId),
    cweMitigationSample: insights.cweEntries.flatMap((e) =>
      e.mitigations.slice(0, 1).map((m) => `${e.cweId}: ${m.description.slice(0, 160)}`),
    ),
  };
}
