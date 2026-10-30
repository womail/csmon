import type { BoardFilters } from "./board-state";
import { activeQueryRules, encodeQueryTree, parseQueryLine, summarizeQuery, type QueryField, type QueryRule } from "./query-builder";
import { SOURCE_TYPE_LABEL, isSourceType, type SourceType } from "./source-types";
import { isFamilyId, topicFamily, type FamilyId } from "./topic-families";
import type { OriginReason, Platform, Source } from "./types";

export type FacetKind =
  | "text"
  | "topic"
  | "family"
  | "tag"
  | "place"
  | "person"
  | "org"
  | "vendor"
  | "cve"
  | "source"
  | "stype"
  | "category"
  | "origin"
  | "platform"
  | "rising"
  | "cross"
  | "ransomware"
  | "risk"
  | "nest"
  | "rule";

export type Facet = {
  kind: FacetKind;
  value: string;
  negate?: boolean;
  label: string;
  token: string;
  from: "url" | "typed" | "desk" | "rule";
};

export type FacetInput = Pick<Facet, "kind" | "value" | "negate">;

export type FacetExtras = Pick<BoardFilters, "org" | "stype" | "cat" | "fam" | "not" | "cve" | "dossier">;

export const EMPTY_FACET_EXTRAS: FacetExtras = {
  org: null,
  stype: [],
  cat: null,
  fam: [],
  not: [],
  cve: [],
  dossier: null,
};

export function facetExtrasOf(filters: Partial<BoardFilters>): FacetExtras {
  return {
    org: filters.org ?? null,
    stype: filters.stype ?? [],
    cat: filters.cat ?? null,
    fam: filters.fam ?? [],
    not: filters.not ?? [],
    cve: filters.cve ?? [],
    dossier: filters.dossier ?? null,
  };
}

/** Typed prefix for each kind (`type:` for source type, `family:` for topic family). */
export const KIND_PREFIX: Partial<Record<FacetKind, string>> = {
  topic: "topic",
  family: "family",
  tag: "tag",
  place: "place",
  person: "person",
  org: "org",
  vendor: "vendor",
  cve: "cve",
  source: "source",
  stype: "type",
  category: "category",
  origin: "origin",
  platform: "platform",
  nest: "nest",
};

const PREFIX_KIND = new Map<string, FacetKind>(
  Object.entries(KIND_PREFIX).map(([kind, prefix]) => [prefix as string, kind as FacetKind]),
);
PREFIX_KIND.set("src", "source");
PREFIX_KIND.set("stype", "stype");
PREFIX_KIND.set("cat", "category");
PREFIX_KIND.set("fam", "family");
PREFIX_KIND.set("author", "person");

export const KIND_LABEL: Record<FacetKind, string> = {
  text: "Search",
  topic: "Topic",
  family: "Family",
  tag: "Tag",
  place: "Place",
  person: "Person",
  org: "Org",
  vendor: "Vendor",
  cve: "CVE",
  source: "Layer",
  stype: "Type",
  category: "Category",
  origin: "Origin",
  platform: "Platform",
  rising: "Rising",
  cross: "Stack",
  ransomware: "Ransomware",
  risk: "Risk",
  nest: "Nest",
  rule: "Rule",
};

/** Active row order: text, topics, places, people/orgs, vendors/CVEs, sources/types, toggles, rules. */
const KIND_ORDER: FacetKind[] = [
  "text",
  "family",
  "topic",
  "tag",
  "nest",
  "place",
  "person",
  "org",
  "vendor",
  "cve",
  "source",
  "stype",
  "category",
  "origin",
  "platform",
  "rising",
  "cross",
  "ransomware",
  "risk",
  "rule",
];

function quote(value: string) {
  return /[\s,"]/.test(value) ? `"${value.replace(/"/g, "")}"` : value;
}

export function facetToken(kind: FacetKind, value: string, negate = false) {
  const prefix = KIND_PREFIX[kind];
  const body = prefix ? `${prefix}:${quote(value)}` : value;
  return negate ? `-${body}` : body;
}

/** `topic:sports` → `{ kind: "topic", value: "sports" }`; null for free text. */
export function parseFacetToken(raw: string): FacetInput | null {
  let text = raw.trim();
  let negate = false;
  if (text.startsWith("-")) {
    negate = true;
    text = text.slice(1);
  }
  const colon = text.indexOf(":");
  if (colon <= 0) return null;
  const kind = PREFIX_KIND.get(text.slice(0, colon).toLowerCase());
  const value = text.slice(colon + 1).replace(/^"|"$/g, "").trim();
  if (!kind || !value) return null;
  return { kind, value, negate };
}

type Ctx = { sources?: Map<number, Source> };

function labelFor(kind: FacetKind, value: string, ctx: Ctx): string {
  switch (kind) {
    case "source": {
      const id = Number(value);
      return Number.isFinite(id) ? (ctx.sources?.get(id)?.name ?? `Layer ${value}`) : value;
    }
    case "stype":
      return isSourceType(value) ? SOURCE_TYPE_LABEL[value] : value;
    case "family":
      return isFamilyId(value) ? topicFamily(value).label : value;
    case "rising":
      return "Rising only";
    case "cross":
      return "In my stack";
    case "ransomware":
      return "Ransomware";
    case "risk":
      return `Risk ${value.toUpperCase()}`;
    default:
      return value;
  }
}

function make(kind: FacetKind, value: string, from: Facet["from"], ctx: Ctx, negate = false): Facet {
  const base = labelFor(kind, value, ctx);
  const named = kind === "source" || kind === "stype" || kind === "category" ? `${KIND_LABEL[kind]}: ${base}` : base;
  return {
    kind,
    value,
    negate: negate || undefined,
    label: negate ? `not ${named}` : named,
    token: facetToken(kind, value, negate),
    from,
  };
}

const FIELD_KIND: Partial<Record<QueryField, FacetKind>> = {
  topic: "topic",
  place: "place",
  vendor: "vendor",
  source: "source",
  author: "person",
  cve: "cve",
  person: "person",
  org: "org",
  stype: "stype",
  category: "category",
  family: "family",
};

function ruleLabel(rule: QueryRule) {
  return summarizeQuery({ rules: [{ ...rule, join: "and" }] });
}

/** Every constraint that changes the result set, in Active-row order. */
export function facetsFromFilters(filters: BoardFilters, ctx: Ctx = {}): Facet[] {
  const out: Facet[] = [];
  const parsed = parseQueryLine(filters.q);
  if (parsed.text) out.push({ ...make("text", parsed.text, "typed", ctx), token: parsed.text });
  for (const rule of parsed.tree.rules) {
    const kind = FIELD_KIND[rule.field];
    if (kind) out.push(make(kind, rule.value, "typed", ctx, rule.op === "neq"));
    else {
      out.push({
        kind: "rule",
        value: `${rule.field}:${rule.value}`,
        negate: rule.op === "neq" || undefined,
        label: ruleLabel(rule),
        token: `${rule.op === "neq" ? "-" : ""}${rule.field}:${quote(rule.value)}`,
        from: "typed",
      });
    }
  }
  for (const family of filters.fam) out.push(make("family", family, "url", ctx));
  const topics = [...new Set([filters.topic, ...filters.topics].filter((t): t is string => Boolean(t)))];
  for (const topic of topics) out.push(make("topic", topic, "url", ctx));
  for (const tag of filters.tags) out.push(make("tag", tag, "url", ctx));
  for (const term of filters.nest) out.push(make("nest", term, "desk", ctx));
  if (filters.place) out.push(make("place", filters.place, "url", ctx));
  if (filters.person) out.push(make("person", filters.person, "url", ctx));
  if (filters.org) out.push(make("org", filters.org, "url", ctx));
  if (filters.vendor) out.push(make("vendor", filters.vendor, "url", ctx));
  for (const cve of filters.cve) out.push(make("cve", cve, "url", ctx));
  if (filters.layer) out.push(make("source", String(filters.layer), "url", ctx));
  for (const type of filters.stype) out.push(make("stype", type, "url", ctx));
  if (filters.cat) out.push(make("category", filters.cat, "url", ctx));
  if (filters.origin) out.push(make("origin", filters.origin, "url", ctx));
  if (filters.platform) out.push(make("platform", filters.platform, "url", ctx));
  for (const token of filters.not) {
    const parsedToken = parseFacetToken(token);
    if (parsedToken) out.push(make(parsedToken.kind, parsedToken.value, "url", ctx, true));
  }
  if (filters.rising) out.push(make("rising", "1", "url", ctx));
  if (filters.cross) out.push(make("cross", "1", "url", ctx));
  if (filters.ransomware) out.push(make("ransomware", "1", "url", ctx));
  if (filters.desk === "patch" && filters.risk !== "p0") out.push(make("risk", filters.risk, "url", ctx));
  for (const rule of activeQueryRules(filters.qb)) {
    out.push({
      kind: "rule",
      value: encodeQueryTree({ rules: [{ ...rule, join: "and" }] }),
      label: ruleLabel(rule),
      token: `${rule.op === "neq" ? "-" : ""}${rule.field}:${quote(rule.value)}`,
      from: "rule",
    });
  }
  return out.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

function notToken(facet: FacetInput) {
  const prefix = KIND_PREFIX[facet.kind];
  return prefix ? `${prefix}:${facet.value.replace(/,/g, " ").trim()}` : null;
}

function sameToken(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function removeTypedToken(q: string, facet: Facet) {
  const tokens = q.match(/-?[\w]+:"[^"]*"|"[^"]*"|\S+/g) ?? [];
  if (facet.kind === "text") {
    return tokens.filter((token) => parseFacetToken(token) || /^-?\w+:/.test(token) || /^(and|or)$/i.test(token)).join(" ");
  }
  const target = facet.token.toLowerCase();
  return tokens
    .filter((token) => {
      const parsed = parseFacetToken(token);
      if (!parsed) return token.toLowerCase().replace(/"/g, "") !== target.replace(/"/g, "");
      return !(
        parsed.kind === facet.kind &&
        parsed.value.toLowerCase() === facet.value.toLowerCase() &&
        Boolean(parsed.negate) === Boolean(facet.negate)
      );
    })
    .join(" ");
}

export function removeFacet(filters: BoardFilters, facet: Facet): BoardFilters {
  const next: BoardFilters = { ...filters };
  if (facet.from === "typed") {
    next.q = removeTypedToken(filters.q, facet);
    return next;
  }
  if (facet.from === "rule") {
    next.qb = {
      rules: activeQueryRules(filters.qb).filter(
        (rule) => encodeQueryTree({ rules: [{ ...rule, join: "and" }] }) !== facet.value,
      ),
    };
    return next;
  }
  if (facet.negate) {
    const token = notToken(facet);
    next.not = filters.not.filter((row) => !token || !sameToken(row, token));
    return next;
  }
  const v = facet.value;
  switch (facet.kind) {
    case "topic":
      if (filters.topic && sameToken(filters.topic, v)) next.topic = null;
      next.topics = filters.topics.filter((t) => !sameToken(t, v));
      break;
    case "family":
      next.fam = filters.fam.filter((f) => f !== v);
      break;
    case "tag":
      next.tags = filters.tags.filter((t) => !sameToken(t, v));
      break;
    case "nest":
      next.nest = filters.nest.filter((t) => !sameToken(t, v));
      break;
    case "place":
      next.place = null;
      break;
    case "person":
      next.person = null;
      break;
    case "org":
      next.org = null;
      break;
    case "vendor":
      next.vendor = null;
      break;
    case "cve":
      next.cve = filters.cve.filter((c) => !sameToken(c, v));
      break;
    case "source":
      next.layer = null;
      break;
    case "stype":
      next.stype = filters.stype.filter((t) => t !== v);
      break;
    case "category":
      next.cat = null;
      break;
    case "origin":
      next.origin = null;
      break;
    case "platform":
      next.platform = null;
      break;
    case "rising":
      next.rising = false;
      break;
    case "cross":
      next.cross = false;
      break;
    case "ransomware":
      next.ransomware = false;
      break;
    case "risk":
      next.risk = "p0";
      break;
    case "text":
      next.q = removeTypedToken(filters.q, facet);
      break;
    case "rule":
      break;
  }
  return next;
}

export function addFacet(filters: BoardFilters, facet: FacetInput): BoardFilters {
  const next: BoardFilters = { ...filters };
  const v = facet.value.trim();
  if (!v) return next;
  if (facet.negate) {
    const token = notToken(facet);
    if (token && !filters.not.some((row) => sameToken(row, token))) next.not = [...filters.not, token].slice(0, 12);
    return removeFacet(next, { ...make(facet.kind, v, "url", {}), negate: undefined });
  }
  const notToken_ = notToken(facet);
  if (notToken_) next.not = filters.not.filter((row) => !sameToken(row, notToken_));
  switch (facet.kind) {
    case "topic": {
      const key = v.toLowerCase();
      if (filters.topic === key || filters.topics.includes(key)) break;
      if (filters.topics.length || filters.topic) next.topics = [...filters.topics, key].slice(0, 8);
      else next.topic = key;
      break;
    }
    case "family":
      if (isFamilyId(v) && !filters.fam.includes(v)) next.fam = [...filters.fam, v];
      break;
    case "tag":
      if (!filters.tags.includes(v.toLowerCase())) next.tags = [...filters.tags, v.toLowerCase()].slice(0, 8);
      break;
    case "nest":
      if (!filters.nest.includes(v.toLowerCase())) next.nest = [...filters.nest, v.toLowerCase()].slice(0, 12);
      break;
    case "place":
      next.place = v;
      break;
    case "person":
      next.person = v;
      break;
    case "org":
      next.org = v;
      break;
    case "vendor":
      next.vendor = v;
      break;
    case "cve":
      if (!filters.cve.some((c) => sameToken(c, v))) next.cve = [...filters.cve, v.toUpperCase()].slice(0, 8);
      break;
    case "source": {
      const id = Number(v);
      if (Number.isFinite(id) && id > 0) next.layer = id;
      break;
    }
    case "stype":
      if (isSourceType(v) && !filters.stype.includes(v)) next.stype = [...filters.stype, v as SourceType];
      break;
    case "category":
      next.cat = v;
      break;
    case "origin":
      next.origin = v as OriginReason;
      break;
    case "platform":
      next.platform = v as Platform;
      break;
    case "rising":
      next.rising = true;
      break;
    case "cross":
      next.cross = true;
      break;
    case "ransomware":
      next.ransomware = true;
      break;
    case "risk":
      next.risk = v as BoardFilters["risk"];
      break;
    case "text":
      next.q = [filters.q.trim(), v].filter(Boolean).join(" ");
      break;
    case "rule":
      break;
  }
  return next;
}

export function hasFacet(filters: BoardFilters, facet: FacetInput, ctx: Ctx = {}) {
  return facetsFromFilters(filters, ctx).some(
    (row) =>
      row.kind === facet.kind &&
      row.value.toLowerCase() === facet.value.toLowerCase() &&
      Boolean(row.negate) === Boolean(facet.negate),
  );
}

export function toggleFacet(filters: BoardFilters, facet: FacetInput, ctx: Ctx = {}): BoardFilters {
  const existing = facetsFromFilters(filters, ctx).find(
    (row) =>
      row.kind === facet.kind &&
      row.value.toLowerCase() === facet.value.toLowerCase() &&
      Boolean(row.negate) === Boolean(facet.negate),
  );
  return existing ? removeFacet(filters, existing) : addFacet(filters, facet);
}

/** Remove every facet; desk, range, stack setting, and the open dossier stay. */
export function clearFacets(filters: BoardFilters): BoardFilters {
  return {
    ...filters,
    q: "",
    topic: null,
    topics: [],
    tags: [],
    nest: [],
    place: null,
    person: null,
    org: null,
    vendor: null,
    cve: [],
    layer: null,
    stype: [],
    cat: null,
    origin: null,
    platform: null,
    fam: [],
    not: [],
    rising: false,
    cross: false,
    ransomware: false,
    risk: "p0",
    qb: { rules: [] },
    focusItem: null,
  };
}

const PROMOTABLE = new Set<FacetKind>(["topic", "family", "place", "person", "org", "vendor", "cve", "stype", "category"]);

/** Typed tokens in q that map to a URL facet move out of q into their param. Free text stays in q. */
export function promoteTypedTokens(filters: BoardFilters): BoardFilters {
  const tokens = filters.q.match(/-?[\w]+:"[^"]*"|"[^"]*"|\S+/g) ?? [];
  let next: BoardFilters = { ...filters, q: "" };
  const keep: string[] = [];
  for (const token of tokens) {
    const parsed = parseFacetToken(token);
    if (!parsed || !PROMOTABLE.has(parsed.kind)) {
      keep.push(token);
      continue;
    }
    if (parsed.kind === "stype" && !isSourceType(parsed.value)) {
      keep.push(token);
      continue;
    }
    if (parsed.kind === "family" && !isFamilyId(parsed.value.toLowerCase())) {
      keep.push(token);
      continue;
    }
    const value = parsed.kind === "family" || parsed.kind === "stype" ? parsed.value.toLowerCase() : parsed.value;
    next = addFacet(next, { ...parsed, value });
  }
  next.q = keep.join(" ").trim();
  return next;
}

export function facetsToSearchLine(facets: Facet[]): string {
  return facets
    .filter((facet) => facet.kind !== "rule" || facet.from !== "rule" || facet.token)
    .map((facet) => facet.token)
    .filter(Boolean)
    .join(" ");
}

export function familyIds(values: string[]): FamilyId[] {
  return values.filter(isFamilyId);
}
