import { parseByline } from "./bylines";
import { figureByName, figuresInText as gazetteerFigures, rolePeopleInText, textMentionsPerson } from "./gazetteer/people";
import { orgsInText, type Org } from "./gazetteer/orgs";
import type { Item, Source } from "./types";

export type PersonRow = {
  name: string;
  count: number;
  sample: string;
  sourceIds: number[];
  topics: string[];
  /** Role from the gazetteer or the anchor word ("Foreign Minister"). */
  role?: string | null;
  /** Outlets a byline wrote for. */
  outlets?: string[];
  /** Item ids, newest first, for sparklines and connections. */
  itemIds?: number[];
};

export type OrgRow = PersonRow & { org: Org };

/** People in the author field, split and cleaned; empty for outlet names and feed titles. */
export function bylinePeople(item: Pick<Item, "author">, source?: Source | null): string[] {
  return parseByline(item.author, { name: source?.name, type: source?.sourceType ?? null }).people;
}

/** Display byline: one or more people joined with commas, or null. */
export function personName(item: Pick<Item, "author">, source?: Source | null) {
  const people = bylinePeople(item, source);
  return people.length ? people.join(", ") : null;
}

/** Gazetteer figures named in the text, by canonical name. */
export function figuresInText(text: string) {
  return gazetteerFigures(text).map((figure) => figure.name);
}

/** Figures plus role-anchored names ("Foreign Minister Wang Yi"). */
export function newsPeopleInText(text: string): { name: string; role: string | null }[] {
  const out = new Map<string, { name: string; role: string | null }>();
  for (const figure of gazetteerFigures(text)) out.set(figure.name.toLowerCase(), { name: figure.name, role: figure.role });
  for (const row of rolePeopleInText(text)) {
    if (!out.has(row.name.toLowerCase())) out.set(row.name.toLowerCase(), { name: row.name, role: row.role });
  }
  return [...out.values()];
}

export function itemOrgs(item: Pick<Item, "title" | "summary">): Org[] {
  return orgsInText(`${item.title} ${item.summary ?? ""}`);
}

export function itemHasPerson(item: Item, person: string | null, source?: Source | null) {
  if (!person) return true;
  const needle = person.trim().toLowerCase();
  if (bylinePeople(item, source).some((name) => name.toLowerCase() === needle)) return true;
  return textMentionsPerson(`${item.title} ${item.summary ?? ""}`, person);
}

function bump(
  rows: Map<string, PersonRow>,
  name: string,
  item: Item,
  extra?: { role?: string | null; outlet?: string | null },
) {
  const key = name.toLowerCase();
  let current = rows.get(key);
  if (!current) {
    current = {
      name,
      count: 0,
      sample: item.title,
      sourceIds: [],
      topics: [],
      role: extra?.role ?? null,
      outlets: [],
      itemIds: [],
    };
    rows.set(key, current);
  }
  current.count += 1;
  current.itemIds?.push(item.id);
  if (!current.sourceIds.includes(item.sourceId)) current.sourceIds.push(item.sourceId);
  if (extra?.outlet && !current.outlets?.includes(extra.outlet)) current.outlets?.push(extra.outlet);
  for (const topic of item.topics) {
    if (!current.topics.includes(topic) && current.topics.length < 4) current.topics.push(topic);
  }
}

function sorted<T extends PersonRow>(rows: Map<string, T>) {
  return [...rows.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** People the stories are about: gazetteer figures and role-anchored names. */
export function newsPeopleFromItems(items: Item[]): PersonRow[] {
  const rows = new Map<string, PersonRow>();
  for (const item of items) {
    for (const row of newsPeopleInText(`${item.title} ${item.summary ?? ""}`)) {
      bump(rows, row.name, item, { role: row.role });
    }
  }
  return sorted(rows);
}

/** Journalists and authors, with the outlets they wrote for. */
export function bylinesFromItems(items: Item[], sources: Map<number, Source>): PersonRow[] {
  const rows = new Map<string, PersonRow>();
  for (const item of items) {
    const source = sources.get(item.sourceId);
    for (const name of bylinePeople(item, source)) {
      if (figureByName(name)) continue;
      bump(rows, name, item, { outlet: source?.name ?? null });
    }
  }
  return sorted(rows);
}

export function orgsFromItems(items: Item[]): OrgRow[] {
  const rows = new Map<string, OrgRow>();
  for (const item of items) {
    for (const org of itemOrgs(item)) {
      const key = org.name.toLowerCase();
      if (!rows.has(key)) {
        rows.set(key, {
          name: org.name,
          count: 0,
          sample: item.title,
          sourceIds: [],
          topics: [],
          role: null,
          outlets: [],
          itemIds: [],
          org,
        });
      }
      bump(rows as unknown as Map<string, PersonRow>, org.name, item);
    }
  }
  return sorted(rows);
}

/** People desk default list: news people first, then bylines not already named. */
export function peopleFromItems(items: Item[], sources: Map<number, Source>): PersonRow[] {
  const news = newsPeopleFromItems(items);
  const seen = new Set(news.map((row) => row.name.toLowerCase()));
  return [...news, ...bylinesFromItems(items, sources).filter((row) => !seen.has(row.name.toLowerCase()))];
}
