import type { LayaInsightAnswers } from "./laya-insights";
export function mapPriorityLegacy(p: string) {
  switch (p) {
    case "act_now":
      return "act_now";
    case "plan_this_week":
      return "plan_this_week";
    case "normal_cycle":
      return "monitor";
    case "monitor_only":
      return "noise";
    default:
      return p;
  }
}
import type { LayaStoryState } from "./laya-state";

/** Catalog + regex answers when the sidecar is off or for routing fields. */
export function rulesFallback(state: LayaStoryState): LayaInsightAnswers {
  const tags = state.classify_tags;
  let desk = "brief";
  if (state.kev.hit) desk = "patch";
  else if (state.cves.length) desk = "advisories";
  else if (tags.includes("weather")) desk = "weather";
  else if (tags.includes("cyber")) desk = "advisories";
  else if (tags.includes("war") || tags.includes("unrest")) desk = "home";

  let priority = "monitor_only";
  if (state.kev.max_risk === "p0" || state.kev.overdue) priority = "act_now";
  else if (state.kev.hit) priority = "plan_this_week";
  else if (state.nvd.patch_available && state.kev.stack_match) priority = "act_now";
  else if (state.cves.length && (state.nvd.patch_available || tags.includes("cyber"))) {
    priority = "plan_this_week";
  } else if (state.cves.length) priority = "normal_cycle";

  const text = state.excerpt.toLowerCase();
  let impact = "unknown";
  if (/\bunauthenticated|\bremote code execution|\barbitrary code\b/.test(text)) impact = "rce_unauth";
  else if (/\bremote code execution\b/.test(text)) impact = "rce_auth";
  else if (/\bprivilege escalation\b/.test(text)) impact = "privesc";
  else if (/\bdenial of service|\bdos\b/.test(text)) impact = "dos";
  else if (/\binformation disclosure\b/.test(text)) impact = "info_disclosure";

  const worry =
    priority === "act_now" ? 0.85 : priority === "plan_this_week" ? 0.6 : state.ransomware ? 0.5 : 0.22;

  let mit = "none";
  if (state.nvd.patch_available) mit = "patch";
  else if (state.nvd.mitigate_available) mit = "config";
  else if (state.ransomware) mit = "detect";

  return {
    response_priority: { choice: priority, confidence: 0.62 },
    patch_priority: { choice: mapPriorityLegacy(priority), confidence: 0.62 },
    primary_desk: { choice: desk, confidence: 0.58 },
    impact_tier: { choice: impact, confidence: 0.5 },
    worry_now: { noul: worry, confidence: 0.55 },
    add_to_report: {
      noul: priority === "act_now" || state.source_count >= 2 ? 0.68 : 0.32,
      confidence: 0.5,
    },
    follow_source: { noul: state.source_count >= 2 ? 0.52 : 0.38, confidence: 0.48 },
    mitigation_focus: { choice: mit, confidence: 0.52 },
    ir_escalation: {
      choice:
        priority === "act_now"
          ? "csirt"
          : priority === "plan_this_week"
            ? "platform_owner"
            : priority === "normal_cycle"
              ? "vuln_mgmt"
              : "watch",
      confidence: 0.55,
    },
  };
}
