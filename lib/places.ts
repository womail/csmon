import { textHasPlace } from "@/lib/classify";

export const PINNED_PLACES = ["Ireland", "UK", "US"] as const;

const PLACE_GROUPS: Record<string, string[]> = {
  London: ["London", "Westminster", "Downing Street"],
  UK: ["UK", "United Kingdom", "Britain", "British"],
  Ireland: [
    "Ireland",
    "Irish",
    "Dublin",
    "Cork",
    "Galway",
    "Limerick",
    "Waterford",
    "Belfast",
    "Shannon",
    "Éire",
    "Eire",
    "Republic of Ireland",
    "Northern Ireland",
  ],
  Dublin: ["Dublin"],
  US: ["US", "USA", "United States", "United States of America", "Washington", "White House", "Pentagon"],
  Russia: ["Russia", "Russian", "Moscow", "Kremlin"],
  China: ["China", "Chinese", "Beijing"],
  Ukraine: ["Ukraine", "Ukrainian", "Kyiv", "Kiev"],
  France: ["France", "French", "Paris"],
  Germany: ["Germany", "German", "Berlin"],
  Iran: ["Iran", "Iranian", "Tehran"],
  Israel: ["Israel", "Israeli", "Jerusalem"],
  Japan: ["Japan", "Japanese", "Tokyo"],
  India: ["India", "Indian", "Delhi"],
  Korea: ["Korea", "Korean", "Seoul", "Pyongyang", "South Korea", "North Korea"],
};

const RELATED: Record<string, string[]> = {
  London: ["London", "UK"],
  UK: ["UK", "London"],
  Dublin: ["Dublin", "Ireland"],
  Ireland: ["Ireland", "Dublin"],
};

const COUNTRY_ALIASES: Record<string, string> = {
  "united kingdom": "UK",
  ireland: "Ireland",
  "republic of ireland": "Ireland",
  "united states of america": "US",
  "united states": "US",
  "south korea": "Korea",
  "north korea": "Korea",
  "republic of korea": "Korea",
  "russian federation": "Russia",
  "people's republic of china": "China",
  "syrian arab republic": "Syria",
  "iran (islamic republic of)": "Iran",
  "türkiye": "Turkey",
  turkiye: "Turkey",
};

const COUNTRIES = new Set([
  "US",
  "UK",
  "Ireland",
  "China",
  "Russia",
  "Ukraine",
  "France",
  "Germany",
  "Iran",
  "Israel",
  "Japan",
  "India",
  "Korea",
  "Taiwan",
  "Mexico",
  "Canada",
  "Australia",
  "Spain",
  "Italy",
  "Poland",
  "Turkey",
  "Pakistan",
  "Brazil",
  "Nigeria",
  "Syria",
  "Yemen",
  "Sudan",
  "Lebanon",
  "Iraq",
  "Afghanistan",
  "Myanmar",
  "Ethiopia",
  "Somalia",
  "Libya",
  "Greece",
  "Indonesia",
  "Philippines",
  "Chile",
  "Haiti",
  "Venezuela",
  "Nepal",
  "Bangladesh",
  "New Zealand",
]);

export function resolvePlace(name: string) {
  const key = name.trim().toLowerCase();
  if (!key) return name.trim();
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  for (const canon of Object.keys(PLACE_GROUPS)) {
    if (canon.toLowerCase() === key) return canon;
  }
  for (const [canon, aliases] of Object.entries(PLACE_GROUPS)) {
    if (aliases.some((alias) => alias.toLowerCase() === key)) return canon;
  }
  return name.trim();
}

export function isCountry(name: string) {
  return COUNTRIES.has(resolvePlace(name));
}

export function isKnownPlace(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const canon = resolvePlace(trimmed);
  if (COUNTRIES.has(canon) || PLACE_GROUPS[canon]) return true;
  const key = trimmed.toLowerCase();
  if (COUNTRY_ALIASES[key]) return true;
  return Object.values(PLACE_GROUPS).some((aliases) =>
    aliases.some((alias) => alias.toLowerCase() === key),
  );
}

export function knownPlaceNames() {
  return [...new Set([...PINNED_PLACES, ...Object.keys(PLACE_GROUPS), ...COUNTRIES])];
}

export function placeAliases(name: string) {
  const canon = resolvePlace(name);
  const related = RELATED[canon] ?? [canon];
  const aliases: string[] = [];
  for (const key of related) {
    for (const alias of PLACE_GROUPS[key] ?? [key]) {
      if (!aliases.includes(alias)) aliases.push(alias);
    }
  }
  return aliases;
}

export function itemHasPlace(
  item: { title: string; summary?: string | null; locations: string[] },
  place: string | null,
) {
  if (!place) return true;
  const canon = resolvePlace(place);
  const aliases = new Set(placeAliases(canon).map((alias) => alias.toLowerCase()));
  aliases.add(canon.toLowerCase());
  aliases.add(place.trim().toLowerCase());
  if (item.locations.some((loc) => aliases.has(loc.toLowerCase()) || resolvePlace(loc) === canon)) {
    return true;
  }
  const text = `${item.title} ${item.summary ?? ""} ${"extractText" in item ? (item as { extractText?: string | null }).extractText ?? "" : ""}`;
  for (const related of RELATED[canon] ?? [canon]) {
    if (textHasPlace(text, related)) return true;
  }
  return false;
}
