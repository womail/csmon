export type SearchSuggestData = {
  source: string[];
  place: string[];
  topic: string[];
  vendor: string[];
  author: string[];
  person?: string[];
  org?: string[];
  cve?: string[];
  type?: string[];
  category?: string[];
  family?: string[];
};

export type SearchSuggestion = {
  label: string;
  hint?: string;
  /** Replacement for the last token of the query line. */
  insert: string;
  /** Field prefixes keep the cursor on the token so a value can follow. */
  continues: boolean;
};

const FIELD_HINTS: { field: string; hint: string; data?: keyof SearchSuggestData }[] = [
  { field: "source", hint: "Layer name", data: "source" },
  { field: "place", hint: "Country or city", data: "place" },
  { field: "topic", hint: "Topic tag", data: "topic" },
  { field: "vendor", hint: "Vendor or product", data: "vendor" },
  { field: "author", hint: "Byline or handle", data: "author" },
  { field: "person", hint: "Person named in the story", data: "person" },
  { field: "org", hint: "Organisation or threat actor", data: "org" },
  { field: "type", hint: "Source type: cert, wire, government…", data: "type" },
  { field: "category", hint: "Source category (OPML folder or pack)", data: "category" },
  { field: "family", hint: "Topic family: security, conflict, hazards…", data: "family" },
  { field: "cve", hint: "CVE id fragment, e.g. 2024-", data: "cve" },
  { field: "ioc", hint: "Indicator: ip, domain, sha256" },
  { field: "title", hint: "Title contains" },
  { field: "summary", hint: "Summary contains" },
];

function lastToken(query: string) {
  const match = /(\S*)$/.exec(query);
  return match ? match[1] : "";
}

function quoteValue(value: string) {
  return /\s/.test(value) ? `"${value.replace(/"/g, "")}"` : value;
}

export function searchSuggestions(query: string, data: SearchSuggestData, limit = 8): SearchSuggestion[] {
  const token = lastToken(query);
  if (!token) return [];
  const negated = token.startsWith("-");
  const body = negated ? token.slice(1) : token;
  const sign = negated ? "-" : "";
  const colon = body.indexOf(":");

  if (colon < 0) {
    const lower = body.toLowerCase();
    if (!lower) return [];
    return FIELD_HINTS.filter((row) => row.field.startsWith(lower) && row.field !== lower)
      .slice(0, limit)
      .map((row) => ({
        label: `${sign}${row.field}:`,
        hint: negated ? `Exclude · ${row.hint}` : row.hint,
        insert: `${sign}${row.field}:`,
        continues: true,
      }));
  }

  const field = body.slice(0, colon).toLowerCase();
  const partial = body.slice(colon + 1).replace(/^["']/, "").toLowerCase();
  const spec = FIELD_HINTS.find((row) => row.field === field);
  if (!spec?.data) return [];
  const seen = new Set<string>();
  const out: SearchSuggestion[] = [];
  for (const value of data[spec.data] ?? []) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    if (partial && !key.includes(partial)) continue;
    if (key === partial) continue;
    seen.add(key);
    out.push({
      label: value,
      hint: `${sign}${field}:`,
      insert: `${sign}${field}:${quoteValue(value)}`,
      continues: false,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function applySuggestion(query: string, suggestion: SearchSuggestion) {
  const token = lastToken(query);
  const head = query.slice(0, query.length - token.length);
  return `${head}${suggestion.insert}${suggestion.continues ? "" : " "}`;
}
