import type { KevEntry } from "./kev";
import { collectReferenceHosts, iocBlockHints, mineThreatIocs, type IocHit } from "./ioc";
import type { CweBrief } from "./cwe";
import type { NvdCveBrief } from "./nvd";
import type { LayaStoryState } from "./laya-state";
import { buildVulnResponseChecklist, type VulnResponseChecklist } from "./vuln-response-checklist";
import { buildIncidentResponsePlan, type IncidentResponsePlan } from "./incident-response-plan";
import { mapPriorityLegacy, rulesFallback } from "./laya-rules-fallback";

export type InsightAction = {
  label: string;
  detail: string;
  href?: string;
};

export type LayaInsightAnswers = {
  response_priority?: { choice: string; confidence: number };
  patch_priority?: { choice: string; confidence: number };
  primary_desk?: { choice: string; confidence: number };
  impact_tier?: { choice: string; confidence: number };
  worry_now?: { noul: number; confidence: number };
  add_to_report?: { noul: number; confidence: number };
  follow_source?: { noul: number; confidence: number };
  mitigation_focus?: { choice: string; confidence: number };
  ir_escalation?: { choice: string; confidence: number };
};

export type VulnInsights = {
  worry: "now" | "soon" | "watch" | "low";
  worryLabel: string;
  gateReason: string;
  recommendedDesk: string;
  responsePriority: string;
  patchPriority: string;
  impactTier: string;
  summary: string;
  actions: InsightAction[];
  mitigate: InsightAction[];
  block: string[];
  threatIocs: IocHit[];
  referenceHosts: string[];
  checklist: VulnResponseChecklist;
  incidentPlan: IncidentResponsePlan;
  cweEntries: CweBrief[];
  catalogNotes: string[];
  flags: {
    addToReport: boolean;
    followSource: boolean;
    threatIocHunt: boolean;
  };
  rulesApplied: string[];
};

/** @deprecated use VulnInsights */
export type LayaInsights = VulnInsights;

function priorityRank(p: string) {
  const order: Record<string, number> = {
    act_now: 4,
    plan_this_week: 3,
    monitor: 2,
    noise: 1,
    normal_cycle: 2,
    monitor_only: 1,
  };
  return order[p] ?? 0;
}

function floorPatchPriority(state: LayaStoryState, model?: string): { choice: string; rules: string[] } {
  const rules: string[] = [];
  let choice = mapPriorityLegacy(model ?? "monitor_only");
  if (state.kev.hit && state.kev.max_risk === "p0") {
    choice = "act_now";
    rules.push("KEV P0 — floor act_now");
  } else if (state.kev.hit && state.kev.max_risk === "p1") {
    if (priorityRank(choice) < priorityRank("plan_this_week")) choice = "plan_this_week";
    rules.push("KEV P1 — at least plan_this_week");
  } else if (state.kev.overdue) {
    choice = "act_now";
    rules.push("KEV overdue — floor act_now");
  }
  if (state.nvd.patch_available && state.kev.stack_match) {
    if (priorityRank(choice) < priorityRank("act_now")) choice = "act_now";
    rules.push("NVD patch + stack match — floor act_now");
  }
  return { choice, rules };
}

function floorDesk(state: LayaStoryState, model?: string): { choice: string; rules: string[] } {
  const rules: string[] = [];
  let choice = model ?? "brief";
  if (state.kev.hit || state.cves.length > 0) {
    choice = state.kev.hit ? "patch" : "advisories";
    rules.push("CVE/KEV present — desk patch/advisories");
  } else if (state.classify_tags.includes("weather")) {
    choice = "weather";
    rules.push("classify weather");
  } else if (state.classify_tags.includes("cyber")) {
    choice = "advisories";
    rules.push("classify cyber");
  } else if (state.classify_tags.includes("war") || state.classify_tags.includes("unrest")) {
    choice = "home";
    rules.push("classify conflict/unrest");
  }
  return { choice, rules };
}

function worryFrom(state: LayaStoryState, priority: string, noul?: number): VulnInsights["worry"] {
  if (priority === "act_now" || state.kev.overdue) return "now";
  if (noul != null && noul >= 0.75) return "now";
  if (priority === "plan_this_week" || state.kev.hit) return "soon";
  if (noul != null && noul >= 0.45) return "watch";
  if (priority === "monitor" || priority === "normal_cycle") return "watch";
  return "low";
}

function worryLabel(level: VulnInsights["worry"]) {
  switch (level) {
    case "now":
      return "Act today";
    case "soon":
      return "Plan this week";
    case "watch":
      return "Watch and verify exposure";
    default:
      return "Routine monitoring";
  }
}

function buildCatalogNotes(input: {
  rulesApplied: string[];
  state: LayaStoryState;
  patchPriority: string;
  worry: VulnInsights["worry"];
}): string[] {
  const lines: string[] = ["Plan built from KEV, NVD, CWE, and csmon catalog rules — no Laya model."];
  if (input.rulesApplied.length) lines.push(`Catalog floors: ${input.rulesApplied.join("; ")}.`);
  if (input.state.kev.hit) lines.push("CISA KEV listing sets urgency floors.");
  if (input.state.kev.stack_match) lines.push("Options stack matches KEV/NVD vendor/product text.");
  if (input.patchPriority === "act_now") lines.push("Priority bucket: act now (catalog).");
  else if (input.worry === "soon") lines.push("Urgency: plan this week (catalog).");
  return lines.slice(0, 6);
}

function priorityCopy(p: string) {
  switch (p) {
    case "act_now":
      return "Patch, mitigate, or prove non-exposure today.";
    case "plan_this_week":
      return "Schedule change window or compensating controls this week.";
    case "monitor":
    case "normal_cycle":
      return "Handle in normal patch cycle after inventory check.";
    case "noise":
    case "monitor_only":
      return "Track for context; no org-wide action implied.";
    default:
      return "Review against your vuln response runbook.";
  }
}

export function buildInsights(input: {
  state: LayaStoryState;
  answers: LayaInsightAnswers;
  excerptForIoc: string;
  referenceUrls: string[];
  nvdEntries: NvdCveBrief[];
  kevHits: KevEntry[];
  stack: string;
  cweEntries: CweBrief[];
}): VulnInsights {
  const { state, answers, excerptForIoc, referenceUrls, nvdEntries, kevHits, stack, cweEntries } = input;

  const routingAnswers = rulesFallback(state);
  const modelPriority =
    routingAnswers.response_priority?.choice ?? routingAnswers.patch_priority?.choice ?? "monitor_only";
  const patchFloor = floorPatchPriority(state, modelPriority);
  const deskFloor = floorDesk(state, routingAnswers.primary_desk?.choice);
  const rulesApplied = [...patchFloor.rules, ...deskFloor.rules];

  const patchPriority = patchFloor.choice;
  const responsePriority =
    routingAnswers.response_priority?.choice ??
    (patchPriority === "act_now"
      ? "act_now"
      : patchPriority === "plan_this_week"
        ? "plan_this_week"
        : patchPriority === "monitor"
          ? "normal_cycle"
          : "monitor_only");

  const recommendedDesk = deskFloor.choice;
  const impactTier = answers.impact_tier?.choice ?? routingAnswers.impact_tier?.choice ?? "unknown";
  const worryNoul = answers.worry_now?.noul ?? routingAnswers.worry_now?.noul;
  const worry = worryFrom(state, patchPriority, worryNoul);

  const catalogNotes = buildCatalogNotes({ rulesApplied, state, patchPriority, worry });
  const gateReason = "Built from KEV, NVD, CWE, and catalog rules — verify exposure in your environment.";

  const referenceHosts = [...collectReferenceHosts(referenceUrls)].slice(0, 24);
  const threatIocs = mineThreatIocs(excerptForIoc, {
    excludeHosts: referenceUrls,
    limit: 16,
  });
  const threatIocHunt = threatIocs.length > 0;

  const actions: InsightAction[] = [];
  actions.push({ label: "Response priority", detail: priorityCopy(patchPriority) });
  actions.push({ label: "Suggested desk", detail: `Open ${recommendedDesk} to align filters with this story.` });
  if (impactTier !== "unknown") {
    actions.push({
      label: "Impact class (estimate)",
      detail: impactTier.replace(/_/g, " "),
    });
  }
  if (state.kev.cisa_action) {
    actions.push({
      label: "CISA required action",
      detail: state.kev.cisa_action,
      href: kevHits[0]?.url,
    });
  }
  for (const entry of nvdEntries.slice(0, 2)) {
    if (entry.patches[0]) {
      actions.push({
        label: `Patch · ${entry.cveId}`,
        detail: entry.fixedVersions[0] ?? "See vendor advisory via NVD reference.",
        href: entry.patches[0].url,
      });
    }
  }

  const mitigate: InsightAction[] = [];
  const mitFocus = answers.mitigation_focus?.choice ?? routingAnswers.mitigation_focus?.choice ?? "none";
  if (mitFocus === "patch" || state.nvd.patch_available) {
    for (const ref of nvdEntries.flatMap((e) => e.patches).slice(0, 4)) {
      mitigate.push({ label: "Vendor fix", detail: ref.url, href: ref.url });
    }
  }
  if (mitFocus === "config" || state.nvd.mitigate_available) {
    for (const ref of nvdEntries.flatMap((e) => e.mitigations).slice(0, 3)) {
      mitigate.push({ label: "Workaround / config", detail: ref.url, href: ref.url });
    }
    for (const entry of nvdEntries) {
      if (entry.cisaRequiredAction) {
        mitigate.push({
          label: "CISA guidance",
          detail: entry.cisaRequiredAction,
          href: entry.url,
        });
      }
    }
  }
  if (!mitigate.length && state.kev.hit) {
    mitigate.push({
      label: "KEV entry",
      detail: kevHits[0]?.requiredAction ?? "Apply CISA required action; confirm products.",
      href: kevHits[0]?.url ?? "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    });
  }
  for (const cwe of cweEntries.slice(0, 2)) {
    for (const mit of cwe.mitigations.slice(0, 2)) {
      const phase = mit.phases.length ? mit.phases.join(" · ") : "MITRE CWE";
      mitigate.push({
        label: `${cwe.cweId} · ${phase}`,
        detail: mit.description.slice(0, 280),
        href: cwe.url,
      });
    }
  }
  if (!mitigate.length) {
    mitigate.push({
      label: "Next step",
      detail: "Read vendor advisory and NVD references — no mitigation tag parsed yet.",
    });
  }

  const block = iocBlockHints(threatIocs);

  const reportNoul = answers.add_to_report?.noul ?? routingAnswers.add_to_report?.noul;
  const followNoul = answers.follow_source?.noul ?? routingAnswers.follow_source?.noul;
  const addToReport =
    (reportNoul ?? 0) >= 0.55 || patchPriority === "act_now" || worry === "now";
  const followSource =
    (followNoul ?? 0) >= 0.6 || (state.source_count >= 2 && patchPriority !== "noise");

  const planAnswers = answers;

  const checklist = buildVulnResponseChecklist({
    state,
    nvdEntries,
    kevHits,
    excerpt: excerptForIoc,
    stack,
    answers: planAnswers,
    patchPriority,
  });

  const cveLabel = state.cves.slice(0, 2).join(", ") || nvdEntries[0]?.cveId || "";
  const incidentPlan = buildIncidentResponsePlan({
    state,
    answers: planAnswers,
    patchPriority,
    worry,
    impactTier,
    kevHits,
    nvdEntries,
    stack,
    threatIocs,
    cveLabel,
    cweEntries,
  });

  const summary = [worryLabel(worry), checklist.thumbRule].join(" — ");

  return {
    worry,
    worryLabel: worryLabel(worry),
    gateReason,
    recommendedDesk,
    responsePriority,
    patchPriority,
    impactTier,
    summary,
    actions,
    mitigate: mitigate.slice(0, 8),
    block,
    threatIocs,
    referenceHosts,
    checklist,
    incidentPlan,
    cweEntries,
    catalogNotes,
    flags: { addToReport, followSource, threatIocHunt },
    rulesApplied,
  };
}
