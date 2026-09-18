const TAXONOMY: { tag: string; re: RegExp }[] = [
  {
    tag: "conflict",
    re: /\b(war|warfare|attack|missile|troop|airstrike|combat|invasion|ceasefire|frontline|drone strike)\b/i,
  },
  {
    tag: "cyber",
    re: /\b(hack|hacker|ransomware|malware|phishing|zero[- ]day|data breach|cyberattack|cve)\b/i,
  },
  {
    tag: "markets",
    re: /\b(stock|stocks|market|markets|fed\b|inflation|bitcoin|oil price|gdp|yields|nasdaq)\b/i,
  },
  {
    tag: "tech",
    re: /\b(ai\b|openai|anthropic|google|apple|microsoft|chip|semiconductor|llm|startup)\b/i,
  },
  {
    tag: "media",
    re: /\b(press|journalist|censorship|broadcast|newsroom|headline|reporter)\b/i,
  },
  {
    tag: "climate",
    re: /\b(climate|flood|hurricane|wildfire|drought|heatwave|emissions|carbon)\b/i,
  },
  {
    tag: "politics",
    re: /\b(election|president|parliament|sanction|nato|congress|minister|vote|bill)\b/i,
  },
  {
    tag: "science",
    re: /\b(nasa|study|research|vaccine|quantum|physics|biology|space)\b/i,
  },
];

export function classifyText(text: string) {
  const tags = TAXONOMY.filter(({ re }) => re.test(text)).map(({ tag }) => tag);
  if (tags.length === 0) tags.push("world");
  return [...new Set(tags)].slice(0, 4);
}
