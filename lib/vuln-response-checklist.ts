import type { KevEntry } from "./kev";
import type { NvdCveBrief } from "./nvd";
import type { LayaStoryState } from "./laya-state";
import type { LayaInsightAnswers } from "./laya-insights";

export type ChecklistStatus = "answered" | "partial" | "unknown" | "action";

export type ChecklistItem = {
  id: string;
  section: "vulnerability" | "exposure" | "response";
  question: string;
  answer: string;
  status: ChecklistStatus;
};

export type VulnResponseChecklist = {
  items: ChecklistItem[];
  thumbRule: string;
};

function item(
  section: ChecklistItem["section"],
  id: string,
  question: string,
  answer: string,
  status: ChecklistStatus,
): ChecklistItem {
  return { section, id, question, answer, status };
}

function inferAttackVector(text: string): string {
  const t = text.toLowerCase();
  if (/\bunauthenticated|\bwithout authentication|network[- ]adjacent|remote attacker|over the network\b/.test(t)) {
    return "Likely remote/network — treat exposure seriously until scoped.";
  }
  if (/\blocal\b|\bprivilege escalation|\bauthenticated user|\buser interaction|\bclick\b/.test(t)) {
    return "Likely local or requires user/account — lower than unauth RCE on internet edge.";
  }
  return "Not stated clearly in extract — confirm in NVD/CVSS vector and vendor advisory.";
}

function inferImpact(text: string, severity: string | null, score: number | null): string {
  const t = text.toLowerCase();
  if (/\bremote code execution|\barbitrary code|\bexecute arbitrary\b/.test(t)) {
    return score != null && score >= 9
      ? "Remote code execution (high CVSS) — nightmare scenario if internet-facing."
      : "Remote code execution mentioned — confirm auth requirements.";
  }
  if (/\bdenial of service|\bdos\b|\bavailability\b/.test(t)) return "Denial of service — usually less urgent than RCE unless critical service.";
  if (/\binformation disclosure|\bread\b|\bdata leak\b/.test(t)) return "Information disclosure — urgency depends on data sensitivity.";
  if (/\bprivilege escalation\b/.test(t)) return "Privilege escalation — urgent on shared/multi-tenant systems.";
  if (severity) return `${severity}${score != null ? ` (CVSS ${score})` : ""} per NVD — read description for impact class.`;
  return "Impact class unclear — read NVD description and vendor advisory.";
}

function inferDisclosure(state: LayaStoryState, text: string): string {
  if (state.kev.hit) return "Known exploited in the wild (CISA KEV) — assume active use, not theoretical.";
  if (/\bzero[- ]day|\b0-day|\bactively exploited|\bin the wild\b/.test(text.toLowerCase())) {
    return "Copy claims active exploitation — treat as high urgency.";
  }
  if (/\bproof of concept|\bpoc\b|\bexploit code|\bpublic exploit\b/.test(text.toLowerCase())) {
    return "Public PoC/exploit mentioned — urgency rises even before KEV listing.";
  }
  if (state.nvd.patch_available) return "Coordinated-style disclosure with patch/fix references in NVD.";
  return "Disclosure path unclear — check vendor advisory timeline.";
}

function buildThumbRule(
  state: LayaStoryState,
  nvd: NvdCveBrief[],
  priority: string,
): string {
  const topScore = nvd.reduce((m, e) => Math.max(m, e.cvssScore ?? 0), 0);
  const kev = state.kev.hit;
  const stack = state.kev.stack_match;
  if (topScore >= 9 && kev) {
    return "CVSS 9+ and KEV-listed → drop everything; patch or mitigate today, confirm exposure first.";
  }
  if (topScore >= 9 && stack) {
    return "CVSS 9+ and stack match → treat as internet-facing until proven otherwise; patch today if exposed.";
  }
  if (topScore >= 7 && kev) {
    return "High severity + KEV → schedule within days; accelerate if internet-facing.";
  }
  if (priority === "act_now") return "Catalog + context say act now — validate inventory, then patch/mitigate.";
  if (state.nvd.mitigate_available && !state.nvd.patch_available) {
    return "Mitigations available, patch unclear → apply workarounds in normal cycle unless KEV says otherwise.";
  }
  return "No KEV + no stack match → patch in normal cycle after inventory check; monitor for PoC/KEV changes.";
}

export function buildVulnResponseChecklist(input: {
  state: LayaStoryState;
  nvdEntries: NvdCveBrief[];
  kevHits: KevEntry[];
  excerpt: string;
  stack: string;
  answers: LayaInsightAnswers;
  patchPriority: string;
}): VulnResponseChecklist {
  const { state, nvdEntries, kevHits, excerpt, stack, patchPriority } = input;
  const primary = nvdEntries[0];
  const kev = kevHits[0];
  const text = excerpt;

  const productLine =
    primary?.products.slice(0, 4).join(", ") ||
    kev?.product ||
    state.vendors.join(", ") ||
    "Unknown — read vendor advisory.";

  const versionLine =
    primary?.fixedVersions.slice(0, 3).join(" · ") ||
    (primary?.patchAvailable ? "Fixed versions listed in NVD references." : "Version scope not parsed — check advisory.");

  const items: ChecklistItem[] = [
    item(
      "vulnerability",
      "component",
      "What exactly is affected (component / product)?",
      `${productLine}${kev ? ` · ${kev.vendor} ${kev.product}` : ""}`,
      productLine.startsWith("Unknown") ? "partial" : "answered",
    ),
    item(
      "vulnerability",
      "cve",
      "CVE ID, CVSS, CWE?",
      state.cves.length
        ? `${state.cves.join(", ")}${primary ? ` · CVSS ${primary.cvssScore ?? "—"} ${primary.severity ?? ""}` : ""}${primary?.cwes.length ? ` · CWE ${primary.cwes.slice(0, 3).join(", ")}` : ""}`
        : "No CVE mined — may be general news, not a tracked vuln.",
      state.cves.length ? "answered" : "unknown",
    ),
    item(
      "vulnerability",
      "vector",
      "Attack vector (remote/local, user interaction)?",
      inferAttackVector(primary?.description ?? text),
      "partial",
    ),
    item(
      "vulnerability",
      "impact",
      "Impact if exploited?",
      inferImpact(primary?.description ?? text, primary?.severity ?? null, primary?.cvssScore ?? null),
      "partial",
    ),
    item(
      "vulnerability",
      "disclosure",
      "Disclosure / exploitation status?",
      inferDisclosure(state, text),
      state.kev.hit ? "answered" : "partial",
    ),
    item(
      "vulnerability",
      "mitigate_before_patch",
      "Workarounds before patch?",
      state.nvd.mitigate_available
        ? "NVD lists mitigation references — see links below."
        : state.nvd.patch_available
          ? "Patch-oriented — confirm interim hardening from vendor advisory."
          : "None cataloged yet in NVD for this item.",
      state.nvd.mitigate_available || state.nvd.patch_available ? "answered" : "unknown",
    ),
    item(
      "exposure",
      "inventory",
      "Do we run affected software (inventory / SBOM)?",
      stack.trim()
        ? state.kev.stack_match
          ? `Your stack filter (“${stack}”) matches KEV/NVD vendor/product — prioritize confirmation in CMDB/SBOM.`
          : `Stack filter set but no KEV match for those tokens — you may still run affected software under another name.`
        : "Set Options → stack (e.g. microsoft, citrix) to align Patch desk with your inventory.",
      stack.trim() ? (state.kev.stack_match ? "action" : "partial") : "unknown",
    ),
    item(
      "exposure",
      "placement",
      "Internet-facing vs internal?",
      "csmon does not know your network — assume internet-facing for edge appliances (ADC, VPN, mail) until scoped.",
      "unknown",
    ),
    item(
      "exposure",
      "reachable",
      "Is the vulnerable path reachable in our config?",
      "Confirm feature flags and config — shipped version ≠ exploitable path (disabled modules, ACLs).",
      "unknown",
    ),
    item(
      "exposure",
      "dependency",
      "Dependency chain / shared libraries?",
      state.cves.length
        ? "If this is a library flaw, check other apps linking the same component — not only the named product."
        : "N/A unless CVE maps to a shared library.",
      state.cves.length ? "partial" : "unknown",
    ),
    item(
      "response",
      "patch",
      "Patch available and timeline?",
      state.nvd.patch_available
        ? `Vendor fix referenced in NVD.${versionLine !== "Version scope not parsed — check advisory." ? ` ${versionLine}` : ""}`
        : "No patch tag in NVD yet — track vendor advisory.",
      state.nvd.patch_available ? "answered" : "partial",
    ),
    item(
      "response",
      "kev",
      "Exploitation status (KEV)?",
      state.kev.hit
        ? `Listed in KEV (${state.kev.max_risk ?? "—"})${state.kev.overdue ? ", overdue" : ""}. ${state.kev.cisa_action ?? kev?.requiredAction ?? ""}`
        : "Not on KEV at query time — still check for PoC and vendor “actively exploited” wording.",
      state.kev.hit ? "answered" : "answered",
    ),
    item(
      "response",
      "priority",
      "Prioritisation for our context?",
      `Suggested bucket: ${patchPriority.replace(/_/g, " ")}. CVSS is a start; KEV + exposure + criticality decide the clock.`,
      "partial",
    ),
    item(
      "response",
      "detect",
      "Detection / IOCs / forensics?",
      "Threat IOCs only if copy uses IOC/C2/malware language — not CERT or vendor support URLs.",
      "partial",
    ),
    item(
      "response",
      "verify",
      "Verify fix after patch?",
      "After change window: rescan version/config, regression test, confirm CVE closed (vendor or scanner).",
      "action",
    ),
    item(
      "response",
      "notify",
      "Notification (e.g. GDPR 72h)?",
      "If personal data breach suspected post-exploitation, engage DPC/legal — csmon cannot assess breach scope.",
      "unknown",
    ),
  ];

  return {
    items,
    thumbRule: buildThumbRule(state, nvdEntries, patchPriority),
  };
}
