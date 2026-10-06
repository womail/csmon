#!/usr/bin/env node
/** Quick GDELT DOC connectivity check (run: node scripts/test-gdelt.mjs). */
import { Agent, fetch } from "undici";

const UA = "csmon/0.3.0 (gdelt connectivity test)";
const GAP_MS = 10_000;
const agent = new Agent({ connectTimeout: 30_000, headersTimeout: 60_000, bodyTimeout: 60_000 });

const QUERIES = [
  "Ireland",
  "sourcecountry:UK",
  "theme:NATURAL_DISASTER sourcelang:english",
  "(earthquake OR flood OR wildfire OR hurricane) sourcelang:english",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function probe(query) {
  const params = new URLSearchParams({
    query,
    mode: "ArtList",
    format: "json",
    maxrecords: "5",
    timespan: "7d",
    sort: "DateDesc",
  });
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?${params}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    dispatcher: agent,
  });
  const text = (await res.text()).trim();
  if (!res.ok) return { query, status: res.status, articles: null, note: text.slice(0, 120) };
  if (!text.startsWith("{")) {
    return { query, status: res.status, articles: null, note: text.slice(0, 120) };
  }
  let articles = 0;
  try {
    const data = JSON.parse(text);
    articles = Array.isArray(data.articles) ? data.articles.length : 0;
  } catch {
    return { query, status: res.status, articles: null, note: "invalid json" };
  }
  return { query, status: res.status, articles, note: articles ? dataSample(text) : "empty {}" };
}

function dataSample(text) {
  try {
    const t = JSON.parse(text).articles?.[0]?.title;
    return t ? String(t).slice(0, 60) : "ok";
  } catch {
    return "ok";
  }
}

console.log("GDELT DOC probe (≥10s between requests)…\n");
for (let i = 0; i < QUERIES.length; i++) {
  if (i) await sleep(GAP_MS);
  const row = await probe(QUERIES[i]);
  console.log(JSON.stringify(row));
}
