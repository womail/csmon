export const CWE_API = "https://cwe-api.mitre.org/api/v1/cwe/weakness";

export type CweMitigation = {
  phases: string[];
  strategy: string | null;
  description: string;
  effectiveness: string | null;
};

export type CweBrief = {
  cweId: string;
  numericId: string;
  name: string;
  description: string;
  url: string;
  likelihood: string | null;
  mitigations: CweMitigation[];
  consequences: string[];
  detection: string[];
};

export function normalizeCweId(raw: string): string | null {
  const match = raw.trim().match(/\bCWE-(\d+)\b/i);
  if (!match) return null;
  return `CWE-${match[1]}`;
}

export function cweNumericId(cweId: string): string | null {
  const norm = normalizeCweId(cweId);
  if (!norm) return null;
  return norm.replace(/^CWE-/i, "");
}

export function cweDefinitionUrl(cweId: string): string {
  const num = cweNumericId(cweId) ?? cweId.replace(/\D/g, "");
  return `https://cwe.mitre.org/data/definitions/${num}.html`;
}

type RawMitigation = {
  Phase?: string | string[];
  Strategy?: string;
  Description?: string;
  Effectiveness?: string;
};

type RawWeakness = {
  ID?: string;
  Name?: string;
  Description?: string;
  LikelihoodOfExploit?: string;
  PotentialMitigations?: RawMitigation[];
  CommonConsequences?: { Scope?: string | string[]; Impact?: string | string[]; Note?: string }[];
  DetectionMethods?: { Method?: string; Description?: string; Effectiveness?: string }[];
};

function asStringList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseMitigation(row: RawMitigation): CweMitigation | null {
  const description = row.Description?.replace(/\s+/g, " ").trim();
  if (!description) return null;
  return {
    phases: asStringList(row.Phase),
    strategy: row.Strategy?.trim() ?? null,
    description,
    effectiveness: row.Effectiveness?.trim() ?? null,
  };
}

export function parseCweWeaknessResponse(body: unknown): CweBrief[] {
  if (!body || typeof body !== "object") return [];
  const weaknesses = (body as { Weaknesses?: RawWeakness[] }).Weaknesses;
  if (!Array.isArray(weaknesses)) return [];

  const out: CweBrief[] = [];
  for (const row of weaknesses) {
    const numericId = String(row.ID ?? "").trim();
    if (!numericId) continue;
    const cweId = `CWE-${numericId}`;
    const mitigations = (row.PotentialMitigations ?? [])
      .map(parseMitigation)
      .filter((m): m is CweMitigation => m != null)
      .slice(0, 8);
    const consequences: string[] = [];
    for (const c of row.CommonConsequences ?? []) {
      const scope = asStringList(c.Scope).join("/");
      const impact = asStringList(c.Impact).join(", ");
      const note = c.Note?.trim();
      const line = [scope, impact, note].filter(Boolean).join(" — ");
      if (line) consequences.push(line);
    }
    const detection = (row.DetectionMethods ?? [])
      .map((d) => {
        const method = d.Method?.trim();
        const desc = d.Description?.replace(/\s+/g, " ").trim();
        if (!method && !desc) return "";
        return [method, desc].filter(Boolean).join(": ");
      })
      .filter(Boolean)
      .slice(0, 4);

    out.push({
      cweId,
      numericId,
      name: row.Name?.trim() ?? cweId,
      description: row.Description?.replace(/\s+/g, " ").trim() ?? "",
      url: cweDefinitionUrl(cweId),
      likelihood: row.LikelihoodOfExploit?.trim() ?? null,
      mitigations,
      consequences: consequences.slice(0, 6),
      detection,
    });
  }
  return out;
}
