import type { KevEntry } from "./kev";
import type { IocHit } from "./ioc";
import type { CweBrief } from "./cwe";
import type { NvdCveBrief } from "./nvd";
import type { LayaStoryState } from "./laya-state";
import type { LayaInsightAnswers } from "./laya-insights";

export type IrStepTiming = "now" | "today" | "48h" | "this_week" | "ongoing";

export type IncidentResponseStep = {
  order: number;
  phase: string;
  title: string;
  detail: string;
  timing: IrStepTiming;
};

export type IncidentResponsePlan = {
  title: string;
  mode: "full_incident" | "accelerated_patch" | "vuln_management" | "watch";
  escalation: string;
  steps: IncidentResponseStep[];
};

function timingLabel(t: IrStepTiming) {
  switch (t) {
    case "now":
      return "Now";
    case "today":
      return "Today";
    case "48h":
      return "Within 48h";
    case "this_week":
      return "This week";
    case "ongoing":
      return "Ongoing";
  }
}

export { timingLabel };

function planMode(patchPriority: string, worry: string, kev: boolean): IncidentResponsePlan["mode"] {
  if (patchPriority === "act_now" || worry === "now" || kev) return "full_incident";
  if (patchPriority === "plan_this_week" || worry === "soon") return "accelerated_patch";
  if (patchPriority === "monitor" || patchPriority === "normal_cycle") return "vuln_management";
  return "watch";
}

export function buildIncidentResponsePlan(input: {
  state: LayaStoryState;
  answers: LayaInsightAnswers;
  patchPriority: string;
  worry: "now" | "soon" | "watch" | "low";
  impactTier: string;
  kevHits: KevEntry[];
  nvdEntries: NvdCveBrief[];
  stack: string;
  threatIocs: IocHit[];
  cveLabel: string;
  cweEntries: CweBrief[];
}): IncidentResponsePlan {
  const {
    state,
    answers,
    patchPriority,
    worry,
    impactTier,
    kevHits,
    nvdEntries,
    stack,
    threatIocs,
    cveLabel,
    cweEntries,
  } = input;
  const mode = planMode(patchPriority, worry, state.kev.hit);
  const kev = kevHits[0];
  const primary = nvdEntries[0];
  const product =
    primary?.products[0] ?? kev?.product ?? state.vendors[0] ?? "affected product (confirm in advisory)";

  const esc = answers.ir_escalation?.choice;
  let escalation = "Vulnerability management / IT ops lead";
  if (esc === "csirt" || mode === "full_incident") {
    escalation = "CSIRT or security lead + system owner; notify management if internet-facing RCE confirmed";
  } else if (esc === "platform_owner" || answers.response_priority?.choice === "act_now" || impactTier === "rce_unauth") {
    escalation = "Platform/application owner leads; security advises on contain/patch order";
  } else if (esc === "vuln_mgmt" || mode === "vuln_management") {
    escalation = "Vulnerability management queue — patch coordinator + app owner";
  } else if (esc === "watch") {
    escalation = "No standing team — monitor for KEV/PoC changes";
  }

  const steps: IncidentResponseStep[] = [];
  let n = 1;

  steps.push({
    order: n++,
    phase: "Triage",
    title: "Confirm the record",
    detail: `Validate ${cveLabel || "advisory details"} against NVD and vendor bulletin. Capture CVSS, affected versions, and KEV status (${state.kev.hit ? "listed" : "not listed at check time"}).`,
    timing: "now",
  });

  if (mode === "full_incident" || mode === "accelerated_patch") {
    steps.push({
      order: n++,
      phase: "Triage",
      title: "Assign owner and comms",
      detail:
        "Name incident commander (or patch lead), open a ticket/war-room channel, and set next update time. Add this story to a csmon Report if executives need visibility.",
      timing: "now",
    });
  }

  steps.push({
    order: n++,
    phase: "Scope",
    title: "Inventory exposure",
    detail: stack.trim()
      ? `Query CMDB/SBOM for “${product}” and stack tokens (${stack}). Map internet-facing vs internal instances and versions.`
      : `Query CMDB/SBOM for ${product}. Set Options → stack to align Patch desk with your inventory on the next pass.`,
    timing: mode === "full_incident" ? "today" : "this_week",
  });

  steps.push({
    order: n++,
    phase: "Scope",
    title: "Reachability check",
    detail:
      "Confirm the vulnerable code path is enabled (feature flags, modules, ACLs). Version match alone does not prove exploitability.",
    timing: "today",
  });

  if (state.nvd.mitigate_available && !state.nvd.patch_available) {
    steps.push({
      order: n++,
      phase: "Contain",
      title: "Compensating controls first",
      detail:
        "Apply vendor mitigations (disable feature, restrict access, WAF/segmentation) from NVD/vendor links until a fix is installed.",
      timing: mode === "full_incident" ? "today" : "48h",
    });
  }

  if (cweEntries.length > 0) {
    const cwe = cweEntries[0]!;
    const mit = cwe.mitigations[0]?.description;
    steps.push({
      order: n++,
      phase: "Contain",
      title: `Weakness pattern (${cwe.cweId})`,
      detail: mit
        ? `${cwe.name}: ${mit.length > 240 ? `${mit.slice(0, 240)}…` : mit} Full list: ${cwe.url}`
        : `${cwe.name} — review MITRE potential mitigations and detection methods at ${cwe.url}.`,
      timing: "today",
    });
  }

  if (state.kev.hit && kev?.requiredAction) {
    steps.push({
      order: n++,
      phase: "Contain",
      title: "CISA KEV action",
      detail: kev.requiredAction,
      timing: "today",
    });
  }

  if (impactTier === "rce_unauth" || impactTier === "rce_auth") {
    steps.push({
      order: n++,
      phase: "Contain",
      title: "Reduce attack surface",
      detail:
        "If internet-facing: restrict access (VPN only, allowlist, emergency firewall rule) until patched; avoid permanent mystery rules — document each change.",
      timing: mode === "full_incident" ? "today" : "48h",
    });
  }

  if (threatIocs.length > 0) {
    steps.push({
      order: n++,
      phase: "Detect",
      title: "Hunt threat IOCs",
      detail: `Run EDR/SIEM hunts for ${threatIocs.length} indicator(s) from threat-context lines only — correlate before blocking.`,
      timing: "today",
    });
  } else {
    steps.push({
      order: n++,
      phase: "Detect",
      title: "Detection review",
      detail:
        "Check vendor/CVE detection guidance and ensure logging on affected systems; no threat IOCs were mined from this advisory text.",
      timing: "this_week",
    });
  }

  if (state.nvd.patch_available || state.kev.hit) {
    steps.push({
      order: n++,
      phase: "Eradicate",
      title: "Deploy patch or fixed build",
      detail: primary?.fixedVersions.length
        ? `Target: ${primary.fixedVersions.slice(0, 3).join("; ")}. Use change window appropriate to ${mode === "full_incident" ? "emergency" : "standard"} release process.`
        : "Install vendor fix from advisory/NVD patch references; test in non-prod if time allows.",
      timing: mode === "full_incident" ? "today" : "this_week",
    });
  }

  steps.push({
    order: n++,
    phase: "Recover",
    title: "Verify remediation",
    detail:
      "Rescan version/config, run vendor detection check or vulnerability scan, and spot-check critical paths. Roll back if the patch breaks production.",
    timing: "ongoing",
  });

  if (mode === "full_incident" || state.ransomware) {
    steps.push({
      order: n++,
      phase: "Learn",
      title: "Post-incident / breach check",
      detail:
        "Document timeline and actions. If personal data may have been accessed, engage legal/DPO (e.g. GDPR 72h assessment for Ireland) before public statements.",
      timing: "ongoing",
    });
  } else {
    steps.push({
      order: n++,
      phase: "Learn",
      title: "Close the loop",
      detail: "Update ticket, share lessons with app owners, and watch for KEV/PoC updates on this CVE.",
      timing: "ongoing",
    });
  }

  const title =
    mode === "full_incident"
      ? `Incident-style response · ${cveLabel || product}`
      : mode === "accelerated_patch"
        ? `Accelerated patch plan · ${cveLabel || product}`
        : mode === "vuln_management"
          ? `Vulnerability management plan · ${cveLabel || product}`
          : `Watch plan · ${cveLabel || "intel item"}`;

  return { title, mode, escalation, steps };
}
