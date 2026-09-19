export type PatchRisk = "p0" | "p1" | "p2";

export type KevEntry = {
  cveId: string;
  vendor: string;
  product: string;
  name: string;
  description: string;
  dateAdded: number;
  dueDate: number;
  ransomware: boolean;
  requiredAction: string;
  notes: string;
  url: string;
  risk: PatchRisk;
  overdue: boolean;
  daysUntilDue: number;
};

export type RawKev = {
  vulnerabilities?: {
    cveID: string;
    vendorProject: string;
    product: string;
    vulnerabilityName: string;
    dateAdded: string;
    shortDescription: string;
    requiredAction: string;
    dueDate: string;
    knownRansomwareCampaignUse?: string;
    notes?: string;
  }[];
};

export const KEV_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

function parseDay(iso: string) {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(t) ? 0 : t;
}

export function scoreKev(input: {
  dueDate: number;
  dateAdded?: number;
  ransomware: boolean;
}): Pick<KevEntry, "risk" | "overdue" | "daysUntilDue"> {
  const now = Date.now();
  const overdue = input.dueDate > 0 && input.dueDate < now;
  const daysUntilDue = input.dueDate
    ? Math.ceil((input.dueDate - now) / 86400000)
    : 0;
  const ageDays = input.dateAdded ? (now - input.dateAdded) / 86400000 : 999;
  const dueSoon = daysUntilDue >= 0 && daysUntilDue <= 14;
  const newlyListed = ageDays <= 21;
  let risk: PatchRisk = "p2";
  if (newlyListed || dueSoon || (input.ransomware && ageDays <= 45)) risk = "p0";
  else if (input.ransomware || ageDays <= 90) risk = "p1";
  return { risk, overdue, daysUntilDue };
}

export function toKevEntry(raw: NonNullable<RawKev["vulnerabilities"]>[number]): KevEntry {
  const dueDate = parseDay(raw.dueDate);
  const ransomware = /^known$/i.test(raw.knownRansomwareCampaignUse ?? "");
  return {
    cveId: raw.cveID,
    vendor: raw.vendorProject,
    product: raw.product,
    name: raw.vulnerabilityName,
    description: raw.shortDescription,
    dateAdded: parseDay(raw.dateAdded),
    dueDate,
    ransomware,
    requiredAction: raw.requiredAction,
    notes: raw.notes ?? "",
    url: `https://nvd.nist.gov/vuln/detail/${raw.cveID}`,
    ...scoreKev({ dueDate, dateAdded: parseDay(raw.dateAdded), ransomware }),
  };
}

export function matchesStack(entry: KevEntry, stack: string) {
  const q = stack.trim().toLowerCase();
  if (!q) return true;
  const hay = `${entry.vendor} ${entry.product} ${entry.name}`.toLowerCase();
  return q.split(/[,;\s]+/).filter(Boolean).some((part) => hay.includes(part));
}
