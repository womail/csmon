import { aliasMatcher } from "./match";

export type OrgKind = "intl_org" | "agency" | "military" | "armed_group" | "threat_actor" | "ransomware" | "company";

export type Org = {
  name: string;
  aliases: string[];
  kind: OrgKind;
  /** Home or attributed country (canonical place name). Threat actors are attributed, never pinned on the map. */
  country?: string;
  note?: string;
  /** Text that rules out this org even when an alias matches (ICC in cricket). */
  veto?: RegExp;
  /** Only the aliases match; the bare name is too common a word. */
  strict?: boolean;
};

const O = (name: string, kind: OrgKind, aliases: string[] = [], extra: Partial<Org> = {}): Org => ({
  name,
  kind,
  aliases,
  ...extra,
});

export const ORGS: Org[] = [
  O("APT28", "threat_actor", ["Fancy Bear", "Forest Blizzard", "Sofacy", "Strontium"], { country: "Russia", note: "GRU unit 26165" }),
  O("APT29", "threat_actor", ["Cozy Bear", "Midnight Blizzard", "Nobelium"], { country: "Russia", note: "SVR" }),
  O("Sandworm", "threat_actor", ["Seashell Blizzard", "APT44"], { country: "Russia", note: "GRU unit 74455" }),
  O("Turla", "threat_actor", ["Secret Blizzard", "Venomous Bear"], { country: "Russia" }),
  O("Lazarus Group", "threat_actor", ["Lazarus", "Diamond Sleet", "Hidden Cobra"], {
    country: "North Korea",
    veto: /\bLazarus (?:of Bethany|rose|raised)\b/i,
  }),
  O("Kimsuky", "threat_actor", ["Emerald Sleet", "APT43"], { country: "North Korea" }),
  O("Volt Typhoon", "threat_actor", [], { country: "China" }),
  O("Salt Typhoon", "threat_actor", [], { country: "China" }),
  O("Flax Typhoon", "threat_actor", [], { country: "China" }),
  O("Silk Typhoon", "threat_actor", ["Hafnium"], { country: "China" }),
  O("APT41", "threat_actor", ["Brass Typhoon", "Winnti"], { country: "China" }),
  O("Charming Kitten", "threat_actor", ["Mint Sandstorm", "APT35"], { country: "Iran" }),
  O("MuddyWater", "threat_actor", ["Mango Sandstorm"], { country: "Iran" }),
  O("Scattered Spider", "threat_actor", ["Octo Tempest", "UNC3944"]),
  O("FIN7", "threat_actor", ["Carbanak"]),
  O("ShinyHunters", "threat_actor", []),
  O("LockBit", "ransomware", []),
  O("ALPHV", "ransomware", ["BlackCat"]),
  O("Cl0p", "ransomware", ["Clop"]),
  O("Akira", "ransomware", ["Akira ransomware", "Akira gang", "Akira group", "Akira operators"], { strict: true }),
  O("Black Basta", "ransomware", []),
  O("Qilin", "ransomware", ["Agenda ransomware"]),
  O("RansomHub", "ransomware", []),
  O("Play ransomware", "ransomware", ["PlayCrypt"]),
  O("Medusa ransomware", "ransomware", []),
  O("8Base", "ransomware", []),
  O("CISA", "agency", ["Cybersecurity and Infrastructure Security Agency"], { country: "US" }),
  O("NCSC", "agency", ["National Cyber Security Centre"], { country: "UK" }),
  O("FBI", "agency", ["Federal Bureau of Investigation"], { country: "US" }),
  O("NSA", "agency", ["National Security Agency"], { country: "US" }),
  O("ENISA", "agency", []),
  O("CERT-EU", "agency", []),
  O("ANSSI", "agency", ["CERT-FR"], { country: "France" }),
  O("BSI", "agency", ["Bundesamt für Sicherheit in der Informationstechnik"], { country: "Germany" }),
  O("CCCS", "agency", ["Canadian Centre for Cyber Security"], { country: "Canada" }),
  O("JPCERT", "agency", ["JPCERT/CC"], { country: "Japan" }),
  O("Europol", "agency", []),
  O("Interpol", "agency", []),
  O("NCSC Ireland", "agency", ["NCSC-IE"], { country: "Ireland" }),
  O("United Nations", "intl_org", ["UN", "U.N."]),
  O("NATO", "intl_org", []),
  O("European Union", "intl_org", ["EU"]),
  O("World Health Organization", "intl_org", ["WHO"]),
  O("IAEA", "intl_org", ["International Atomic Energy Agency"]),
  O("OPEC", "intl_org", ["OPEC+"]),
  O("IMF", "intl_org", ["International Monetary Fund"]),
  O("World Bank", "intl_org", []),
  O("International Criminal Court", "intl_org", ["ICC"], { veto: /\bcricket\b|\bT20\b|\bODI\b|\bTest match\b/i }),
  O("Hamas", "armed_group", [], { country: "Gaza" }),
  O("Hezbollah", "armed_group", ["Hizbollah"], { country: "Lebanon" }),
  O("Houthis", "armed_group", ["Houthi", "Ansar Allah"], { country: "Yemen" }),
  O("Taliban", "armed_group", [], { country: "Afghanistan" }),
  O("Islamic State", "armed_group", ["ISIS", "ISIL", "Daesh"]),
  O("al-Shabaab", "armed_group", ["al Shabaab", "Al-Shabab"], { country: "Somalia" }),
  O("Rapid Support Forces", "armed_group", ["RSF"], { country: "Sudan", veto: /Reporters Without Borders|Reporters sans fronti/i }),
  O("Wagner Group", "armed_group", ["Wagner PMC", "Africa Corps"], { country: "Russia" }),
];

export const ORG_KIND_LABEL: Record<OrgKind, string> = {
  intl_org: "International",
  agency: "Agency",
  military: "Military",
  armed_group: "Armed group",
  threat_actor: "Threat actor",
  ransomware: "Ransomware",
  company: "Company",
};

/** Display order: actors first, then groups, agencies, international bodies. */
export const ORG_KIND_ORDER: OrgKind[] = ["threat_actor", "ransomware", "armed_group", "agency", "military", "intl_org", "company"];

const COMPILED = ORGS.map((org) => ({
  org,
  test: aliasMatcher(org.strict ? org.aliases : [org.name, ...org.aliases]),
}));

const orgByKey = new Map<string, Org>();
for (const org of ORGS) {
  orgByKey.set(org.name.toLowerCase(), org);
  for (const alias of org.aliases) orgByKey.set(alias.toLowerCase(), org);
}

export function orgByName(name: string): Org | undefined {
  return orgByKey.get(name.trim().toLowerCase());
}

export function orgsInText(text: string): Org[] {
  return COMPILED.filter(({ org, test }) => test(text) && !org.veto?.test(text)).map((row) => row.org);
}

export function textMentionsOrg(text: string, name: string): boolean {
  const org = orgByName(name);
  if (!org) return false;
  return orgsInText(text).includes(org);
}

/** "attributed to Russia" for threat actors, "Lebanon" for groups, empty for the rest. */
export function orgAttribution(org: Org): string | null {
  if (!org.country) return null;
  return org.kind === "threat_actor" ? `attributed to ${org.country}` : org.country;
}
