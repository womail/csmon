import type { Item, Source } from "./types";
import { mineItem } from "./mine";
import { itemHasPlace } from "./places";

export const QUERY_FIELDS = [
  { id: "text", label: "Any text" },
  { id: "title", label: "Title" },
  { id: "summary", label: "Summary" },
  { id: "topic", label: "Topic" },
  { id: "place", label: "Place" },
  { id: "vendor", label: "Vendor" },
  { id: "source", label: "Source" },
  { id: "author", label: "Author" },
  { id: "cve", label: "CVE" },
  { id: "ioc", label: "IOC" },
] as const;

export const QUERY_OPS = [
  { id: "eq", label: "equals" },
  { id: "neq", label: "not equal" },
  { id: "contains", label: "contains" },
] as const;

export type QueryField = (typeof QUERY_FIELDS)[number]["id"];
export type QueryOp = (typeof QUERY_OPS)[number]["id"];
export type QueryJoin = "and" | "or";

export type QueryRule = {
  field: QueryField;
  op: QueryOp;
  value: string;
  join: QueryJoin;
};

export type QueryTree = {
  rules: QueryRule[];
};

const FIELD_SET = new Set<string>(QUERY_FIELDS.map((row) => row.id));
const OP_SET = new Set<string>(QUERY_OPS.map((row) => row.id));

export function emptyQuery(): QueryTree {
  return { rules: [] };
}

export function activeQueryRules(tree: QueryTree | null | undefined): QueryRule[] {
  return (tree?.rules ?? []).filter((rule) => rule.value.trim());
}

export function hasQuery(tree: QueryTree | null | undefined) {
  return activeQueryRules(tree).length > 0;
}

export function newQueryRule(join: QueryJoin = "and"): QueryRule {
  return { field: "text", op: "contains", value: "", join };
}

function asField(value: string): QueryField | null {
  return FIELD_SET.has(value) ? (value as QueryField) : null;
}

function asOp(value: string): QueryOp | null {
  return OP_SET.has(value) ? (value as QueryOp) : null;
}

export function encodeQueryTree(tree: QueryTree | null | undefined): string {
  const rules = activeQueryRules(tree);
  if (!rules.length) return "";
  return rules
    .map((rule, index) => {
      const join = index === 0 ? "" : `${rule.join}.`;
      return `${join}${rule.field}.${rule.op}.${encodeURIComponent(rule.value.trim())}`;
    })
    .join("|");
}

export function parseQueryTree(raw: string | null | undefined): QueryTree {
  const text = (raw ?? "").trim();
  if (!text) return emptyQuery();
  const rules: QueryRule[] = [];
  for (const [index, chunk] of text.split("|").entries()) {
    const parts = chunk.split(".");
    if (parts.length < 3) continue;
    let join: QueryJoin = "and";
    let fieldRaw = parts[0];
    let opRaw = parts[1];
    let valueRaw = parts.slice(2).join(".");
    if (index > 0 && (fieldRaw === "and" || fieldRaw === "or") && parts.length >= 4) {
      join = fieldRaw;
      fieldRaw = parts[1];
      opRaw = parts[2];
      valueRaw = parts.slice(3).join(".");
    }
    const field = asField(fieldRaw ?? "");
    const op = asOp(opRaw ?? "");
    if (!field || !op) continue;
    let value = valueRaw;
    try {
      value = decodeURIComponent(valueRaw);
    } catch {
      /* keep raw */
    }
    if (!value.trim()) continue;
    rules.push({ field, op, value: value.trim(), join });
  }
  return { rules: rules.slice(0, 8) };
}

function haystacks(item: Item, source: Source | undefined, field: QueryField): string[] {
  const mined = mineItem(item);
  switch (field) {
    case "text":
      return [`${item.title} ${item.summary ?? ""} ${source?.name ?? ""} ${item.extractText ?? ""}`];
    case "title":
      return [item.title];
    case "summary":
      return [item.summary ?? ""];
    case "topic":
      return item.topics;
    case "place":
      return [...item.locations, `${item.title} ${item.summary ?? ""}`];
    case "vendor":
      return mined.vendors;
    case "source":
      return [source?.name ?? "", source?.handle ?? ""];
    case "author":
      return [item.author ?? ""];
    case "cve":
      return mined.cves;
    case "ioc":
      return item.iocs ?? item.entities?.filter((row) => row.kind === "ioc").map((row) => row.label) ?? [];
  }
}

function matchOne(hay: string[], needle: string, op: QueryOp, field: QueryField, item: Item): boolean {
  const value = needle.toLowerCase();
  const rows = hay.map((row) => row.toLowerCase()).filter(Boolean);
  if (field === "place" && (op === "eq" || op === "neq")) {
    const hit = itemHasPlace(item, needle);
    return op === "eq" ? hit : !hit;
  }
  if (op === "eq") return rows.some((row) => row === value);
  if (op === "neq") return rows.every((row) => row !== value);
  return rows.some((row) => row.includes(value));
}

export function itemMatchesQuery(
  item: Item,
  tree: QueryTree | null | undefined,
  source?: Source,
): boolean {
  const rules = activeQueryRules(tree);
  if (!rules.length) return true;
  let acc = matchOne(haystacks(item, source, rules[0].field), rules[0].value, rules[0].op, rules[0].field, item);
  for (const rule of rules.slice(1)) {
    const hit = matchOne(haystacks(item, source, rule.field), rule.value, rule.op, rule.field, item);
    acc = rule.join === "or" ? acc || hit : acc && hit;
  }
  return acc;
}

const LINE_FIELDS: Record<string, QueryField> = {
  text: "text",
  title: "title",
  summary: "summary",
  topic: "topic",
  place: "place",
  vendor: "vendor",
  source: "source",
  src: "source",
  author: "author",
  cve: "cve",
  ioc: "ioc",
};

function unquote(value: string) {
  const text = value.trim();
  if (
    (text.startsWith('"') && text.endsWith('"') && text.length >= 2) ||
    (text.startsWith("'") && text.endsWith("'") && text.length >= 2)
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function tokenizeQueryLine(raw: string) {
  const tokens: string[] = [];
  const re = /"([^"]+)"|'([^']+)'|[^\s]+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    tokens.push(match[1] ?? match[2] ?? match[0]);
  }
  return tokens;
}

/** Typed search line: `source:cisa cve:2024- -topic:sports ireland`. */
export function parseQueryLine(raw: string | null | undefined): { text: string; tree: QueryTree } {
  const tokens = tokenizeQueryLine(raw ?? "");
  const rules: QueryRule[] = [];
  const textParts: string[] = [];
  let join: QueryJoin = "and";
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower === "or") {
      join = "or";
      continue;
    }
    if (lower === "and") {
      join = "and";
      continue;
    }
    let body = token;
    let negated = false;
    if (body.startsWith("-") && body.includes(":")) {
      negated = true;
      body = body.slice(1);
    }
    const colon = body.indexOf(":");
    if (colon > 0) {
      const field = LINE_FIELDS[body.slice(0, colon).toLowerCase()];
      const value = unquote(body.slice(colon + 1));
      if (field && value) {
        rules.push({ field, op: negated ? "neq" : "contains", value, join });
        join = "and";
        continue;
      }
    }
    textParts.push(unquote(token));
    join = "and";
  }
  return { text: textParts.join(" ").trim(), tree: { rules: rules.slice(0, 8) } };
}

export function summarizeQuery(tree: QueryTree | null | undefined): string {
  const rules = activeQueryRules(tree);
  if (!rules.length) return "";
  return rules
    .map((rule, index) => {
      const op = QUERY_OPS.find((row) => row.id === rule.op)?.label ?? rule.op;
      const field = QUERY_FIELDS.find((row) => row.id === rule.field)?.label ?? rule.field;
      const body = `${field} ${op} ${rule.value}`;
      if (index === 0) return body;
      return `${rule.join.toUpperCase()} ${body}`;
    })
    .join(" ");
}
